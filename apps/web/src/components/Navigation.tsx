import React from "react";
import { colors } from "@workload/design-tokens";
import { useAuth } from "../auth";

export type NavTab = "dashboard" | "tasks" | "checkins" | "private" | "trends" | "sharing" | "manager" | "hr" | "admin" | "notifications" | "privacy" | "settings";

interface NavigationProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  allowedTabs?: NavTab[];
}

// Extend CSSProperties so CSS custom properties (--nav-*) can be passed
// through inline style without fighting TypeScript.
type CSSVars = React.CSSProperties & { [key: `--${string}`]: string | number };

const WORKSPACE_LABEL: Partial<Record<NavTab, string>> = {
  manager: "Manager workspace",
  hr: "HR workspace",
  admin: "Administration",
};

// Same tab set and copy as before — only the `icon` field is now unused
// decoratively (kept in the data shape in case other code reads it).
const ALL_TABS: Array<{ id: NavTab; label: string; icon: string }> = [
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "tasks", label: "Tasks", icon: "📝" },
  { id: "checkins", label: "Check-ins", icon: "🌱" },
  { id: "private", label: "Private items", icon: "🔒" },
  { id: "trends", label: "Trends", icon: "📈" },
  { id: "sharing", label: "Sharing center", icon: "🤝" },
  { id: "manager", label: "Manager review", icon: "👔" },
  { id: "hr", label: "HR overview", icon: "🏢" },
  { id: "admin", label: "Administration", icon: "🔑" },
  { id: "notifications", label: "Notices", icon: "🔔" },
  { id: "privacy", label: "Privacy & consent", icon: "🛡️" },
  { id: "settings", label: "Settings", icon: "⚙️" },
];

const PERSONAL_TAB_IDS: NavTab[] = ["dashboard", "tasks", "checkins", "private", "trends", "sharing"];
const PERSONAL_UTILITY_IDS: NavTab[] = ["notifications", "privacy", "settings"];

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onSelectTab, allowedTabs }) => {
  const auth = useAuth();

  const isWorkTab = (t: NavTab) => t === "manager" || t === "hr" || t === "admin";
  const allowed = allowedTabs ?? ALL_TABS.map((t) => t.id);

  // Determine which tabs to show based on the active tab's workspace
  let visibleIds: NavTab[];
  let utilityIds: NavTab[] = [];

  if (isWorkTab(activeTab)) {
    // Work workspace: show ONLY the active role tab
    visibleIds = [activeTab];
  } else {
    // Personal workspace: show personal content tabs + utility tabs
    visibleIds = PERSONAL_TAB_IDS.filter((id) => allowed.includes(id));
    utilityIds = PERSONAL_UTILITY_IDS.filter((id) => allowed.includes(id));
  }

  const visibleTabs = ALL_TABS.filter((t) => visibleIds.includes(t.id));
  const utilityTabs = ALL_TABS.filter((t) => utilityIds.includes(t.id));

  const workspaceLabel = WORKSPACE_LABEL[activeTab] ?? "My workspace";

  const renderBtn = (tab: { id: NavTab; label: string; icon: string }, variant: "primary" | "utility" = "primary") => {
    const isActive = activeTab === tab.id;
    return (
      <button
        key={tab.id}
        onClick={() => onSelectTab(tab.id)}
        className={`wbnav-tab wbnav-tab--${variant}${isActive ? " wbnav-tab--active" : ""}`}
      >
        {tab.label}
      </button>
    );
  };

  const navVars: CSSVars = {
    "--nav-accent": colors.accent,
    "--nav-text": colors.text,
    "--nav-muted": colors.muted,
    "--nav-surface": colors.surface,
  };

  return (
    <header className="wbnav-root" style={navVars}>
      <style>{`
        .wbnav-root {
          position: sticky;
          top: 0;
          z-index: 20;
          background: color-mix(in srgb, var(--nav-surface) 94%, transparent);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border-bottom: 1px solid #dbe6df;
          font-family: -apple-system, BlinkMacSystemFont, "Inter", sans-serif;
        }
        .wbnav-root * { box-sizing: border-box; }

        .wbnav-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 14px 28px 12px;
        }

        .wbnav-brand { display: flex; align-items: center; gap: 12px; }
        .wbnav-mark {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: var(--nav-accent);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.01em;
          flex-shrink: 0;
        }
        .wbnav-brand-name {
          color: var(--nav-text);
          font-size: 1.02rem;
          font-weight: 600;
          line-height: 1.2;
          display: block;
        }
        .wbnav-brand-sub {
          color: var(--nav-muted);
          font-size: 0.8rem;
          line-height: 1.2;
        }

        .wbnav-session { display: flex; align-items: center; gap: 14px; }
        .wbnav-session-text {
          font-size: 0.82rem;
          color: var(--nav-muted);
        }
        .wbnav-signout {
          border: 1px solid #dbe6df;
          background: transparent;
          color: var(--nav-text);
          border-radius: 7px;
          padding: 7px 14px;
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .wbnav-signout:hover { background: #f8faf9; border-color: #c8d8cf; }

        .wbnav-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 0 28px;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .wbnav-row::-webkit-scrollbar { display: none; }

        .wbnav-group { display: flex; align-items: center; }
        .wbnav-group--utility {
          border-left: 1px solid #eef3f0;
          margin-left: 4px;
          padding-left: 4px;
        }

        .wbnav-tab {
          position: relative;
          background: none;
          border: none;
          cursor: pointer;
          white-space: nowrap;
          padding: 13px 14px;
          font-size: 0.88rem;
          font-weight: 500;
          color: var(--nav-muted);
          transition: color 0.15s ease;
        }
        .wbnav-tab::after {
          content: "";
          position: absolute;
          left: 14px;
          right: 14px;
          bottom: 0;
          height: 2px;
          background: var(--nav-accent);
          border-radius: 2px 2px 0 0;
          transform: scaleX(0);
          transform-origin: center;
          transition: transform 0.18s ease;
        }
        .wbnav-tab:hover { color: var(--nav-text); }
        .wbnav-tab--active { color: var(--nav-text); font-weight: 600; }
        .wbnav-tab--active::after { transform: scaleX(1); }

        .wbnav-tab--utility { font-size: 0.82rem; padding: 13px 12px; }

        .wbnav-tab:focus-visible {
          outline: 2px solid var(--nav-accent);
          outline-offset: -2px;
          border-radius: 4px;
        }

        @media (max-width: 720px) {
          .wbnav-top { padding: 12px 16px 8px; }
          .wbnav-row { padding: 0 16px; }
          .wbnav-brand-sub { display: none; }
          .wbnav-session-text { display: none; }
        }
      `}</style>

      <div className="wbnav-top">
        <div className="wbnav-brand">
          <span className="wbnav-mark">WB</span>
          <div>
            <strong className="wbnav-brand-name">Workload Balance Monitor</strong>
            <div className="wbnav-brand-sub">{workspaceLabel}</div>
          </div>
        </div>
        <div className="wbnav-session">
          <span className="wbnav-session-text">Authenticated workspace</span>
          <button className="wbnav-signout" onClick={auth.logout}>
            Sign out
          </button>
        </div>
      </div>

      <nav className="wbnav-row">
        <div className="wbnav-group">{visibleTabs.map((t) => renderBtn(t, "primary"))}</div>
        {utilityTabs.length > 0 && (
          <div className="wbnav-group wbnav-group--utility">
            {utilityTabs.map((t) => renderBtn(t, "utility"))}
          </div>
        )}
      </nav>
    </header>
  );
};