import { useEffect, useRef } from "react";

/**
 * @typedef {object} UsePollingOptions
 * @property {() => void} [onTickStart]
 * @property {() => void} [onTickEnd]
 * @property {(err: any) => void} [onTickError]
 */

/**
 * PUBLIC_INTERFACE
 * usePolling runs `fn` immediately (on mount / dependency change) and then
 * repeatedly every `intervalMs` milliseconds. Pass `null` to disable polling.
 *
 * - Supports async functions; avoids overlapping executions.
 * - Ensures cleanup on route changes to prevent duplicate intervals/leaks.
 *
 * @param {() => (void|Promise<void>)} fn
 * @param {number|null|undefined} intervalMs
 * @param {UsePollingOptions} [options]
 */
export function usePolling(fn, intervalMs, options) {
  const fnRef = useRef(fn);
  const runningRef = useRef(false);
  const mountedRef = useRef(false);

  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

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
      optionsRef.current?.onTickStart?.();

      try {
        await fnRef.current?.();
        optionsRef.current?.onTickEnd?.();
      } catch (err) {
        optionsRef.current?.onTickError?.(err);
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
