import { useEffect, useRef } from "react";

/**
 * PUBLIC_INTERFACE
 * usePolling runs `fn` immediately (on mount / dependency change) and then
 * repeatedly every `intervalMs` milliseconds. Pass `null` to disable polling.
 *
 * - Supports async functions; avoids overlapping executions.
 * - Cancels state updates by using an internal "isMounted" guard.
 *
 * @param {() => (void|Promise<void>)} fn
 * @param {number|null|undefined} intervalMs
 */
export function usePolling(fn, intervalMs) {
  const fnRef = useRef(fn);
  const runningRef = useRef(false);
  const mountedRef = useRef(false);

  // Keep latest fn without re-subscribing the interval.
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (intervalMs === null || intervalMs === undefined) return;

    let timerId = null;

    async function tick() {
      if (!mountedRef.current) return;
      if (runningRef.current) return;

      runningRef.current = true;
      try {
        await fnRef.current?.();
      } finally {
        runningRef.current = false;
      }
    }

    // Immediate run, then interval.
    tick();
    timerId = window.setInterval(tick, Math.max(250, Number(intervalMs) || 0));

    return () => {
      if (timerId) window.clearInterval(timerId);
    };
  }, [intervalMs]);
}
