import React from "react";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/States";
import { Button } from "../components/ui/Button";

/**
 * PUBLIC_INTERFACE
 * AlertsPage shows predicted failures and triggered alerts.
 * (Future agent will fetch alerts and support filtering/sorting.)
 */
export function AlertsPage() {
  return (
    <Card title="Alerts">
      <EmptyState
        title="No alerts yet"
        hint="When predictions cross thresholds, alerts will appear here with severity and recommended actions."
        action={
          <Button variant="secondary" ariaLabel="Simulate alerts (placeholder)">
            Simulate (placeholder)
          </Button>
        }
      />
    </Card>
  );
}
