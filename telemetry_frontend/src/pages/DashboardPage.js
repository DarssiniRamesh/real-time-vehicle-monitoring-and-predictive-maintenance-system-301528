import React, { useCallback, useMemo, useState } from "react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { ErrorState, LoadingState, EmptyState } from "../components/ui/States";
import styles from "./pages.module.css";
import { TelemetryLineChart } from "../components/charts/TelemetryLineChart";
import { formatDateTime } from "../utils/format";
import { getLatestValue, getWindowAverage } from "../utils/telemetry";
import { usePolling } from "../hooks/usePolling";
import { useAppState } from "../state/AppStateContext";
import { PollingIndicator } from "../components/ui/PollingIndicator";

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

function predictionTone(sev) {
  const s = String(sev || "").toLowerCase();
  if (s === "high") return "error";
  if (s === "medium") return "warning";
  if (s === "low") return "success";
  return "neutral";
}

/**
 * PUBLIC_INTERFACE
 * DashboardPage: KPIs + live telemetry chart + prediction panel.
 */
export function DashboardPage() {
  const { api, pollingIntervals, setPollingMeta } = useAppState();

  // Base data
  const [assets, setAssets] = useState([]);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [model, setModel] = useState(null);

  // User controls
  const [lookbackMinutes, setLookbackMinutes] = useState(30);
  const [agg, setAgg] = useState("avg"); // per backend enum
  const [intervalSeconds, setIntervalSeconds] = useState(60);

  // Page states
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  // Telemetry states
  const [telemetryLoading, setTelemetryLoading] = useState(false);
  const [telemetryError, setTelemetryError] = useState("");
  const [telemetry, setTelemetry] = useState(null);

  // Alerts KPI states
  const [alertsLastHour, setAlertsLastHour] = useState({ total: 0, error: "" });

  // Prediction states
  const [prediction, setPrediction] = useState(null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [predictionError, setPredictionError] = useState("");

  const [isRefreshing, setIsRefreshing] = useState(false);

  const assetOptions = useMemo(() => {
    return assets.map((a) => ({
      id: a.id,
      label: `${a.name} (${a.id})`,
      status: a.status,
    }));
  }, [assets]);

  const assetsOnline = useMemo(() => assets.filter((a) => a.status === "active").length, [assets]);

  const keysForChart = useMemo(() => {
    const pts = Array.isArray(telemetry?.points) ? telemetry.points : [];
    const uniqueKeys = Array.from(new Set(pts.map((p) => p.key).filter(Boolean)));

    // Keep a stable "primary metric" if present; otherwise fallback.
    const preferred = ["temperature_c", "vibration", "pressure", "rpm", "speed_kph"];
    const existingPreferred = preferred.filter((k) => uniqueKeys.includes(k));
    const fallback = uniqueKeys.slice(0, 4);
    return existingPreferred.length ? existingPreferred : fallback;
  }, [telemetry]);

  const primaryMetric = keysForChart[0] || "";
  const series = useMemo(() => buildSeries(telemetry, keysForChart), [telemetry, keysForChart]);

  const latestPrimary = useMemo(() => getLatestValue(telemetry?.points, primaryMetric), [primaryMetric, telemetry?.points]);

  const fiveMinAvgPrimary = useMemo(() => {
    // Windowed average from the returned aggregated (or raw) series.
    const nowIso = new Date().toISOString();
    return getWindowAverage(telemetry?.points, primaryMetric, 5 * 60_000, nowIso);
  }, [primaryMetric, telemetry?.points]);

  const latestTs = useMemo(() => {
    return series.latestTimestamp || prediction?.used_timestamp || prediction?.inferred_at || null;
  }, [prediction?.inferred_at, prediction?.used_timestamp, series.latestTimestamp]);

  const loadBase = useCallback(async () => {
    setPageError("");
    setPageLoading(true);

    try {
      const [assetList, modelMeta] = await Promise.all([api.assets.list(), api.model.get()]);
      setAssets(assetList);
      setModel(modelMeta);

      const current = selectedAssetId || assetList.find((a) => a.status === "active")?.id || assetList[0]?.id || "";
      setSelectedAssetId(current);
    } catch (e) {
      setPageError(e?.message || "Failed to load dashboard");
    } finally {
      setPageLoading(false);
    }
  }, [selectedAssetId]);

  const loadTelemetry = useCallback(
    async (assetId) => {
      if (!assetId) return;

      setTelemetryError("");
      setTelemetryLoading(true);

      try {
        const now = new Date();
        const from = new Date(now.getTime() - lookbackMinutes * 60_000);

        const res = await api.telemetry.get({
          assetId,
          from: from.toISOString(),
          to: now.toISOString(),
          agg,
          interval: agg === "none" ? undefined : intervalSeconds,
        });

        setTelemetry(res);
      } catch (e) {
        setTelemetry(null);
        setTelemetryError(e?.message || "Failed to load telemetry");
      } finally {
        setTelemetryLoading(false);
      }
    },
    [agg, intervalSeconds, lookbackMinutes]
  );

  const loadAlertsLastHour = useCallback(async () => {
    setAlertsLastHour({ total: 0, error: "" });
    try {
      const nowIso = new Date().toISOString();
      const fromIso = new Date(Date.now() - 60 * 60_000).toISOString();
      // We only need `total`, so keep response tiny.
      const res = await api.alerts.list({ from: fromIso, to: nowIso, limit: 1, sort: "created_at:desc" });
      setAlertsLastHour({ total: res.total || 0, error: "" });
    } catch (e) {
      setAlertsLastHour({ total: 0, error: e?.message || "Failed to load alerts KPI" });
    }
  }, []);

  const runPrediction = useCallback(
    async (assetId) => {
      if (!assetId) return;
      setPredictionError("");
      setPredictionLoading(true);
      try {
        const pred = await api.prediction.predict({ asset_id: assetId });
        setPrediction(pred);
      } catch (e) {
        setPrediction(null);
        setPredictionError(e?.message || "Failed to run prediction");
      } finally {
        setPredictionLoading(false);
      }
    },
    [setPrediction]
  );

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (!assets.length) {
        await loadBase();
      }
      if (selectedAssetId) {
        await Promise.all([loadTelemetry(selectedAssetId), loadAlertsLastHour(), runPrediction(selectedAssetId)]);
      } else {
        await loadAlertsLastHour();
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [assets.length, loadAlertsLastHour, loadBase, loadTelemetry, runPrediction, selectedAssetId]);

  // Initial base load
  React.useEffect(() => {
    loadBase();
  }, [loadBase]);

  // When selection or telemetry controls change, reload telemetry + prediction
  React.useEffect(() => {
    if (!selectedAssetId) return;
    loadTelemetry(selectedAssetId);
    runPrediction(selectedAssetId);
    loadAlertsLastHour();
  }, [loadAlertsLastHour, loadTelemetry, runPrediction, selectedAssetId]);

  // Poll telemetry only (keeps dashboard snappy).
  usePolling(
    () => {
      if (!selectedAssetId) return;
      return Promise.all([loadTelemetry(selectedAssetId), loadAlertsLastHour()]).then(() => undefined);
    },
    selectedAssetId ? pollingIntervals.dashboardTelemetryMs : null,
    {
      onTickStart: () => setPollingMeta("dashboard", { running: true, lastError: null }),
      onTickEnd: () =>
        setPollingMeta("dashboard", { running: false, lastRefreshAtIso: new Date().toISOString(), lastError: null }),
      onTickError: (err) =>
        setPollingMeta("dashboard", { running: false, lastError: err?.message || "Polling failed" }),
    }
  );

  if (pageLoading) return <LoadingState label="Loading dashboard" />;
  if (pageError) {
    return <ErrorState title="Dashboard failed to load" hint={pageError} onRetry={() => loadBase()} />;
  }

  return (
    <div className={styles.pageGrid}>
      <Card
        title="Fleet Overview"
        actions={
          <div className={styles.controlsRow}>
            <Button variant="primary" ariaLabel="Refresh dashboard" isLoading={isRefreshing} onClick={refreshAll}>
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

          <div className={styles.kpiCard} role="group" aria-label="Latest value">
            <div className={styles.kpiLabel}>Latest ({primaryMetric || "metric"})</div>
            <div className={styles.kpiValue}>
              {latestPrimary.value === null ? "—" : Number(latestPrimary.value).toFixed(2)}
            </div>
            <div className={styles.kpiHint}>at {formatDateTime(latestPrimary.timestamp)}</div>
          </div>

          <div className={styles.kpiCard} role="group" aria-label="5 minute average">
            <div className={styles.kpiLabel}>5m avg ({primaryMetric || "metric"})</div>
            <div className={styles.kpiValue}>
              {fiveMinAvgPrimary.avg === null ? "—" : Number(fiveMinAvgPrimary.avg).toFixed(2)}
            </div>
            <div className={styles.kpiHint}>{fiveMinAvgPrimary.count ? `${fiveMinAvgPrimary.count} points` : "No points"}</div>
          </div>

          <div className={styles.kpiCard} role="group" aria-label="Alerts in last hour">
            <div className={styles.kpiLabel}>Alerts (last hour)</div>
            <div className={styles.kpiValue}>{alertsLastHour.total}</div>
            <div className={styles.kpiHint}>{alertsLastHour.error ? alertsLastHour.error : "Server-side count"}</div>
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
                  onChange={(e) => setSelectedAssetId(e.target.value)}
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

              <div className={styles.controlGroup}>
                <label className={styles.controlLabel} htmlFor="aggSelect">
                  Aggregation
                </label>
                <select
                  id="aggSelect"
                  className={styles.select}
                  value={agg}
                  onChange={(e) => setAgg(e.target.value)}
                  aria-label="Select aggregation"
                >
                  <option value="none">none (raw)</option>
                  <option value="avg">avg</option>
                  <option value="min">min</option>
                  <option value="max">max</option>
                  <option value="p50">p50</option>
                  <option value="p90">p90</option>
                </select>
              </div>

              <div className={styles.controlGroup}>
                <label className={styles.controlLabel} htmlFor="intervalSelect">
                  Interval
                </label>
                <select
                  id="intervalSelect"
                  className={styles.select}
                  value={String(intervalSeconds)}
                  onChange={(e) => setIntervalSeconds(Number(e.target.value))}
                  aria-label="Select aggregation interval"
                  disabled={agg === "none"}
                >
                  <option value="30">30s</option>
                  <option value="60">60s</option>
                  <option value="300">300s</option>
                </select>
              </div>

              <PollingIndicator pollingKey="dashboard" label={`poll ${Math.round(pollingIntervals.dashboardTelemetryMs / 1000)}s`} />
            </div>
          }
        >
          {telemetryLoading ? (
            <LoadingState label="Loading telemetry" />
          ) : telemetryError ? (
            <ErrorState title="Telemetry failed to load" hint={telemetryError} onRetry={() => loadTelemetry(selectedAssetId)} />
          ) : !selectedAssetId ? (
            <EmptyState title="Select an asset" hint="Choose an asset to view its telemetry chart." />
          ) : !series.labels.length ? (
            <EmptyState
              title="No telemetry points"
              hint="Seed or simulate data in the backend, then refresh. Chart uses the selected aggregation/window."
            />
          ) : (
            <div className={styles.chartWrap}>
              <TelemetryLineChart series={series} ariaLabel="Live telemetry line chart" showLegend />
            </div>
          )}
        </Card>

        <Card
          title="Prediction"
          actions={
            prediction?.severity ? (
              <Badge tone={predictionTone(prediction.severity)} ariaLabel={`Prediction severity ${prediction.severity}`}>
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
          ) : predictionLoading ? (
            <LoadingState label="Running prediction" />
          ) : predictionError ? (
            <ErrorState title="Prediction failed" hint={predictionError} onRetry={() => runPrediction(selectedAssetId)} />
          ) : !prediction ? (
            <EmptyState
              title="No prediction yet"
              hint="Run a prediction for the selected asset."
              action={
                <Button variant="primary" ariaLabel="Run prediction" onClick={() => runPrediction(selectedAssetId)}>
                  Run prediction
                </Button>
              }
            />
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

              <div className={styles.controlsRow}>
                <Button variant="secondary" ariaLabel="Re-run prediction" onClick={() => runPrediction(selectedAssetId)}>
                  Re-run
                </Button>
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

              <div className={styles.mutedText} aria-label="Latest timestamp">
                <strong>Latest timestamp:</strong> {formatDateTime(latestTs)}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
