/**
 * Environment / runtime configuration helpers.
 * CRA exposes variables prefixed with REACT_APP_ at build time.
 */

/**
 * PUBLIC_INTERFACE
 * Returns a user-friendly environment label for display in the UI.
 * Prefers REACT_APP_ENV, then NODE_ENV, then "development".
 * @returns {string}
 */
export function getEnvironmentLabel() {
  const custom = (process.env.REACT_APP_ENV || "").trim();
  const env = custom || process.env.NODE_ENV || "development";
  return env.toUpperCase();
}

/**
 * PUBLIC_INTERFACE
 * Resolves the backend API base URL.
 *
 * Supported env vars (in priority order):
 * - REACT_APP_API_BASE_URL (requested by task)
 * - REACT_APP_API_BASE     (already present in container .env)
 * - REACT_APP_BACKEND_URL  (already present in container .env)
 *
 * If none are set, falls back to same-origin (empty string), which works
 * when the frontend is reverse-proxied behind the backend.
 *
 * @returns {string} Base URL without trailing slash, e.g. "https://host:3001"
 */
export function getApiBaseUrl() {
  const candidates = [
    process.env.REACT_APP_API_BASE_URL,
    process.env.REACT_APP_API_BASE,
    process.env.REACT_APP_BACKEND_URL,
  ];

  const raw = candidates.map((v) => (v || "").trim()).find(Boolean) || "";
  // Normalize trailing slash
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

/**
 * PUBLIC_INTERFACE
 * Returns a short object with env details for debugging/logging.
 * @returns {{ envLabel: string, apiBaseUrl: string }}
 */
export function getRuntimeConfig() {
  return {
    envLabel: getEnvironmentLabel(),
    apiBaseUrl: getApiBaseUrl(),
  };
}
