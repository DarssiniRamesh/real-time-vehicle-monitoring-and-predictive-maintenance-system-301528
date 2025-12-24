import { useEffect, useRef } from "react";

/**
 * PUBLIC_INTERFACE
 * useInterval runs a callback every `delayMs` while enabled.
 * @param {() => void} callback
 * @param {number|null} delayMs - set to null to disable
 */
export function useInterval(callback, delayMs) {
  const cbRef = useRef(callback);

  useEffect(() => {
    cbRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delayMs === null || delayMs === undefined) return undefined;
    const id = window.setInterval(() => cbRef.current(), delayMs);
    return () => window.clearInterval(id);
  }, [delayMs]);
}
