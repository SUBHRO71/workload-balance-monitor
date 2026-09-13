import React from "react";
import { colors } from "@workload/design-tokens";
import { useAuth } from "../auth";

export type NavTab = "dashboard" | "tasks" | "checkins" | "private" | "trends" | "sharing" | "manager" | "hr" | "admin" | "notifications" | "privacy" | "settings";

interface NavigationProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  allowedTabs?: NavTab[];
}

const WORKSPACE_LABEL: Partial<Record<NavTab, string>> = {
  manager: "Manager Workspace",
  hr: "HR Workspace",
  admin: "Administration",
};

const ALL_TABS: Array<{ id: NavTab; label: string; icon: string }> = [
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "tasks", label: "Tasks", icon: "📝" },
  { id: "checkins", label: "Check-ins", icon: "🌱" },
  { id: "private", label: "Private Items", icon: "🔒" },
  { id: "trends", label: "Trends", icon: "📈" },
  { id: "sharing", label: "Sharing Center", icon: "🤝" },
  { id: "manager", label: "Manager Review", icon: "👔" },
  { id: "hr", label: "HR Overview", icon: "🏢" },
  { id: "admin", label: "Administration", icon: "🔑" },
  { id: "notifications", label: "Notices", icon: "🔔" },
  { id: "privacy", label: "Privacy & Consent", icon: "🛡️" },
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

  const workspaceLabel = WORKSPACE_LABEL[activeTab] ?? "My Workspace";

  const renderBtn = (tab: { id: NavTab; label: string; icon: string }) => {
    const isActive = activeTab === tab.id;
    return (
      <button
        key={tab.id}
        onClick={() => onSelectTab(tab.id)}
        style={{
          padding: "8px 14px",
          border: "none",
          borderRadius: "8px",
          background: isActive ? colors.accent : "transparent",
          color: isActive ? "#ffffff" : colors.text,
          cursor: "pointer",
          fontWeight: isActive ? 600 : 500,
          fontSize: "0.9rem",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          transition: "background 0.15s ease",
        }}
      >
        <span>{tab.icon}</span>
        {tab.label}
      </button>
    );
  };

  return (
    <header
      style={{
        borderBottom: "1px solid #dbe6df",
        background: colors.surface,
        padding: "12px 24px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "1.4rem" }}>⚖️</span>
          <div>
            <strong style={{ color: colors.text, display: "block", fontSize: "1.1rem" }}>
              Workload Balance Monitor
            </strong>
            <small style={{ color: colors.muted }}>{workspaceLabel}</small>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "0.85rem", color: colors.muted }}>Authenticated workspace</span>
          <button onClick={auth.logout} style={{ border: "1px solid #c8d8cf", background: "white", borderRadius: 6, padding: "6px 10px", cursor: "pointer" }}>Sign out</button>
        </div>
      </div>

      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {visibleTabs.map(renderBtn)}
        </div>
        {utilityTabs.length > 0 && (
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {utilityTabs.map(renderBtn)}
          </div>
        )}
      </nav>
    </header>
  );
};