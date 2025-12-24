import React from "react";
import styles from "./ui.module.css";

/**
 * PUBLIC_INTERFACE
 * TableSkeleton shows a lightweight skeleton while data loads.
 * @param {object} props
 * @param {number} [props.rows]
 * @param {number} [props.columns]
 * @returns {JSX.Element}
 */
export function TableSkeleton({ rows = 6, columns = 4 }) {
  const rowArr = Array.from({ length: rows }, (_, i) => i);
  const colArr = Array.from({ length: columns }, (_, i) => i);

  return (
    <div className={styles.tableSkeleton} role="status" aria-label="Loading table">
      <div className={styles.tableSkeletonHeader}>
        {colArr.map((c) => (
          <div key={`h-${c}`} className={[styles.skel, styles.skel_line].join(" ")} />
        ))}
      </div>
      <div className={styles.tableSkeletonBody}>
        {rowArr.map((r) => (
          <div key={`r-${r}`} className={styles.tableSkeletonRow}>
            {colArr.map((c) => (
              <div key={`c-${r}-${c}`} className={[styles.skel, styles.skel_line].join(" ")} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
