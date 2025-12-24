import React from "react";
import styles from "./ui.module.css";

/**
 * PUBLIC_INTERFACE
 * Badge primitive for compact status labels.
 * @param {object} props
 * @param {"neutral"|"primary"|"success"|"warning"|"error"} [props.tone]
 * @param {string} [props.ariaLabel]
 * @param {React.ReactNode} props.children
 * @returns {JSX.Element}
 */
export function Badge({ tone = "neutral", ariaLabel, children }) {
  return (
    <span className={[styles.badge, styles[`badge_${tone}`]].join(" ")} aria-label={ariaLabel}>
      {children}
    </span>
  );
}
