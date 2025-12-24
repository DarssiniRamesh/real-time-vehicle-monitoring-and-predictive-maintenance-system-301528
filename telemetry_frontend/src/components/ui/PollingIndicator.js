import React, { useMemo } from "react";
import { Badge } from "./Badge";
import { formatRelativeTime } from "../../utils/format";
import { useAppState } from "../../state/AppStateContext";

/**
 * PUBLIC_INTERFACE
 * PollingIndicator renders a compact status pill for a given polling key.
 *
 * It reads shared polling metadata from AppStateContext and shows:
 * - "live" while a poll tick is running
 * - relative time since last refresh
 * - "error" when the last tick errored
 *
 * @param {{ pollingKey: string, label?: string }} props
 */
export function PollingIndicator({ pollingKey, label = "poll" }) {
  const { pollingMeta } = useAppState();
  const meta = pollingMeta?.[pollingKey] || { running: false, lastRefreshAtIso: null, lastError: null };

  const tone = useMemo(() => {
    if (meta.lastError) return "error";
    if (meta.running) return "primary";
    return "neutral";
  }, [meta.lastError, meta.running]);

  const text = useMemo(() => {
    if (meta.lastError) return `${label}: error`;
    if (meta.running) return `${label}: live`;
    if (meta.lastRefreshAtIso) return `${label}: ${formatRelativeTime(meta.lastRefreshAtIso)}`;
    return `${label}: —`;
  }, [label, meta.lastError, meta.lastRefreshAtIso, meta.running]);

  const aria = useMemo(() => {
    if (meta.lastError) return `Polling error`;
    if (meta.running) return `Polling running`;
    return `Polling last refreshed`;
  }, [meta.lastError, meta.running]);

  return (
    <Badge tone={tone} ariaLabel={aria}>
      {text}
    </Badge>
  );
}
