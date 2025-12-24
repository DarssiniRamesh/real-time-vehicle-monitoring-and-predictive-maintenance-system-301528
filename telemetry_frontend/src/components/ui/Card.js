import React from "react";
import styles from "./ui.module.css";

/**
 * PUBLIC_INTERFACE
 * Card surface primitive.
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.title]
 * @param {React.ReactNode} [props.actions]
 * @returns {JSX.Element}
 */
export function Card({ children, title, actions }) {
  return (
    <section className={styles.card}>
      {(title || actions) && (
        <header className={styles.cardHeader}>
          <div className={styles.cardTitle}>{title}</div>
          <div className={styles.cardActions}>{actions}</div>
        </header>
      )}
      <div className={styles.cardBody}>{children}</div>
    </section>
  );
}
