import { getApiBaseUrl } from "../config/env";

/**
 * @typedef {"none"|"min"|"max"|"avg"|"p50"|"p90"} TelemetryAgg
 */

/**
 * @typedef {object} AssetListItem
 * @property {string} id
 * @property {string} name
 * @property {string} type
 * @property {"active"|"inactive"} status
 */

/**
 * @typedef {object} TelemetryPoint
 * @property {string} timestamp - ISO datetime
 * @property {string} key
 * @property {number} value
 */

/**
 * @typedef {object} TelemetryQueryResponse
 * @property {string} asset_id
 * @property {string} from
 * @property {string} to
 * @property {TelemetryAgg} agg
 * @property {number|null|undefined} interval
 * @property {TelemetryPoint[]} points
 */

/**
 * @typedef {object} AlertDTO
 * @property {string} id
 * @property {string} asset_id
 * @property {"critical"|"high"|"medium"|"low"} severity
 * @property {string} message
 * @property {"open"|"acked"|"closed"} state
 * @property {string} created_at
 * @property {string|null} [acked_at]
 * @property {string|null} [acked_by]
 * @property {string|null} [ack_comment]
 */

/**
 * @typedef {object} AlertListResponse
 * @property {number} total
 * @property {AlertDTO[]} items
 */

/**
 * @typedef {object} AlertAckRequest
 * @property {string[]} ids
 * @property {string} [acked_by]
 * @property {string} [ack_comment]
 */

/**
 * @typedef {object} AlertAckResponse
 * @property {AlertDTO[]} updated
 * @property {string[]} not_found
 */

/**
 * @typedef {object} PredictionRequest
 * @property {string} [asset_id]
 * @property {string} [timestamp] - ISO datetime
 * @property {Record<string, any>} [readings]
 */

/**
 * @typedef {object} PredictionResult
 * @property {string} asset_id
 * @property {number} risk_score
 * @property {string} severity
 * @property {string} recommendation
 * @property {string} inferred_at
 * @property {string|null} [used_timestamp]
 */

/**
 * @typedef {object} PredictionThresholds
 * @property {number} temperature_warn_c
 * @property {number} temperature_crit_c
 * @property {number} vibration_warn
 * @property {number} vibration_crit
 */

/**
 * @typedef {object} ModelMetadata
 * @property {string} name
 * @property {string} version
 * @property {string} strategy
 * @property {PredictionThresholds} thresholds
 * @property {string} updated_at
 */

/**
 * @typedef {object} SeedRequest
 * @property {number} [assets]
 * @property {number} [points_per_asset]
 * @property {number} [lookback_minutes]
 */

/**
 * @typedef {object} SeedResponse
 * @property {number} assets_created
 * @property {number} telemetry_inserted
 * @property {string[]} asset_ids
 */

/**
 * @typedef {object} SimulationStartRequest
 * @property {string[]} [asset_ids]
 */

/**
 * @typedef {object} SimulationStatusResponse
 * @property {boolean} running
 * @property {boolean} enabled_by_env
 * @property {number} interval_seconds_min
 * @property {number} interval_seconds_max
 */

/**
 * ApiError is thrown on non-2xx responses and on parsing errors.
 */
export class ApiError extends Error {
  /**
   * @param {object} args
   * @param {string} args.message
   * @param {number} [args.status]
   * @param {string} [args.url]
   * @param {any} [args.details]
   * @param {string} [args.code]
   */
  constructor({ message, status, url, details, code }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.url = url;
    this.details = details;
    this.code = code;
  }
}

const DEFAULT_TIMEOUT_MS = 12_000;

/**
 * Build a query string, skipping null/undefined/empty-string.
 * @param {Record<string, any>} params
 * @returns {string}
 */
function toQueryString(params) {
  const sp = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (typeof v === "string" && v.trim() === "") return;
    sp.set(k, String(v));
  });
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Safe JSON parse for responses that may be empty.
 * @param {Response} res
 * @returns {Promise<any>}
 */
async function parseJson(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new ApiError({
      message: "Failed to parse JSON response",
      status: res.status,
      url: res.url,
      details: { textSnippet: text.slice(0, 400) },
      code: "json_parse_error",
    });
  }
}

/**
 * Base request helper with timeout + consistent error handling.
 * @param {string} path - e.g. "/api/v1/assets"
 * @param {RequestInit & { timeoutMs?: number }} [options]
 * @returns {Promise<any>}
 */
