import React, { useCallback, useMemo, useRef, useState } from "react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState, ErrorState } from "../components/ui/States";
import { TableSkeleton } from "../components/ui/TableSkeleton";
import styles from "./pages.module.css";
import { formatDateTime } from "../utils/format";
import { usePolling } from "../hooks/usePolling";
import { useAppState } from "../state/AppStateContext";
import { PollingIndicator } from "../components/ui/PollingIndicator";

/**
 * @param {"critical"|"high"|"medium"|"low"|string} severity
 */
function severityTone(severity) {
  const s = String(severity || "").toLowerCase();
  if (s === "critical" || s === "high") return "error";
  if (s === "medium") return "warning";
  if (s === "low") return "success";
  return "neutral";
}

function nextSort(sort, field) {
  // cycles: none -> desc -> asc -> none
  if (!sort) return `${field}:desc`;
  const [f, dir] = sort.split(":");
  if (f !== field) return `${field}:desc`;
  if (dir === "desc") return `${field}:asc`;
  return null;
}

function ariaSortFor(sort, field) {
  if (!sort) return "none";
  const [f, dir] = sort.split(":");
  if (f !== field) return "none";
  return dir === "asc" ? "ascending" : "descending";
}

/**
 * PUBLIC_INTERFACE
 * AlertsPage lists alerts with filtering/sorting/pagination and bulk acknowledgement.
 */
