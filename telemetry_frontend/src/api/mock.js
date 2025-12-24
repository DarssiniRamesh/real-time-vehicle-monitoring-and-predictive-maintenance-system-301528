/**
 * Mock API client that mirrors the real API client signatures.
 * Used when REACT_APP_MOCK or localStorage mockMode is enabled.
 */

/**
 * @typedef {import("./client").ApiError} ApiError
 */

// Small deterministic PRNG for stable demo data.
function mulberry32(seed) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function iso(d) {
  return d.toISOString();
}

function pick(arr, r) {
  return arr[Math.floor(r() * arr.length)];
}

function mkId(prefix, n) {
  return `${prefix}-${String(n).padStart(3, "0")}`;
}

function severityFromRisk(risk) {
  if (risk >= 0.8) return "high";
  if (risk >= 0.55) return "medium";
  return "low";
}

function alertSeverityFromRisk(risk) {
  if (risk >= 0.9) return "critical";
  if (risk >= 0.75) return "high";
  if (risk >= 0.55) return "medium";
  return "low";
}

// In-memory mock store (persists for the session).
const store = (() => {
  const now = Date.now();
  const baseSeed = Math.floor(now / (1000 * 60 * 30)); // stable-ish per 30 minutes
  const r = mulberry32(baseSeed);

  const assetTypes = ["Vehicle", "Excavator", "Forklift", "Turbine", "Pump"];
  const assets = Array.from({ length: 8 }, (_, i) => {
    const id = mkId("vehicle", i + 1);
    return {
      id,
      name: `Asset ${i + 1}`,
      type: pick(assetTypes, r),
      status: r() > 0.15 ? "active" : "inactive",
    };
  });

  /** @type {Array<any>} */
  let alerts = [];
  let alertSeq = 1;

  function maybeGenerateAlerts() {
    // generate a few alerts each time to simulate activity
    const count = Math.floor(r() * 3); // 0..2
    const nowIso = new Date().toISOString();
    for (let i = 0; i < count; i++) {
      const asset = pick(assets, r);
      const risk = r();
      const sev = alertSeverityFromRisk(risk);
      alerts.unshift({
        id: `a-${alertSeq++}`,
        asset_id: asset.id,
        severity: sev,
        message:
          sev === "critical"
            ? "Critical anomaly detected: immediate maintenance recommended."
            : sev === "high"
              ? "High risk trend detected: inspect soon."
              : sev === "medium"
                ? "Moderate risk: monitor closely."
                : "Low risk warning: routine check.",
        state: "open",
        created_at: nowIso,
        acked_at: null,
        acked_by: null,
        ack_comment: null,
      });
    }

    // Cap store
    if (alerts.length > 250) alerts = alerts.slice(0, 250);
  }

  // prime some alerts
  for (let i = 0; i < 10; i++) maybeGenerateAlerts();

  return {
    assets,
    get alerts() {
      maybeGenerateAlerts();
      return alerts;
    },
    ack(ids, acked_by, ack_comment) {
      const nowIso = new Date().toISOString();
      const updated = [];
      const not_found = [];

      ids.forEach((id) => {
        const idx = alerts.findIndex((a) => a.id === id);
        if (idx === -1) {
          not_found.push(id);
          return;
        }
        const a = alerts[idx];
        const next = {
          ...a,
          state: "acked",
          acked_at: nowIso,
          acked_by: acked_by || "mock",
          ack_comment: ack_comment || null,
        };
        alerts[idx] = next;
        updated.push(next);
      });

      return { updated, not_found };
    },
  };
})();

/**
 * PUBLIC_INTERFACE
 * createMockApi returns an object with the same shape as the real api client.
 * @returns {any}
 */
