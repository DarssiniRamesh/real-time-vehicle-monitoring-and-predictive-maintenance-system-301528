/**
 * Telemetry helpers for working with the API's flattened telemetry points.
 */

/**
 * PUBLIC_INTERFACE
 * Return points for a specific key, sorted by timestamp ascending.
 * @param {Array<{timestamp: string, key: string, value: number}>|null|undefined} points
 * @param {string} key
 * @returns {Array<{timestamp: string, key: string, value: number}>}
 */
export function selectKeyPoints(points, key) {
  if (!Array.isArray(points) || !key) return [];
  return points
    .filter((p) => p && p.key === key && typeof p.value === "number" && p.timestamp)
    .slice()
    .sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
}

/**
 * PUBLIC_INTERFACE
 * Get the latest numeric value for a key from a flattened points array.
 * @param {Array<{timestamp: string, key: string, value: number}>|null|undefined} points
 * @param {string} key
 * @returns {{ value: number|null, timestamp: string|null }}
 */
export function getLatestValue(points, key) {
  const arr = selectKeyPoints(points, key);
  if (!arr.length) return { value: null, timestamp: null };
  const last = arr[arr.length - 1];
  return { value: typeof last.value === "number" ? last.value : null, timestamp: last.timestamp || null };
}

/**
 * PUBLIC_INTERFACE
 * Compute average for a key within a trailing time window.
 * @param {Array<{timestamp: string, key: string, value: number}>|null|undefined} points
 * @param {string} key
 * @param {number} windowMs - e.g. 5 * 60_000
 * @param {string|null|undefined} [nowIso] - defaults to Date.now()
 * @returns {{ avg: number|null, count: number }}
 */
export function getWindowAverage(points, key, windowMs, nowIso) {
  const arr = selectKeyPoints(points, key);
  if (!arr.length) return { avg: null, count: 0 };

  const now = nowIso ? new Date(nowIso) : new Date();
  const nowMs = now.getTime();
  if (Number.isNaN(nowMs)) return { avg: null, count: 0 };

  const startMs = nowMs - windowMs;

  let sum = 0;
  let count = 0;
  for (const p of arr) {
    const t = new Date(p.timestamp).getTime();
    if (Number.isNaN(t)) continue;
    if (t < startMs || t > nowMs) continue;
    sum += p.value;
    count += 1;
  }

  if (!count) return { avg: null, count: 0 };
  return { avg: sum / count, count };
}
