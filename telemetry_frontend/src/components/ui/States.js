import React from "react";
import styles from "./ui.module.css";
import { Button } from "./Button";

/**
 * PUBLIC_INTERFACE
 * LoadingState for sections/pages.
 * @param {object} props
 * @param {string} [props.label]
 * @returns {JSX.Element}
 */
export function LoadingState({ label = "Loading" }) {
  return (
    <div className={styles.state} role="status" aria-label={label}>
      <div className={styles.stateSpinner} aria-hidden="true" />
      <div className={styles.stateTitle}>{label}</div>
      <div className={styles.stateHint}>Please wait…</div>
    </div>
  );
}

/**
 * PUBLIC_INTERFACE
 * EmptyState for empty datasets.
 * @param {object} props
 * @param {string} props.title
 * @param {string} [props.hint]
 * @param {React.ReactNode} [props.action]
 * @returns {JSX.Element}
 */
export function EmptyState({ title, hint, action }) {
  return (
    <div className={styles.state} role="status" aria-label={title}>
      <div className={styles.stateTitle}>{title}</div>
      {hint ? <div className={styles.stateHint}>{hint}</div> : null}
      {action ? <div className={styles.stateActions}>{action}</div> : null}
    </div>
  );
}

/**
 * PUBLIC_INTERFACE
 * ErrorState for error displays.
 * @param {object} props
 * @param {string} [props.title]
 * @param {string} [props.hint]
 * @param {function} [props.onRetry]
 * @returns {JSX.Element}
 */
export function ErrorState({ title = "Something went wrong", hint, onRetry }) {
  return (
    <div className={styles.state} role="alert" aria-label={title}>
      <div className={styles.stateTitle} style={{ color: "var(--color-error)" }}>
        {title}
      </div>
      {hint ? <div className={styles.stateHint}>{hint}</div> : null}
      {onRetry ? (
        <div className={styles.stateActions}>
          <Button variant="secondary" onClick={onRetry} ariaLabel="Retry">
            Retry
          </Button>
        </div>
      ) : null}
    </div>
  );
}