export function createMockApi() {
  return {
    healthCheck: async () => {
      return { status: "ok", mock: true, ts: new Date().toISOString() };
    },

    assets: {
      list: async () => {
        // Slightly jitter statuses over time.
        const r = mulberry32(Math.floor(Date.now() / (1000 * 15)));
        return store.assets.map((a) => ({
          ...a,
          status: r() > 0.1 ? a.status : a.status === "active" ? "inactive" : "active",
        }));
      },
    },

    telemetry: {
      get: async ({ assetId, from, to, agg = "none", interval } = {}) => {
        const fromD = new Date(from || Date.now() - 30 * 60_000);
        const toD = new Date(to || Date.now());
        const spanMs = Math.max(1, toD.getTime() - fromD.getTime());

        const stepSec = agg === "none" ? 30 : Number(interval) || 60;
        const steps = clamp(Math.floor(spanMs / (stepSec * 1000)), 5, 200);

        const seed = (assetId || "asset").split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) + steps;
        const r = mulberry32(seed);

        const keys = ["temperature_c", "vibration", "pressure", "rpm", "speed_kph"];
        const base = {
          temperature_c: 65 + r() * 10,
          vibration: 0.2 + r() * 0.5,
          pressure: 2.2 + r() * 0.7,
          rpm: 1100 + r() * 400,
          speed_kph: 40 + r() * 30,
        };

        /** @type {Array<{timestamp:string,key:string,value:number}>} */
        const points = [];
        for (let i = 0; i <= steps; i++) {
          const t = new Date(fromD.getTime() + (i / steps) * spanMs);
          const drift = (i / steps) * 2 - 1; // [-1..1]
          keys.forEach((k) => {
            const noise = (r() - 0.5) * (k === "rpm" ? 80 : k === "speed_kph" ? 8 : k === "temperature_c" ? 1.2 : 0.06);
            const wave = Math.sin((i / steps) * Math.PI * 2) * (k === "rpm" ? 60 : k === "speed_kph" ? 5 : k === "temperature_c" ? 0.6 : 0.04);
            const val = base[k] + noise + wave + drift * (k === "temperature_c" ? 0.9 : 0.0);
            points.push({ timestamp: iso(t), key: k, value: Number(val.toFixed(3)) });
          });
        }

        return {
          asset_id: assetId || "",
          from: iso(fromD),
          to: iso(toD),
          agg,
          interval: agg === "none" ? undefined : stepSec,
          points,
        };
      },
    },

    alerts: {
      list: async (params = {}) => {
        const all = store.alerts;

        const assetId = params.assetId ?? null;
        const severity = params.severity ?? null;
        const acknowledged = params.acknowledged ?? null;
        const from = params.from ? new Date(params.from) : null;
        const to = params.to ? new Date(params.to) : null;

        let items = all.slice();

        if (assetId) items = items.filter((a) => a.asset_id === assetId);
        if (severity) items = items.filter((a) => a.severity === severity);
        if (acknowledged !== null && acknowledged !== undefined) {
          items = items.filter((a) => (acknowledged ? a.state === "acked" || a.acked_at : a.state !== "acked" && !a.acked_at));
        }
        if (from && !Number.isNaN(from.getTime())) {
          items = items.filter((a) => new Date(a.created_at).getTime() >= from.getTime());
        }
        if (to && !Number.isNaN(to.getTime())) {
          items = items.filter((a) => new Date(a.created_at).getTime() <= to.getTime());
        }

        // sort: "<field>:<dir>"
        const sort = params.sort || "created_at:desc";
        const [field, dir] = String(sort).split(":");
        const sign = dir === "asc" ? 1 : -1;

        const keyFn = (a) => {
          if (field === "severity") return a.severity;
          if (field === "asset_id") return a.asset_id;
          return a.created_at;
        };

        items.sort((a, b) => {
          const ka = keyFn(a);
          const kb = keyFn(b);
          if (ka < kb) return -1 * sign;
          if (ka > kb) return 1 * sign;
          return 0;
        });

        const limit = Number(params.limit) || 50;
        const page = Number(params.page) || null;
        const offset = page ? (Math.max(1, page) - 1) * limit : Number(params.offset) || 0;

        const paged = items.slice(offset, offset + limit);
        return { total: items.length, items: paged };
      },

      ack: async (body) => {
        const ids = Array.isArray(body?.ids) ? body.ids : [];
        return store.ack(ids, body?.acked_by, body?.ack_comment);
      },
    },

    prediction: {
      predict: async (body) => {
        const assetId = body?.asset_id || "unknown";
        const seed = assetId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) + Math.floor(Date.now() / (1000 * 30));
        const r = mulberry32(seed);

        const risk = clamp(0.15 + r() * 0.8, 0, 1);
        const severity = severityFromRisk(risk);

        return {
          asset_id: assetId,
          risk_score: Number(risk.toFixed(3)),
          severity: severity.toUpperCase(),
          recommendation:
            severity === "high"
              ? "Schedule maintenance within 24 hours; inspect temperature and vibration trends."
              : severity === "medium"
                ? "Plan inspection within 7 days; monitor vibration increases."
                : "Continue normal operation; monitor for deviations.",
          inferred_at: new Date().toISOString(),
          used_timestamp: body?.timestamp || null,
        };
      },
    },

    model: {
      get: async () => {
        return {
          name: "mock-rule-based",
          version: "0.0.0-mock",
          strategy: "rule-based",
          thresholds: {
            temperature_warn_c: 80,
            temperature_crit_c: 92,
            vibration_warn: 0.7,
            vibration_crit: 1.0,
          },
          updated_at: new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString(),
        };
      },
    },

    seed: {
      run: async (body) => {
        const assets = Number(body?.assets) || 5;
        const points = Number(body?.points_per_asset) || 30;
        return {
          assets_created: Math.max(0, assets - store.assets.length),
          telemetry_inserted: assets * points,
          asset_ids: store.assets.map((a) => a.id),
        };
      },
    },

    simulator: {
      start: async () => {
        return {
          running: true,
          enabled_by_env: true,
          interval_seconds_min: 2,
          interval_seconds_max: 5,
        };
      },
      stop: async () => {
        return {
          running: false,
          enabled_by_env: true,
          interval_seconds_min: 2,
          interval_seconds_max: 5,
        };
      },
    },
  };
}
