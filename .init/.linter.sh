#!/bin/bash
cd /home/kavia/workspace/code-generation/real-time-vehicle-monitoring-and-predictive-maintenance-system-301528/telemetry_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

