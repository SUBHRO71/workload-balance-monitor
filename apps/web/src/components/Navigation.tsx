import React from "react";
import { colors } from "@workload/design-tokens";

export type NavTab = "dashboard" | "tasks" | "checkins" | "private" | "trends" | "sharing" | "manager" | "hr" | "admin" | "notifications" | "privacy" | "settings";

interface NavigationProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isDemoMode: boolean;
  onToggleDemo: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  isDemoMode,
  onToggleDemo,
}) => {
  const tabs: Array<{ id: NavTab; label: string; icon: string }> = [
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

  return (
    <header
      style={{
        borderBottom: "1px solid #dbe6df",
        background: colors.surface,
        padding: "12px 24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <span style={{ fontSize: "1.4rem" }}>⚖️</span>
        <div>
          <strong style={{ color: colors.text, display: "block", fontSize: "1.1rem" }}>
            Workload Balance Monitor
          </strong>
          <small style={{ color: colors.muted }}>Private Personal Workspace</small>
        </div>
      </div>

      <nav style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        {tabs.map((tab) => {
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
        })}
      </nav>

      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <label
          style={{
            fontSize: "0.85rem",
            color: colors.muted,
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: "#edf4f0",
            padding: "4px 10px",
            borderRadius: "6px",
          }}
        >
          <input
            type="checkbox"
            checked={isDemoMode}
            onChange={() => onToggleDemo()}
          />
          <strong>Synthetic Demo Mode</strong>
        </label>
      </div>
    </header>
  );
};
