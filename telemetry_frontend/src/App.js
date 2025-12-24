import React, { useEffect, useMemo, useState } from "react";
import { BrowserRouter, NavLink, Route, Routes, useLocation } from "react-router-dom";
import "./App.css";
import { ThemeProvider, getEnvironmentLabel } from "./theme/ThemeProvider";
import { Badge } from "./components/ui/Badge";
import { DashboardPage } from "./pages/DashboardPage";
import { AssetsPage } from "./pages/AssetsPage";
import { AlertsPage } from "./pages/AlertsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { getRuntimeConfig } from "./config/env";
import { AppStateProvider, useAppState } from "./state/AppStateContext";

function Icon({ name }) {
  // Simple inline icons to avoid additional dependencies.
  switch (name) {
    case "dashboard":
      return (
        <svg className="navIcon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 13h7V4H4v9Zm9 7h7V11h-7v9ZM4 20h7v-5H4v5Zm9-11h7V4h-7v5Z"
            fill="currentColor"
            opacity="0.92"
          />
        </svg>
      );
    case "assets":
      return (
        <svg className="navIcon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 2 2 7l10 5 10-5-10-5Zm10 7-10 5L2 9v8l10 5 10-5V9Z"
            fill="currentColor"
            opacity="0.92"
          />
        </svg>
      );
    case "alerts":
      return (
        <svg className="navIcon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2Zm6-6V11c0-3.07-1.63-5.64-4.5-6.32V4a1.5 1.5 0 0 0-3 0v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2Z"
            fill="currentColor"
            opacity="0.92"
          />
        </svg>
      );
    case "settings":
      return (
        <svg className="navIcon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.06 7.06 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 1h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.58.23-1.12.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 7.5a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.83 14.52a.5.5 0 0 0-.12.64l1.92 3.32c.13.23.39.32.6.22l2.39-.96c.5.4 1.05.71 1.63.94l.36 2.54c.04.24.25.42.49.42h3.8c.24 0 .45-.18.49-.42l.36-2.54c.58-.23 1.12-.54 1.63-.94l2.39.96c.22.1.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z"
            fill="currentColor"
            opacity="0.92"
          />
        </svg>
      );
    case "menu":
      return (
        <svg className="navIcon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 6.5h16M4 12h16M4 17.5h16"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.92"
          />
        </svg>
      );
    default:
      return null;
  }
}

function NotFound() {
  return (
    <div style={{ color: "var(--color-muted)", fontSize: 13 }}>
      The page you’re looking for doesn’t exist.
    </div>
  );
}

// PUBLIC_INTERFACE
function AppShell() {
  /** AppShell renders the persistent shell (sidebar + topbar) and route outlet. */
  const envLabel = getEnvironmentLabel();
  const location = useLocation();

  const [isNavOpen, setIsNavOpen] = useState(false);

  // Close mobile drawer whenever route changes.
  useEffect(() => {
    setIsNavOpen(false);
  }, [location.pathname]);

  // Close mobile drawer on Escape (when open).
  useEffect(() => {
    if (!isNavOpen) return;

    function onKeyDown(e) {
      if (e.key === "Escape") setIsNavOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isNavOpen]);

  const navLinks = useMemo(() => {
    return [
      { to: "/", end: true, label: "Dashboard", icon: "dashboard" },
      { to: "/assets", label: "Assets", icon: "assets" },
      { to: "/alerts", label: "Alerts", icon: "alerts" },
      { to: "/settings", label: "Settings", icon: "settings" },
    ];
  }, []);

  return (
    <div className="appShell">
      <a className="skipLink" href="#mainContent">
        Skip to content
      </a>

      {/* Overlay for mobile drawer */}
      <button
        type="button"
        className={isNavOpen ? "navOverlay navOverlayOpen" : "navOverlay"}
        aria-label="Close navigation menu"
        onClick={() => setIsNavOpen(false)}
      />

      <aside
        id="primaryNav"
        className={isNavOpen ? "sidebar sidebarOpen" : "sidebar"}
        aria-label="Primary navigation"
      >
        <div className="brandRow">
          <div className="brandMark" aria-hidden="true" />
          <div className="brandTitle">
            <strong>Predictive Maintenance</strong>
            <span>Ocean Professional</span>
          </div>
        </div>

        <nav aria-label="Main">
          <div className="navGroupLabel">Navigation</div>
          <ul className="navList">
            {navLinks.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => (isActive ? "navLink navLinkActive" : "navLink")}
                  aria-label={`Go to ${item.label}`}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <main className="main" id="mainContent" tabIndex={-1}>
        <header className="topbar" aria-label="Top bar">
          <div className="topbarLeft">
            <button
              type="button"
              className="iconButton menuButton"
              aria-label="Open navigation menu"
              aria-controls="primaryNav"
              aria-expanded={isNavOpen ? "true" : "false"}
              onClick={() => setIsNavOpen(true)}
            >
              <Icon name="menu" />
            </button>

            <h1 className="appTitle">Real-time Vehicle Monitoring</h1>
            <Badge tone="primary" ariaLabel={`Environment ${envLabel}`}>
              {envLabel}
            </Badge>
          </div>

          <div className="topbarRight">
            <button type="button" aria-label="Notifications" className="iconButton">
              <Icon name="alerts" />
              <span className="sr-only">Notifications</span>
            </button>
          </div>
        </header>

        <div className="contentWrap">
          <div className="contentInner" aria-label="Page content">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/assets" element={<AssetsPage />} />
              <Route path="/alerts" element={<AlertsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * PUBLIC_INTERFACE
 * App provides the global application shell:
 * - Persistent side navigation + mobile drawer
 * - Top bar with title, environment badge, notifications button
 * - Responsive content area with gradient background and card surfaces
 */
function StartupHealthCheck() {
  const { api, mockMode } = useAppState();

  // Basic connectivity log at startup for POC/debugging.
  useEffect(() => {
    const cfg = getRuntimeConfig();
    // eslint-disable-next-line no-console
    console.info("[startup] runtime config", { ...cfg, mockMode });

    api
      .healthCheck()
      .then((res) => {
        // eslint-disable-next-line no-console
        console.info("[startup] backend health ok", res);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn("[startup] backend health failed", {
          message: err?.message,
          status: err?.status,
          code: err?.code,
          url: err?.url,
        });
      });
  }, [api, mockMode]);

  return null;
}

function App() {
  return (
    <ThemeProvider>
      <AppStateProvider>
        <BrowserRouter>
          <StartupHealthCheck />
          <AppShell />
        </BrowserRouter>
      </AppStateProvider>
    </ThemeProvider>
  );
}

export default App;
