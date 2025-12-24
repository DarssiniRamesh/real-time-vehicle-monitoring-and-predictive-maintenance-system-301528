import React from "react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";

/**
 * PUBLIC_INTERFACE
 * DashboardPage provides the landing overview area.
 * (Future agent will connect this to backend APIs for fleet health + telemetry summaries.)
 */
export function DashboardPage() {
  return (
    <>
      <Card
        title="Fleet Health Overview"
        actions={
          <Button variant="primary" ariaLabel="Refresh dashboard">
            Refresh
          </Button>
        }
      >
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Badge tone="success" ariaLabel="Status stable">
              Stable
            </Badge>
            <Badge tone="warning" ariaLabel="Status attention needed">
              Attention
            </Badge>
            <Badge tone="error" ariaLabel="Status critical">
              Critical
            </Badge>
          </div>
          <div style={{ color: "var(--color-muted)", fontSize: 13, lineHeight: 1.5 }}>
            Connect upcoming widgets (live charts, alert history, and predictive risk ranking) to the backend
            telemetry and prediction endpoints.
          </div>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 16 }}>
        <div style={{ gridColumn: "span 12", display: "grid", gap: 16 }}>
          <Card title="Live Telemetry (placeholder)">
            <div style={{ color: "var(--color-muted)", fontSize: 13 }}>
              Live chart panels will appear here.
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