export function AlertsPage() {
  const { api, pollingIntervals, setPollingMeta } = useAppState();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);

  // Server-side filters
  const [severity, setSeverity] = useState("");
  const [assetId, setAssetId] = useState("");
  const [acknowledged, setAcknowledged] = useState(""); // "", "true", "false"
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Server-side sorting/pagination
  const [sort, setSort] = useState("created_at:desc");
  const [page, setPage] = useState(1);
  const limit = 25;

  // Selection + bulk ack
  const [selected, setSelected] = useState(() => new Set());
  const [isAcking, setIsAcking] = useState(false);

  const tableRef = useRef(null);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const res = await api.alerts.list({
        severity: severity || null,
        assetId: assetId || null,
        acknowledged: acknowledged === "" ? null : acknowledged === "true",
        from: from || null,
        to: to || null,
        sort: sort || null,
        page,
        limit,
      });

      setItems(res.items || []);
      setTotal(res.total || 0);
      setSelected(new Set());
    } catch (e) {
      setError(e?.message || "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  }, [acknowledged, assetId, from, limit, page, severity, sort, to]);

  React.useEffect(() => {
    load();
  }, [load]);

  // Centralized polling for the current filter/sort/page view.
  // Avoid polling while bulk-ack is in progress to prevent UI thrash.
  usePolling(
    () => {
      if (isAcking) return;
      return load();
    },
    pollingIntervals.alertsListMs,
    {
      onTickStart: () => setPollingMeta("alerts", { running: true, lastError: null }),
      onTickEnd: () =>
        setPollingMeta("alerts", { running: false, lastRefreshAtIso: new Date().toISOString(), lastError: null }),
      onTickError: (err) =>
        setPollingMeta("alerts", { running: false, lastError: err?.message || "Polling failed" }),
    }
  );

  const pageCount = Math.max(1, Math.ceil(total / limit));
  const selectedCount = selected.size;

  const allVisibleIds = useMemo(() => items.map((a) => a.id), [items]);
  const allSelectedOnPage = useMemo(() => allVisibleIds.length > 0 && allVisibleIds.every((id) => selected.has(id)), [
    allVisibleIds,
    selected,
  ]);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelectedOnPage) {
        allVisibleIds.forEach((id) => next.delete(id));
      } else {
        allVisibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [allSelectedOnPage, allVisibleIds]);

  const toggleOne = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const ackSelected = useCallback(async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;

    setIsAcking(true);
    setError("");

    // Optimistic UI: mark selected rows as acked immediately.
    const nowIso = new Date().toISOString();
    const prevItems = items;

    setItems((curr) =>
      curr.map((a) => {
        if (!selected.has(a.id)) return a;
        return {
          ...a,
          state: "acked",
          acked_at: nowIso,
          acked_by: "frontend",
        };
      })
    );

    try {
      await api.alerts.ack({ ids, acked_by: "frontend", ack_comment: "Acknowledged from dashboard" });
      setSelected(new Set());
      // Refresh current page to reconcile totals and server truth.
      await load();
    } catch (e) {
      // Revert optimistic update on failure.
      setItems(prevItems);
      setError(e?.message || "Failed to acknowledge alerts");
    } finally {
      setIsAcking(false);
    }
  }, [items, load, selected]);

  const onTableKeyDown = useCallback(
    (e) => {
      const key = e.key;

      // Toggle selection on focused row via Space/Enter.
      if (key === " " || key === "Enter") {
        const active = document.activeElement;
        const row = active?.closest?.("tr[data-alertid]");
        if (!row) return;
        const id = row.getAttribute("data-alertid");
        if (!id) return;
        e.preventDefault();
        toggleOne(id);
        return;
      }

      // Keyboard navigation between rows.
      if (key !== "ArrowDown" && key !== "ArrowUp") return;

      const active = document.activeElement;
      const row = active?.closest?.("tr[data-rowindex]");
      if (!row) return;

      e.preventDefault();
      const idx = Number(row.getAttribute("data-rowindex"));
      const nextIdx = key === "ArrowDown" ? idx + 1 : idx - 1;

      const nextRow = tableRef.current?.querySelector?.(`tr[data-rowindex="${nextIdx}"]`);
      const focusTarget = nextRow?.querySelector?.('button, input, a, [tabindex="0"]') || nextRow;
      if (focusTarget && typeof focusTarget.focus === "function") focusTarget.focus();
    },
    [toggleOne]
  );

  const tableActions = (
    <div className={styles.controlsRow}>
      <PollingIndicator pollingKey="alerts" label={`poll ${Math.round(pollingIntervals.alertsListMs / 1000)}s`} />
      <Button variant="secondary" ariaLabel="Reload alerts" onClick={() => load()} disabled={loading || isAcking}>
        Reload
      </Button>
      <Button
        variant="primary"
        ariaLabel="Acknowledge selected alerts"
        onClick={ackSelected}
        isLoading={isAcking}
        disabled={selectedCount === 0}
      >
        Acknowledge ({selectedCount})
      </Button>
    </div>
  );

  return (
    <Card title="Alerts" actions={tableActions}>
      <div style={{ display: "grid", gap: 14 }}>
        <div className={styles.controlsRow} aria-label="Alert filters">
          <div className={styles.controlGroup}>
            <label className={styles.controlLabel} htmlFor="severityFilter">
              Severity
            </label>
            <select
              id="severityFilter"
              className={styles.select}
              value={severity}
              onChange={(e) => {
                setPage(1);
                setSeverity(e.target.value);
              }}
              aria-label="Filter by severity"
            >
              <option value="">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div className={styles.controlGroup}>
            <label className={styles.controlLabel} htmlFor="assetFilter">
              Asset
            </label>
            <input
              id="assetFilter"
              className={styles.input}
              value={assetId}
              onChange={(e) => {
                setPage(1);
                setAssetId(e.target.value);
              }}
              placeholder="asset id…"
              aria-label="Filter by asset id"
            />
          </div>

          <div className={styles.controlGroup}>
            <label className={styles.controlLabel} htmlFor="ackFilter">
              Acknowledged
            </label>
            <select
              id="ackFilter"
              className={styles.select}
              value={acknowledged}
              onChange={(e) => {
                setPage(1);
                setAcknowledged(e.target.value);
              }}
              aria-label="Filter by acknowledged state"
            >
              <option value="">All</option>
              <option value="false">Unacknowledged</option>
              <option value="true">Acknowledged</option>
            </select>
          </div>

          <div className={styles.controlGroup}>
            <label className={styles.controlLabel} htmlFor="fromFilter">
              From (UTC ISO)
            </label>
            <input
              id="fromFilter"
              className={styles.input}
              value={from}
              onChange={(e) => {
                setPage(1);
                setFrom(e.target.value);
              }}
              placeholder="2025-12-24T00:00:00Z"
              aria-label="Filter from timestamp (ISO 8601)"
            />
          </div>

          <div className={styles.controlGroup}>
            <label className={styles.controlLabel} htmlFor="toFilter">
              To (UTC ISO)
            </label>
            <input
              id="toFilter"
              className={styles.input}
              value={to}
              onChange={(e) => {
                setPage(1);
                setTo(e.target.value);
              }}
              placeholder="2025-12-24T23:59:59Z"
              aria-label="Filter to timestamp (ISO 8601)"
            />
          </div>

          <Button variant="ghost" ariaLabel="Apply filters" onClick={() => load()} disabled={loading || isAcking}>
            Apply
          </Button>
        </div>

        {loading ? (
          <>
            <TableSkeleton rows={6} columns={6} />
            <div style={{ color: "var(--color-muted)", fontSize: 13 }}>Loading alerts…</div>
          </>
        ) : error ? (
          <ErrorState title="Alerts failed to load" hint={error} onRetry={() => load()} />
        ) : items.length === 0 ? (
          <EmptyState
            title="No alerts found"
            hint="Try clearing filters, or start the backend simulator to generate alerts."
            action={
              <Button variant="secondary" ariaLabel="Reload alerts" onClick={() => load()}>
                Reload
              </Button>
            }
          />
        ) : (
          <>
            <div className={styles.tableWrap} aria-label="Alerts table">
              <table ref={tableRef} className={styles.table} onKeyDown={onTableKeyDown}>
                <thead>
                  <tr>
                    <th className={styles.th} style={{ width: 44 }} scope="col">
                      <input
                        className={styles.checkbox}
                        type="checkbox"
                        checked={allSelectedOnPage}
                        onChange={toggleAll}
                        aria-label="Select all alerts on this page"
                      />
                    </th>

                    <th className={styles.th} scope="col" aria-sort={ariaSortFor(sort, "created_at")}>
                      <button
                        type="button"
                        className="iconButton"
                        style={{ padding: "8px 10px" }}
                        onClick={() => {
                          setPage(1);
                          setSort((s) => nextSort(s, "created_at"));
                        }}
                        aria-label="Sort by created time"
                      >
                        Time
                      </button>
                    </th>

                    <th className={styles.th} scope="col" aria-sort={ariaSortFor(sort, "severity")}>
                      <button
                        type="button"
                        className="iconButton"
                        style={{ padding: "8px 10px" }}
                        onClick={() => {
                          setPage(1);
                          setSort((s) => nextSort(s, "severity"));
                        }}
                        aria-label="Sort by severity"
                      >
                        Severity
                      </button>
                    </th>

                    <th className={styles.th} scope="col" aria-sort={ariaSortFor(sort, "asset_id")}>
                      <button
                        type="button"
                        className="iconButton"
                        style={{ padding: "8px 10px" }}
                        onClick={() => {
                          setPage(1);
                          setSort((s) => nextSort(s, "asset_id"));
                        }}
                        aria-label="Sort by asset id"
                      >
                        Asset
                      </button>
                    </th>

                    <th className={styles.th} scope="col">
                      Message
                    </th>
                    <th className={styles.th} scope="col">
                      State
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((a, idx) => {
                    const isSelected = selected.has(a.id);
                    const isAcked = a.state === "acked" || Boolean(a.acked_at);

                    return (
                      <tr
                        key={a.id}
                        className={styles.tr}
                        data-rowindex={idx}
                        data-alertid={a.id}
                        tabIndex={0}
                        aria-label={`Alert row ${idx + 1}`}
                      >
                        <td className={styles.td}>
                          <input
                            className={styles.checkbox}
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleOne(a.id)}
                            aria-label={`Select alert ${a.id}`}
                          />
                        </td>

                        <td className={styles.td}>{formatDateTime(a.created_at)}</td>

                        <td className={styles.td}>
                          <Badge tone={severityTone(a.severity)} ariaLabel={`Severity ${a.severity}`}>
                            {String(a.severity).toUpperCase()}
                          </Badge>
                        </td>

                        <td
                          className={styles.td}
                          style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}
                        >
                          {a.asset_id}
                        </td>

                        <td className={styles.td}>{a.message}</td>

                        <td className={styles.td}>
                          {isAcked ? (
                            <Badge tone="success" ariaLabel="Acknowledged">
                              ACKED
                            </Badge>
                          ) : (
                            <Badge tone="warning" ariaLabel="Open">
                              OPEN
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className={styles.tableFooter} aria-label="Alerts pagination controls">
              <div className={styles.pagerInfo}>
                Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total} (page {page} / {pageCount})
              </div>

              <div className={styles.pager}>
                <Button
                  variant="ghost"
                  ariaLabel="Previous page"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </Button>
                <Button
                  variant="ghost"
                  ariaLabel="Next page"
                  disabled={page >= pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
