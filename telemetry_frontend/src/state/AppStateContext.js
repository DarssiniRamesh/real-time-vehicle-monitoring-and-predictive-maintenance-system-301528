import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getApiBaseUrl } from "../config/env";
import { getApi } from "../api/client";
import { useMockSwitch } from "../hooks/useMockSwitch";

/**
 * @typedef {object} PollingIntervals
 * @property {number} dashboardTelemetryMs
 * @property {number} alertsListMs
 * @property {number} assetsDetailMs
 */

/**
 * @typedef {"unknown"|"ok"|"error"} HealthStatus
 */

/**
 * @typedef {object} HealthState
 * @property {HealthStatus} status
 * @property {string|null} lastCheckedAtIso
 * @property {string|null} error
 */

/**
 * @typedef {object} PollingMeta
 * @property {boolean} running
 * @property {string|null} lastRefreshAtIso
 * @property {string|null} lastError
 */

/**
 * @typedef {Record<string, PollingMeta>} PollingMetaMap
 */

/**
 * @typedef {object} AppState
 * @property {string} apiBaseUrl
 * @property {PollingIntervals} pollingIntervals
 * @property {boolean} mockMode
 * @property {(next: boolean) => void} setMockMode
 * @property {() => void} toggleMockMode
 * @property {ReturnType<import("../api/client").getApi>} api
 * @property {HealthState} health
 * @property {() => Promise<void>} runHealthCheck
 * @property {PollingMetaMap} pollingMeta
 * @property {(key: string, next: Partial<PollingMeta>) => void} setPollingMeta
 */

const AppStateContext = createContext(null);

function readPollIntervalMs() {
  const raw = String(process.env.REACT_APP_POLL_INTERVAL_MS || "").trim();
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 20_000;
  return Math.max(2_000, Math.floor(n));
}

/**
 * PUBLIC_INTERFACE
 * AppStateProvider provides centralized runtime config/state:
 * - current API instance (real/mock) + base URL
 * - centralized polling intervals
 * - persisted mockMode toggle (localStorage)
 * - connectivity/health status (checked on start + when switching clients)
 * - shared polling metadata for small UI indicators (last refresh / running)
 *
 * @param {{ children: React.ReactNode }} props
 */
export function AppStateProvider({ children }) {
  const apiBaseUrl = getApiBaseUrl();
  const basePoll = readPollIntervalMs();

  const { mockMode, setMockMode, toggleMockMode } = useMockSwitch();

  const pollingIntervals = useMemo(() => {
    // Keep defaults aligned with current behavior; allow tuning via REACT_APP_POLL_INTERVAL_MS.
    return {
      dashboardTelemetryMs: basePoll,
      alertsListMs: Math.max(10_000, basePoll * 2),
      assetsDetailMs: Math.max(15_000, basePoll * 2),
    };
  }, [basePoll]);

  const api = useMemo(() => {
    return getApi({ mockMode, baseUrl: apiBaseUrl });
  }, [apiBaseUrl, mockMode]);

  const [health, setHealth] = useState(
    /** @type {HealthState} */ ({
      status: "unknown",
      lastCheckedAtIso: null,
      error: null,
    })
  );

  const [pollingMeta, setPollingMetaState] = useState(
    /** @type {PollingMetaMap} */ ({})
  );

  const setPollingMeta = useCallback((key, next) => {
    if (!key) return;
    setPollingMetaState((prev) => {
      const current = prev[key] || { running: false, lastRefreshAtIso: null, lastError: null };
      return { ...prev, [key]: { ...current, ...next } };
    });
  }, []);

  const runHealthCheck = useCallback(async () => {
    setHealth((prev) => ({ ...prev, error: null }));
    try {
      await api.healthCheck();
      setHealth({ status: "ok", lastCheckedAtIso: new Date().toISOString(), error: null });
    } catch (e) {
      setHealth({
        status: "error",
        lastCheckedAtIso: new Date().toISOString(),
        error: e?.message || "Health check failed",
      });
    }
  }, [api]);

  // Health check at app start + whenever API client switches (mock/real, or base URL change).
  useEffect(() => {
    runHealthCheck();
  }, [runHealthCheck]);

  const value = useMemo(() => {
    return {
      apiBaseUrl,
      pollingIntervals,
      mockMode,
      setMockMode,
      toggleMockMode,
      api,
      health,
      runHealthCheck,
      pollingMeta,
      setPollingMeta,
    };
  }, [
    api,
    apiBaseUrl,
    health,
    mockMode,
    pollingIntervals,
    pollingMeta,
    runHealthCheck,
    setMockMode,
    setPollingMeta,
    toggleMockMode,
  ]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

/**
 * PUBLIC_INTERFACE
 * useAppState returns the centralized AppState context.
 * @returns {AppState}
 */
export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error("useAppState must be used within an AppStateProvider");
  }
  return ctx;
}