async function request(path, options = {}) {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${path}`;

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(options.headers || {}),
      },
    });

    const data = await parseJson(res);

    if (!res.ok) {
      // Backend error responses follow ErrorResponse: { error: { code, message, details }, status_code, request_id }
      const maybeError = data && data.error ? data.error : null;
      throw new ApiError({
        message: maybeError?.message || `Request failed with status ${res.status}`,
        status: res.status,
        url,
        details: maybeError?.details ?? data,
        code: maybeError?.code || "http_error",
      });
    }

    return data;
  } catch (e) {
    if (e?.name === "AbortError") {
      throw new ApiError({ message: "Request timed out", status: 0, url, code: "timeout" });
    }
    if (e instanceof ApiError) throw e;
    throw new ApiError({
      message: e?.message || "Network request failed",
      status: 0,
      url,
      details: { original: String(e) },
      code: "network_error",
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

/**
 * PUBLIC_INTERFACE
 * Centralized API client.
 *
 * Usage examples:
 *   // List assets:
 *   const assets = await api.assets.list();
 *
 *   // Telemetry range:
 *   const series = await api.telemetry.get({
 *     assetId: "vehicle-001",
 *     from: new Date(Date.now()-3600_000).toISOString(),
 *     to: new Date().toISOString(),
 *     agg: "avg",
 *     interval: 60
 *   });
 *
 *   // Ack alerts:
 *   await api.alerts.ack({ ids: ["a1","a2"], acked_by: "frontend", ack_comment: "Reviewed" });
 */
export const api = {
  /**
   * PUBLIC_INTERFACE
   * Health call used to quickly validate connectivity at app startup.
   * Uses the backend versioned endpoint: GET /api/v1/health
   * @returns {Promise<any>}
   */
  healthCheck: async () => {
    return request("/api/v1/health", { method: "GET" });
  },

  assets: {
    /**
     * PUBLIC_INTERFACE
     * List available assets.
     * GET /api/v1/assets
     * @returns {Promise<AssetListItem[]>}
     */
    list: async () => {
      return request("/api/v1/assets", { method: "GET" });
    },
  },

  telemetry: {
    /**
     * PUBLIC_INTERFACE
     * Get telemetry points (raw or aggregated).
     * GET /api/v1/telemetry?assetId&from&to&agg&interval
     * @param {object} params
     * @param {string} params.assetId
     * @param {string} params.from - ISO datetime
     * @param {string} params.to - ISO datetime
     * @param {TelemetryAgg} [params.agg]
     * @param {number} [params.interval] - required when agg != "none"
     * @returns {Promise<TelemetryQueryResponse>}
     */
    get: async ({ assetId, from, to, agg = "none", interval } = {}) => {
      const qs = toQueryString({ assetId, from, to, agg, interval });
      return request(`/api/v1/telemetry${qs}`, { method: "GET" });
    },
  },

  alerts: {
    /**
     * PUBLIC_INTERFACE
     * List alerts with filtering/sorting/pagination.
     * GET /api/v1/alerts
     * @param {object} [params]
     * @param {string} [params.assetId]
     * @param {"critical"|"high"|"medium"|"low"} [params.severity]
     * @param {boolean} [params.acknowledged]
     * @param {string} [params.from] - ISO datetime
     * @param {string} [params.to] - ISO datetime
     * @param {string} [params.sort] - "<field>:<dir>"
     * @param {number} [params.offset]
     * @param {number} [params.limit]
     * @param {number} [params.page]
     * @returns {Promise<AlertListResponse>}
     */
    list: async (params = {}) => {
      const qs = toQueryString(params);
      return request(`/api/v1/alerts${qs}`, { method: "GET" });
    },

    /**
     * PUBLIC_INTERFACE
     * Bulk acknowledge alerts.
     * POST /api/v1/alerts/ack
     * @param {AlertAckRequest} body
     * @returns {Promise<AlertAckResponse>}
     */
    ack: async (body) => {
      return request("/api/v1/alerts/ack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
      });
    },
  },

  prediction: {
    /**
     * PUBLIC_INTERFACE
     * Run baseline prediction.
     * POST /api/v1/predict
     * @param {PredictionRequest} body
     * @returns {Promise<PredictionResult>}
     */
    predict: async (body) => {
      return request("/api/v1/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
      });
    },
  },

  model: {
    /**
     * PUBLIC_INTERFACE
     * Fetch model diagnostics/metadata (rule-based).
     * GET /api/v1/model
     * @returns {Promise<ModelMetadata>}
     */
    get: async () => {
      return request("/api/v1/model", { method: "GET" });
    },
  },

  seed: {
    /**
     * PUBLIC_INTERFACE
     * Seed demo assets + telemetry.
     * POST /api/v1/seed
     * @param {SeedRequest} body
     * @returns {Promise<SeedResponse>}
     */
    run: async (body) => {
      return request("/api/v1/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
      });
    },
  },

  simulator: {
    /**
     * PUBLIC_INTERFACE
     * Start telemetry simulator.
     * POST /api/v1/simulate/start
     * @param {SimulationStartRequest} body
     * @returns {Promise<SimulationStatusResponse>}
     */
    start: async (body) => {
      return request("/api/v1/simulate/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
      });
    },

    /**
     * PUBLIC_INTERFACE
     * Stop telemetry simulator.
     * POST /api/v1/simulate/stop
     * @returns {Promise<SimulationStatusResponse>}
     */
    stop: async () => {
      return request("/api/v1/simulate/stop", { method: "POST" });
    },
  },
};
