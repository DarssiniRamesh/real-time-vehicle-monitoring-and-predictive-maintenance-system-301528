import React from "react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";

/**
 * PUBLIC_INTERFACE
 * SettingsPage provides app configuration scaffolding.
 * (Future agent will add API base URL, polling intervals, thresholds, etc.)
 */
export function SettingsPage() {
  const customEnv = (process.env.REACT_APP_ENV || "").trim();

  return (
    <Card title="Settings">
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ color: "var(--color-muted)", fontSize: 13, lineHeight: 1.5 }}>
          Environment badge is sourced from <code>REACT_APP_ENV</code> when provided, otherwise it falls back
          to <code>NODE_ENV</code>.
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <Badge tone="primary" ariaLabel="REACT_APP_ENV value">
            REACT_APP_ENV: {customEnv ? customEnv : "(not set)"}
          </Badge>
          <Badge tone="neutral" ariaLabel="NODE_ENV value">
            NODE_ENV: {process.env.NODE_ENV}
          </Badge>
        </div>
      </div>
    </Card>
  );
}
