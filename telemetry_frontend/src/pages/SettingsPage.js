import React, { useMemo } from "react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import styles from "./pages.module.css";
import { useAppState } from "../state/AppStateContext";

/**
 * PUBLIC_INTERFACE
 * SettingsPage provides runtime configuration controls:
 * - mock/real API toggle (persisted)
 * - base URL visibility
 * - centralized polling intervals visibility
 * - backend health check visibility (auto-runs on app start and on client switch)
 */
export function SettingsPage() {
  const { apiBaseUrl, pollingIntervals, mockMode, setMockMode, health, runHealthCheck } = useAppState();

  const healthTone = useMemo(() => {
    if (health.status === "ok") return "success";
    if (health.status === "error") return "error";
    return "neutral";
  }, [health.status]);

  return (
    <Card
      title="Settings"
      actions={
        <div className={styles.controlsRow}>
          <Button variant="secondary" ariaLabel="Run health check" onClick={() => runHealthCheck()}>
            Check health
          </Button>
          <Badge tone={healthTone} ariaLabel="Backend health status">
            health: {health.status}
          </Badge>
        </div>
      }
    >
      <div style={{ display: "grid", gap: 14 }}>
        <div className={styles.mutedText}>
          Mock mode is a lightweight POC feature. It switches the API client in-memory (no reload) and persists the choice in{" "}
          <code>localStorage</code> as <code>mockMode</code>. When switching, a health check runs automatically to reflect
          connectivity.
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={mockMode}
              onChange={(e) => setMockMode(e.target.checked)}
              aria-label="Enable mock API mode"
            />
            <span style={{ fontWeight: 800 }}>Use mock API</span>
          </label>

          <Badge tone={mockMode ? "warning" : "primary"} ariaLabel="Active API mode">
            mode: {mockMode ? "mock" : "real"}
          </Badge>

          <Badge tone="neutral" ariaLabel="API base url">
            baseUrl: {apiBaseUrl || "(same origin)"}
          </Badge>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 900, fontSize: 13 }}>Polling intervals</div>
          <div className={styles.mutedText}>
            These are centralized in <code>AppStateContext</code> and used across pages via a shared <code>usePolling</code>{" "}
            hook.
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Badge tone="neutral" ariaLabel="Dashboard polling interval">
              dashboard: {Math.round(pollingIntervals.dashboardTelemetryMs / 1000)}s
            </Badge>
            <Badge tone="neutral" ariaLabel="Alerts polling interval">
              alerts: {Math.round(pollingIntervals.alertsListMs / 1000)}s
            </Badge>
            <Badge tone="neutral" ariaLabel="Assets polling interval">
              assets: {Math.round(pollingIntervals.assetsDetailMs / 1000)}s
            </Badge>
          </div>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontWeight: 900, fontSize: 13 }}>Health</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Badge tone={healthTone} ariaLabel="Health status">
              status: {health.status}
            </Badge>
            <Badge tone="neutral" ariaLabel="Last health check time">
              last: {health.lastCheckedAtIso || "—"}
            </Badge>
            {health.error ? (
              <Badge tone="error" ariaLabel="Health error">
                error: {health.error}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}
