import React, { useCallback, useMemo, useState } from "react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import { TableSkeleton } from "../components/ui/TableSkeleton";
import { api } from "../api/client";
import styles from "./pages.module.css";
import { formatDateTime, formatRelativeTime } from "../utils/format";
import { TelemetryLineChart } from "../components/charts/TelemetryLineChart";

const SENSOR_PALETTE = [
  { line: "rgba(37, 99, 235, 0.95)", fill: "rgba(37, 99, 235, 0.10)" },
  { line: "rgba(245, 158, 11, 0.95)", fill: "rgba(245, 158, 11, 0.14)" },
  { line: "rgba(16, 185, 129, 0.95)", fill: "rgba(16, 185, 129, 0.12)" },
];

function toneForStatus(status) {
  return status === "active" ? "success" : "neutral";
}

/**
 * Build a mini-series from flattened points.
 * @param {{ points: Array<{timestamp: string, key: string, value: number}> }} telemetry
 * @param {string[]} keys
 */
function buildSeries(telemetry, keys) {
  const points = Array.isArray(telemetry?.points) ? telemetry.points : [];
  const timeSet = new Set(points.map((p) => p.timestamp).filter(Boolean));
  const timestamps = Array.from(timeSet).sort();

  const byKey = new Map();
  keys.forEach((k) => byKey.set(k, new Map()));
  points.forEach((p) => {
    if (!byKey.has(p.key)) return;
    byKey.get(p.key).set(p.timestamp, typeof p.value === "number" ? p.value : null);
  });

  const labels = timestamps.map((t) => {
    const d = new Date(t);
    if (Number.isNaN(d.getTime())) return t;
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  });

  const datasets = keys.map((k, idx) => {
    const color = SENSOR_PALETTE[idx % SENSOR_PALETTE.length];
    const map = byKey.get(k);
    return {
      label: k,
      data: timestamps.map((ts) => {
        const v = map?.get(ts);
        return typeof v === "number" ? v : null;
      }),
      borderColor: color.line,
      backgroundColor: color.fill,
      fill: false,
    };
  });

  return {
    labels,
    datasets,
    latestTimestamp: timestamps.length ? timestamps[timestamps.length - 1] : null,
  };
}

/**
 * PUBLIC_INTERFACE
 * AssetsPage lists monitored assets and shows a detail mini chart for the selected asset.
 */
