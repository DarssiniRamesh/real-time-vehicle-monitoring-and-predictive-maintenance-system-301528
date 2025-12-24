import React, { createContext, useMemo } from "react";

/**
 * A tiny theme context to keep structure production-ready even though tokens
 * are currently implemented in CSS variables (src/index.css).
 */
export const ThemeContext = createContext({});

/**
 * PUBLIC_INTERFACE
 * ThemeProvider wraps the app and exposes theme metadata (tokens live in CSS vars).
 * @param {object} props
 * @param {React.ReactNode} props.children - App content.
 * @returns {JSX.Element}
 */
export function ThemeProvider({ children }) {
  const value = useMemo(() => {
    return {
      name: "Ocean Professional",
    };
  }, []);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * PUBLIC_INTERFACE
 * Get a short environment label for the UI badge.
 * Uses REACT_APP_ENV if provided, otherwise falls back to NODE_ENV.
 * @returns {string}
 */
export function getEnvironmentLabel() {
  const custom = (process.env.REACT_APP_ENV || "").trim();
  const env = custom || process.env.NODE_ENV || "development";
  return env.toUpperCase();
}
