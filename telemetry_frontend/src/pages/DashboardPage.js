import React, { useCallback, useMemo, useState } from "react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { ErrorState, LoadingState, EmptyState } from "../components/ui/States";
import { api } from "../api/client";
import styles from "./pages.module.css";
import { TelemetryLineChart } from "../components/charts/TelemetryLineChart";
import { formatDateTime } from "../utils/format";
import { useInterval } from "../hooks/useInterval";

const SENSOR_PALETTE = [
  { line: "rgba(37, 99, 235, 0.95)", fill: "rgba(37, 99, 235, 0.10)" }, // blue
  { line: "rgba(245, 158, 11, 0.95)", fill: "rgba(245, 158, 11, 0.14)" }, // amber
  { line: "rgba(16, 185, 129, 0.95)", fill: "rgba(16, 185, 129, 0.12)" }, // green
  { line: "rgba(239, 68, 68, 0.9)", fill: "rgba(239, 68, 68, 0.10)" }, // red
  { line: "rgba(99, 102, 241, 0.9)", fill: "rgba(99, 102, 241, 0.10)" }, // indigo
];

/**
 * Convert flattened telemetry points (timestamp,key,value) into a chart series.
 * @param {{ points: Array<{timestamp: string, key: string, value: number}> }} telemetry
 * @param {string[]} keys
 */
function buildSeries(telemetry, keys) {
  const points = Array.isArray(telemetry?.points) ? telemetry.points : [];
  const timeSet = new Set(points.map((p) => p.timestamp).filter(Boolean));
  const timestamps = Array.from(timeSet).sort();

  // Map: key -> (timestamp -> value)
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
    const data = timestamps.map((ts) => {
      const v = map?.get(ts);
      return typeof v === "number" ? v : null;
    });

    return {
      label: k,
      data,
      borderColor: color.line,
      backgroundColor: color.fill,
      fill: false,
    };
  });

  return { labels, datasets, latestTimestamp: timestamps.length ? timestamps[timestamps.length - 1] : null };
}

function severityTone(sev) {
  const s = String(sev || "").toLowerCase();
  if (s === "high") return "error";
  if (s === "medium") return "warning";
  if (s === "low") return "success";
  return "neutral";
}

/**
 * PUBLIC_INTERFACE
 * DashboardPage: KPIs + live telemetry chart + prediction/health panel.
 */