export function AssetsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [assets, setAssets] = useState([]);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [heartbeats, setHeartbeats] = useState({}); // assetId -> latest ISO timestamp

  const [detailTelemetry, setDetailTelemetry] = useState(null);
  const [detailError, setDetailError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);

  const loadAssets = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const list = await api.assets.list();
      setAssets(list);
      if (!selectedAssetId) {
        const first = list[0];
        setSelectedAssetId(first?.id || "");
      }
    } catch (e) {
      setError(e?.message || "Failed to load assets");
    } finally {
      setLoading(false);
    }
  }, [selectedAssetId]);

  React.useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const selected = useMemo(() => assets.find((a) => a.id === selectedAssetId) || null, [assets, selectedAssetId]);

  const loadHeartbeatFor = useCallback(async (assetId) => {
    const now = new Date();
    const from = new Date(now.getTime() - 15 * 60_000);
    const res = await api.telemetry.get({
      assetId,
      from: from.toISOString(),
      to: now.toISOString(),
      agg: "avg",
      interval: 60,
    });

    const points = Array.isArray(res?.points) ? res.points : [];
    const latest = points.reduce((acc, p) => (p.timestamp && p.timestamp > acc ? p.timestamp : acc), "");
    return latest || null;
  }, []);

  const loadHeartbeats = useCallback(async () => {
    // Best-effort heartbeat for list: query a small subset concurrently to keep POC snappy.
    const ids = assets.map((a) => a.id).slice(0, 12);
    const concurrency = 4;

    const next = {};
    let index = 0;

    async function worker() {
      while (index < ids.length) {
        const i = index;
        index += 1;
        const id = ids[i];
        try {
          const ts = await loadHeartbeatFor(id);
          if (ts) next[id] = ts;
        } catch (e) {
          // Ignore heartbeat failures; asset list is still usable.
        }
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    setHeartbeats((prev) => ({ ...prev, ...next }));
  }, [assets, loadHeartbeatFor]);

  const loadDetail = useCallback(
    async (assetId) => {
      if (!assetId) return;
      setDetailError("");
      setDetailLoading(true);
      try {
        const now = new Date();
        const from = new Date(now.getTime() - 30 * 60_000);
        const res = await api.telemetry.get({
          assetId,
          from: from.toISOString(),
          to: now.toISOString(),
          agg: "avg",
          interval: 60,
        });
        setDetailTelemetry(res);

        // Also update heartbeat for the selected asset (most useful for detail panel).
        const points = Array.isArray(res?.points) ? res.points : [];
        const latest = points.reduce((acc, p) => (p.timestamp && p.timestamp > acc ? p.timestamp : acc), "");
        if (latest) {
          setHeartbeats((prev) => ({ ...prev, [assetId]: latest }));
        }
      } catch (e) {
        setDetailError(e?.message || "Failed to load asset telemetry");
        setDetailTelemetry(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [setDetailTelemetry]
  );

  React.useEffect(() => {
    if (selectedAssetId) loadDetail(selectedAssetId);
  }, [loadDetail, selectedAssetId]);

  const chartKeys = useMemo(() => {
    const pts = Array.isArray(detailTelemetry?.points) ? detailTelemetry.points : [];
    const uniqueKeys = Array.from(new Set(pts.map((p) => p.key).filter(Boolean)));
    const preferred = ["temperature_c", "vibration", "pressure"];
    const existingPreferred = preferred.filter((k) => uniqueKeys.includes(k));
    return (existingPreferred.length ? existingPreferred : uniqueKeys.slice(0, 3)).slice(0, 3);
  }, [detailTelemetry]);

  const series = useMemo(() => buildSeries(detailTelemetry, chartKeys), [detailTelemetry, chartKeys]);
  const selectedHeartbeat = selectedAssetId ? heartbeats[selectedAssetId] || series.latestTimestamp || null : null;

  const actions = (
    <div className={styles.controlsRow}>
      <Button variant="secondary" ariaLabel="Reload assets" onClick={() => loadAssets()} disabled={loading}>
        Reload
      </Button>
      <Button
        variant="ghost"
        ariaLabel="Load latest heartbeats"
        onClick={() => loadHeartbeats()}
        disabled={loading || assets.length === 0}
      >
        Load heartbeats (list)
      </Button>
    </div>
  );

  if (loading) return <LoadingState label="Loading assets" />;
  if (error) return <ErrorState title="Assets failed to load" hint={error} onRetry={() => loadAssets()} />;

  if (assets.length === 0) {
    return (
      <Card title="Assets">
        <EmptyState title="No assets available" hint="Seed demo data in the backend, then reload." />
      </Card>
    );
  }

  return (
    <div className={styles.pageGrid}>
      <Card title="Assets" actions={actions}>
        <div className={styles.mutedText}>
          Assets are sourced from <code>GET /api/v1/assets</code>. Selecting an asset loads its trend via{" "}
          <code>GET /api/v1/telemetry</code> (lookback window), and derives a last heartbeat timestamp from recent data.
        </div>

        <div className={styles.tableWrap} aria-label="Assets table">
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th} scope="col">
                  Asset
                </th>
                <th className={styles.th} scope="col">
                  Type
                </th>
                <th className={styles.th} scope="col">
                  Status
                </th>
                <th className={styles.th} scope="col">
                  Last heartbeat
                </th>
                <th className={styles.th} scope="col">
                  Relative
                </th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => {
                const hb = heartbeats[a.id] || null;
                const isSelected = a.id === selectedAssetId;
                return (
                  <tr
                    key={a.id}
                    className={styles.tr}
                    tabIndex={0}
                    aria-label={`Asset row ${a.id}`}
                    onClick={() => setSelectedAssetId(a.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedAssetId(a.id);
                      }
                    }}
                    style={{ background: isSelected ? "rgba(37, 99, 235, 0.06)" : undefined, cursor: "pointer" }}
                  >
                    <td className={styles.td} style={{ fontWeight: 800 }}>
                      {a.name}{" "}
                      <span style={{ color: "var(--color-muted)", fontWeight: 600, fontSize: 12, marginLeft: 8 }}>
                        ({a.id})
                      </span>
                    </td>
                    <td className={styles.td}>{a.type}</td>
                    <td className={styles.td}>
                      <Badge tone={toneForStatus(a.status)} ariaLabel={`Status ${a.status}`}>
                        {String(a.status).toUpperCase()}
                      </Badge>
                    </td>
                    <td className={styles.td}>{formatDateTime(hb)}</td>
                    <td className={styles.td}>{hb ? formatRelativeTime(hb) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title="Asset detail"
        actions={
          selected ? (
            <Badge tone="primary" ariaLabel={`Selected asset ${selected.id}`}>
              {selected.id}
            </Badge>
          ) : (
            <Badge tone="neutral" ariaLabel="No asset selected">
              —
            </Badge>
          )
        }
      >
        {!selected ? (
          <EmptyState title="Select an asset" hint="Choose an asset from the list above to view details." />
        ) : detailLoading ? (
          <>
            <TableSkeleton rows={3} columns={3} />
            <LoadingState label="Loading asset telemetry" />
          </>
        ) : detailError ? (
          <ErrorState title="Failed to load asset telemetry" hint={detailError} onRetry={() => loadDetail(selected.id)} />
        ) : !series.labels.length ? (
          <EmptyState title="No telemetry for this asset" hint="Seed or simulate backend telemetry, then reload." />
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <Badge tone="neutral" ariaLabel="Telemetry view">
                avg / 60s • last 30 min
              </Badge>
              <Badge tone="primary" ariaLabel="Last heartbeat">
                Heartbeat: {formatDateTime(selectedHeartbeat)}
              </Badge>
              <Badge tone="neutral" ariaLabel="Relative heartbeat">
                {selectedHeartbeat ? formatRelativeTime(selectedHeartbeat) : "—"}
              </Badge>
            </div>

            <div className={styles.miniChartWrap}>
              <TelemetryLineChart series={series} ariaLabel="Asset mini telemetry chart" showLegend />
            </div>

            <div className={styles.mutedText}>
              Trend chart is a lightweight POC panel. Future enhancement: dedicated asset route with full history, KPIs, and alert
              timeline.
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
