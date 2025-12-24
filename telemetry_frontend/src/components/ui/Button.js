import React from "react";
import styles from "./ui.module.css";

/**
 * PUBLIC_INTERFACE
 * Button primitive with variants and accessible loading state.
 * @param {object} props
 * @param {"button"|"submit"|"reset"} [props.type]
 * @param {"primary"|"secondary"|"ghost"|"danger"} [props.variant]
 * @param {"sm"|"md"|"lg"} [props.size]
 * @param {boolean} [props.isLoading]
 * @param {boolean} [props.disabled]
 * @param {string} [props.ariaLabel]
 * @param {React.ReactNode} props.children
 * @param {function} [props.onClick]
 * @returns {JSX.Element}
 */
export function Button({
  type = "button",
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled = false,
  ariaLabel,
  children,
  onClick,
  ...rest
}) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      type={type}
      className={[
        styles.btn,
        styles[`btn_${variant}`],
        styles[`btn_${size}`],
        isLoading ? styles.btn_loading : "",
      ].join(" ")}
      disabled={isDisabled}
      aria-label={ariaLabel}
      aria-busy={isLoading ? "true" : "false"}
      onClick={onClick}
      {...rest}
    >
      {isLoading ? (
        <>
          <span className={styles.spinner} aria-hidden="true" />
          <span>{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
