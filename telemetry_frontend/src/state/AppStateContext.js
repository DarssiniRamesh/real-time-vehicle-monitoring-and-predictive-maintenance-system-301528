import React, { createContext, useContext, useMemo } from "react";
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
 * @typedef {object} AppState
 * @property {string} apiBaseUrl
 * @property {PollingIntervals} pollingIntervals
 * @property {boolean} mockMode
 * @property {(next: boolean) => void} setMockMode
 * @property {() => void} toggleMockMode
 * @property {ReturnType<import("../api/client").getApi>} api
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
 * - apiBaseUrl
 * - pollingIntervals
 * - mockMode (env/localStorage driven)
 * - api client instance (real or mock) via getApi({ mockMode })
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

  const value = useMemo(() => {
    return {
      apiBaseUrl,
      pollingIntervals,
      mockMode,
      setMockMode,
      toggleMockMode,
      api,
    };
  }, [api, apiBaseUrl, mockMode, pollingIntervals, setMockMode, toggleMockMode]);

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