export function DashboardPage() {
  const [assets, setAssets] = useState([]);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [lookbackMinutes, setLookbackMinutes] = useState(30);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [telemetry, setTelemetry] = useState(null);
  const [telemetryError, setTelemetryError] = useState("");

  const [model, setModel] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [predictionError, setPredictionError] = useState("");

  const [alertsSummary, setAlertsSummary] = useState({ total: 0, bySeverity: {} });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadDashboard = useCallback(
    async ({ keepSelection = true } = {}) => {
      setError("");
      setTelemetryError("");
      setPredictionError("");
      setIsRefreshing(true);

      try {
        const [assetList, modelMeta] = await Promise.all([api.assets.list(), api.model.get()]);
        setAssets(assetList);
        setModel(modelMeta);

        let assetId = selectedAssetId;
        if (!keepSelection || !assetId) {
          const active = assetList.find((a) => a.status === "active") || assetList[0];
          assetId = active?.id || "";
          setSelectedAssetId(assetId);
        }

        if (assetId) {
          const now = new Date();
          const from = new Date(now.getTime() - lookbackMinutes * 60_000);
          // Aggregation: avg + 60s buckets for readability.
          const telem = await api.telemetry.get({
            assetId,
            from: from.toISOString(),
            to: now.toISOString(),
            agg: "avg",
            interval: 60,
          });
          setTelemetry(telem);

          const pred = await api.prediction.predict({ asset_id: assetId });
          setPrediction(pred);
        } else {
          setTelemetry(null);
          setPrediction(null);
        }

        // Alerts KPI: last 24h, limit for POC.
        const nowIso = new Date().toISOString();
        const fromIso = new Date(Date.now() - 24 * 3600_000).toISOString();
        const alertRes = await api.alerts.list({ from: fromIso, to: nowIso, limit: 200, sort: "created_at:desc" });

        const bySeverity = (alertRes.items || []).reduce((acc, a) => {
          const key = String(a.severity || "unknown");
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {});
        setAlertsSummary({ total: alertRes.total || 0, bySeverity });
      } catch (e) {
        setError(e?.message || "Failed to load dashboard data");
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [lookbackMinutes, selectedAssetId]
  );

  // Initial load (and reload when lookback changes).
  React.useEffect(() => {
    setLoading(true);
    loadDashboard({ keepSelection: true });
  }, [loadDashboard]);

  // Poll telemetry/prediction periodically without resetting the whole page.
  useInterval(
    () => {
      if (!selectedAssetId) return;
      loadDashboard({ keepSelection: true });
    },
    selectedAssetId ? 20_000 : null
  );

  const assetOptions = useMemo(() => {
    return assets.map((a) => ({
      id: a.id,
      label: `${a.name} (${a.id})`,
      status: a.status,
    }));
  }, [assets]);

  const keysForChart = useMemo(() => {
    // Prefer a stable subset if present; otherwise derive from response.
    const pts = Array.isArray(telemetry?.points) ? telemetry.points : [];
    const uniqueKeys = Array.from(new Set(pts.map((p) => p.key).filter(Boolean)));
    const preferred = ["temperature_c", "vibration", "pressure", "rpm", "speed_kph"];
    const existingPreferred = preferred.filter((k) => uniqueKeys.includes(k));
    const fallback = uniqueKeys.slice(0, 4);
    return existingPreferred.length ? existingPreferred : fallback;
  }, [telemetry]);

  const series = useMemo(() => buildSeries(telemetry, keysForChart), [telemetry, keysForChart]);

  const assetsOnline = useMemo(() => assets.filter((a) => a.status === "active").length, [assets]);

  const latestTs = useMemo(() => {
    // Prefer telemetry latest timestamp, else prediction used timestamp, else inferred_at.
    return series.latestTimestamp || prediction?.used_timestamp || prediction?.inferred_at || null;
  }, [prediction, series.latestTimestamp]);

  const kpiAlertCritical = alertsSummary.bySeverity?.critical || 0;
  const kpiAlertHigh = alertsSummary.bySeverity?.high || 0;

  if (loading) {
    return <LoadingState label="Loading dashboard" />;
  }

  if (error) {
    return <ErrorState title="Dashboard failed to load" hint={error} onRetry={() => loadDashboard({ keepSelection: true })} />;
  }

  return (
    <div className={styles.pageGrid}>
      <Card
        title="Fleet Health Overview"
        actions={
          <div className={styles.controlsRow}>
            <Button
              variant="primary"
              ariaLabel="Refresh dashboard"
              isLoading={isRefreshing}
              onClick={() => loadDashboard({ keepSelection: true })}
            >
              Refresh
            </Button>
          </div>
        }
      >
        <div className={styles.kpiGrid} aria-label="Key performance indicators">
          <div className={styles.kpiCard} role="group" aria-label="Assets online">
            <div className={styles.kpiLabel}>Assets online</div>
            <div className={styles.kpiValue}>{assetsOnline}</div>
            <div className={styles.kpiHint}>Active within heartbeat window</div>
          </div>

          <div className={styles.kpiCard} role="group" aria-label="Latest timestamp">
            <div className={styles.kpiLabel}>Latest timestamp</div>
            <div className={styles.kpiValue} style={{ fontSize: 14 }}>
              {formatDateTime(latestTs)}
            </div>
            <div className={styles.kpiHint}>From latest telemetry/prediction</div>
          </div>

          <div className={styles.kpiCard} role="group" aria-label="Critical alerts">
            <div className={styles.kpiLabel}>Critical alerts (24h)</div>
            <div className={styles.kpiValue}>{kpiAlertCritical}</div>
            <div className={styles.kpiHint}>Severity: critical</div>
          </div>

          <div className={styles.kpiCard} role="group" aria-label="High alerts">
            <div className={styles.kpiLabel}>High alerts (24h)</div>
            <div className={styles.kpiValue}>{kpiAlertHigh}</div>
            <div className={styles.kpiHint}>Severity: high</div>
          </div>
        </div>
      </Card>

      <div className={styles.twoCol}>
        <Card
          title="Live Telemetry"
          actions={
            <div className={styles.controlsRow}>
              <div className={styles.controlGroup}>
                <label className={styles.controlLabel} htmlFor="assetSelect">
                  Asset
                </label>
                <select
                  id="assetSelect"
                  className={styles.select}
                  value={selectedAssetId}
                  onChange={(e) => {
                    setSelectedAssetId(e.target.value);
                    // force reload for the new asset
                    window.setTimeout(() => loadDashboard({ keepSelection: true }), 0);
                  }}
                  aria-label="Select asset for telemetry"
                >
                  <option value="" disabled>
                    Select an asset…
                  </option>
                  {assetOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label} {a.status === "active" ? "• active" : "• inactive"}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.controlGroup}>
                <label className={styles.controlLabel} htmlFor="lookbackSelect">
                  Window
                </label>
                <select
                  id="lookbackSelect"
                  className={styles.select}
                  value={String(lookbackMinutes)}
                  onChange={(e) => setLookbackMinutes(Number(e.target.value))}
                  aria-label="Select telemetry lookback window"
                >
                  <option value="10">Last 10 min</option>
                  <option value="30">Last 30 min</option>
                  <option value="60">Last 60 min</option>
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Badge tone="primary" ariaLabel="Aggregation average with 60 second buckets">
                  avg / 60s
                </Badge>
              </div>
            </div>
          }
        >
          {telemetryError ? (
            <ErrorState title="Telemetry failed to load" hint={telemetryError} onRetry={() => loadDashboard({ keepSelection: true })} />
          ) : !selectedAssetId ? (
            <EmptyState title="Select an asset" hint="Choose an asset to view its telemetry chart." />
          ) : !series.labels.length ? (
            <EmptyState
              title="No telemetry points"
              hint="Seed or simulate data in the backend, then refresh. Chart uses aggregated telemetry over the selected window."
            />
          ) : (
            <div className={styles.chartWrap}>
              <TelemetryLineChart series={series} ariaLabel="Live telemetry line chart" showLegend />
            </div>
          )}
        </Card>

        <Card
          title="Prediction & Health"
          actions={
            prediction?.severity ? (
              <Badge tone={severityTone(prediction.severity)} ariaLabel={`Prediction severity ${prediction.severity}`}>
                {String(prediction.severity).toUpperCase()}
              </Badge>
            ) : (
              <Badge tone="neutral" ariaLabel="Prediction not available">
                —
              </Badge>
            )
          }
        >
          {!selectedAssetId ? (
            <EmptyState title="Select an asset" hint="Prediction is computed for the selected asset using the most recent telemetry." />
          ) : predictionError ? (
            <ErrorState title="Prediction failed to load" hint={predictionError} onRetry={() => loadDashboard({ keepSelection: true })} />
          ) : !prediction ? (
            <LoadingState label="Computing prediction" />
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <Badge tone="primary" ariaLabel="Risk score">
                  Risk: {Math.round((prediction.risk_score || 0) * 100)}%
                </Badge>
                <Badge tone="neutral" ariaLabel="Inferred at">
                  Inferred: {formatDateTime(prediction.inferred_at)}
                </Badge>
              </div>

              <div className={styles.mutedText} aria-label="Recommendation">
                <strong>Recommendation:</strong> {prediction.recommendation || "—"}
              </div>

              <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12 }}>
                <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 8 }}>Model metadata</div>
                {!model ? (
                  <div className={styles.mutedText}>Model metadata unavailable.</div>
                ) : (
                  <div className={styles.metaList} aria-label="Model metadata">
                    <div className={styles.metaRow}>
                      <div className={styles.metaKey}>Name</div>
                      <div className={styles.metaValue}>{model.name}</div>
                    </div>
                    <div className={styles.metaRow}>
                      <div className={styles.metaKey}>Version</div>
                      <div className={styles.metaValue}>{model.version}</div>
                    </div>
                    <div className={styles.metaRow}>
                      <div className={styles.metaKey}>Strategy</div>
                      <div className={styles.metaValue}>{model.strategy}</div>
                    </div>
                    <div className={styles.metaRow}>
                      <div className={styles.metaKey}>Updated</div>
                      <div className={styles.metaValue}>{formatDateTime(model.updated_at)}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
