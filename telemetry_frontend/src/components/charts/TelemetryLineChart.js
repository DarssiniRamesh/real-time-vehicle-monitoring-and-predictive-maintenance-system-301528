import React, { useMemo, useRef } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
  TimeScale,
} from "chart.js";
import { useResizeObserver } from "../../hooks/useResizeObserver";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler, TimeScale);

/**
 * @typedef {object} TelemetryChartSeries
 * @property {string[]} labels
 * @property {Array<{ label: string, data: Array<number|null>, borderColor: string, backgroundColor: string }>} datasets
 */

/**
 * PUBLIC_INTERFACE
 * TelemetryLineChart renders a responsive line chart suitable for telemetry.
 * @param {object} props
 * @param {TelemetryChartSeries} props.series
 * @param {string} [props.ariaLabel]
 * @param {boolean} [props.showLegend]
 * @returns {JSX.Element}
 */
export function TelemetryLineChart({ series, ariaLabel = "Telemetry chart", showLegend = true }) {
  const wrapRef = useRef(null);
  const { width } = useResizeObserver(wrapRef);

  const data = useMemo(() => {
    return {
      labels: Array.isArray(series?.labels) ? series.labels : [],
      datasets: Array.isArray(series?.datasets) ? series.datasets : [],
    };
  }, [series]);

  const options = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: showLegend, position: "bottom" },
        tooltip: {
          enabled: true,
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed?.y;
              const suffix = typeof v === "number" ? `: ${v.toFixed(2)}` : ": —";
              return `${ctx.dataset.label}${suffix}`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: {
            maxTicksLimit: width < 540 ? 6 : 10,
            color: "rgba(17, 24, 39, 0.7)",
            font: { size: 11 },
          },
          grid: { color: "rgba(17, 24, 39, 0.06)" },
        },
        y: {
          ticks: { color: "rgba(17, 24, 39, 0.7)", font: { size: 11 } },
          grid: { color: "rgba(17, 24, 39, 0.06)" },
        },
      },
      elements: {
        line: { tension: 0.25, borderWidth: 2 },
        point: { radius: 0, hitRadius: 12, hoverRadius: 3 },
      },
    };
  }, [showLegend, width]);

  return (
    <div ref={wrapRef} style={{ width: "100%", height: "100%" }} role="img" aria-label={ariaLabel}>
      <Line data={data} options={options} />
    </div>
  );
}
