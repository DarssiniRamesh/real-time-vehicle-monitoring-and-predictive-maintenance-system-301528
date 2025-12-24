import React from "react";
import { Card } from "../components/ui/Card";
import { TableSkeleton } from "../components/ui/TableSkeleton";
import { Badge } from "../components/ui/Badge";

/**
 * PUBLIC_INTERFACE
 * AssetsPage lists monitored assets/equipment.
 * (Future agent will fetch assets from backend and render a table.)
 */
export function AssetsPage() {
  return (
    <Card
      title="Assets"
      actions={
        <Badge tone="neutral" ariaLabel="Data source not connected">
          Not connected
        </Badge>
      }
    >
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ color: "var(--color-muted)", fontSize: 13 }}>
          This section will list vehicles/equipment, their latest telemetry, and risk scores.
        </div>
        <TableSkeleton rows={6} columns={4} />
      </div>
    </Card>
  );
}
