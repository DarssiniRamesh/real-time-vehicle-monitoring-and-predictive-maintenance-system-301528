import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "mockMode";

/**
 * PUBLIC_INTERFACE
 * useMockSwitch reads mock-mode from (in priority order):
 *  1) localStorage "mockMode" if set
 *  2) REACT_APP_MOCK env var ("1"/"true"/"yes"/"on")
 *
 * It also returns a setter and a toggle to allow runtime switching.
 *
 * @returns {{ mockMode: boolean, setMockMode: (next: boolean) => void, toggleMockMode: () => void }}
 */
export function useMockSwitch() {
  const envDefault = useMemo(() => {
    const raw = String(process.env.REACT_APP_MOCK || "").trim().toLowerCase();
    return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
  }, []);

  const [mockMode, setMockModeState] = useState(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === null) return envDefault;
      return stored === "1";
    } catch {
      return envDefault;
    }
  });

  const setMockMode = useCallback((next) => {
    const val = Boolean(next);
    setMockModeState(val);
    try {
      window.localStorage.setItem(STORAGE_KEY, val ? "1" : "0");
    } catch {
      // ignore storage failures (private mode, etc.)
    }
  }, []);

  const toggleMockMode = useCallback(() => {
    setMockMode((prev) => !prev);
  }, [setMockMode]);

  // Keep in sync across tabs/windows.
  useEffect(() => {
    function onStorage(e) {
      if (e.key !== STORAGE_KEY) return;
      setMockModeState(e.newValue === "1");
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return { mockMode, setMockMode, toggleMockMode };
}
