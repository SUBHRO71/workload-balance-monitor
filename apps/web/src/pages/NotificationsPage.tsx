import React, { useState } from "react";
import { colors } from "@workload/design-tokens";
import type { NotificationPreferences, NotificationRecord } from "@workload/contracts";

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([
    {
      id: "notif-1",
      orgId: "demo-org",
      userId: "demo-user",
      title: "Shared Report Opened",
      message: "Your direct manager accessed your shared report for window 2026-03-01 to 2026-03-07.",
      category: "share",
      read: false,
      link: "/app/sharing",
      createdAt: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: "notif-2",
      orgId: "demo-org",
      userId: "demo-user",
      title: "Workload Observation Available",
      message: "Your personal workload trends for the past week show an elevated effort level. A private suggestion is available.",
      category: "observation",
      read: true,
      link: "/app/trends",
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: "notif-3",
      orgId: "demo-org",
      userId: "demo-user",
      title: "Differential Privacy Release Updated",
      message: "Organization aggregate trends for the recent reporting window have been released.",
      category: "policy",
      read: true,
      link: "/app/trends",
      createdAt: new Date(Date.now() - 172800000).toISOString(),
    },
  ]);

  const [preferences, setPreferences] = useState<NotificationPreferences>({
    inAppEnabled: true,
    emailEnabled: false,
    weeklyDigestEnabled: false,
  });

  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);

  const toggleRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n)),
    );
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedFeedback("Notification preferences updated successfully.");
    setTimeout(() => setSavedFeedback(null), 3000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <h1 style={{ color: colors.text, margin: "0 0 6px 0", fontSize: "1.8rem" }}>
          Notifications & Preferences
        </h1>
        <p style={{ color: colors.muted, margin: 0, fontSize: "0.95rem" }}>
          In-app alerts and delivery channels. Notifications contain only generic event information and never leak private free text.
        </p>
      </div>

      {/* Privacy Notice Banner */}
      <div
        style={{
          background: "#f0f7f3",
          border: `1px solid ${colors.accent}`,
          borderRadius: "10px",
          padding: "16px 20px",
          display: "flex",
          gap: "14px",
          alignItems: "flex-start",
        }}
      >
        <span style={{ fontSize: "1.6rem" }}>🔕</span>
        <div>
          <strong style={{ color: colors.accent, display: "block", marginBottom: "4px" }}>
            Privacy-Protected Notification Content
          </strong>
          <span style={{ fontSize: "0.88rem", color: colors.text, lineHeight: 1.5 }}>
            Automated notifications and opted-in emails use generic text only (e.g. &ldquo;A new observation is available&rdquo; or &ldquo;Your direct manager viewed your grant&rdquo;). Personal notes, task descriptions, and leave details are never included in email subjects or notification payloads.
          </span>
        </div>
      </div>

      {savedFeedback && (
        <div
          style={{
            padding: "12px 18px",
            borderRadius: "8px",
            background: "#eefaf1",
            border: "1px solid #bcebc8",
            color: "#1b6a2e",
            fontSize: "0.9rem",
          }}
        >
          {savedFeedback}
        </div>
      )}

      {/* Notifications Inbox */}
      <div style={{ background: colors.surface, padding: "20px", borderRadius: "10px", border: "1px solid #e0eae4" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ margin: 0, color: colors.text, fontSize: "1.1rem" }}>
            Inbox ({notifications.filter((n) => !n.read).length} unread)
          </h3>
          <button
            onClick={() => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))}
            style={{
              background: "none",
              border: "none",
              color: colors.accent,
              cursor: "pointer",
              fontSize: "0.85rem",
              fontWeight: 600,
            }}
          >
            Mark all read
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {notifications.map((notif) => (
            <div
              key={notif.id}
              style={{
                padding: "14px 16px",
                background: notif.read ? "#fafcfb" : "#ffffff",
                border: `1px solid ${notif.read ? "#e5ede8" : colors.accent}`,
                borderRadius: "8px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "12px",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <strong style={{ color: colors.text, fontSize: "0.95rem" }}>{notif.title}</strong>
                  {!notif.read && (
                    <span
                      style={{
                        background: colors.accent,
                        color: "#ffffff",
                        fontSize: "0.75rem",
                        padding: "1px 6px",
                        borderRadius: "10px",
                        fontWeight: 600,
                      }}
                    >
                      NEW
                    </span>
                  )}
                </div>
                <p style={{ margin: "0 0 6px 0", color: colors.text, fontSize: "0.88rem", lineHeight: 1.4 }}>
                  {notif.message}
                </p>
                <span style={{ fontSize: "0.8rem", color: colors.muted }}>
                  {new Date(notif.createdAt).toLocaleString()} · Category: {notif.category}
                </span>
              </div>

              <button
                onClick={() => toggleRead(notif.id)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid #cedcd3",
                  background: "#ffffff",
                  color: colors.text,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {notif.read ? "Mark unread" : "Mark read"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Notification Preferences */}
      <div style={{ background: colors.surface, padding: "20px", borderRadius: "10px", border: "1px solid #e0eae4" }}>
        <h3 style={{ margin: "0 0 14px 0", color: colors.text, fontSize: "1.1rem" }}>
          Notification Delivery Preferences
        </h3>

        <form onSubmit={handleSavePreferences} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "0.9rem" }}>
            <input
              type="checkbox"
              checked={preferences.inAppEnabled}
              onChange={(e) => setPreferences((p) => ({ ...p, inAppEnabled: e.target.checked }))}
            />
            <span>
              <strong>In-App Notifications</strong> (show updates in your web and mobile notice drawer)
            </span>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "0.9rem" }}>
            <input
              type="checkbox"
              checked={preferences.emailEnabled}
              onChange={(e) => setPreferences((p) => ({ ...p, emailEnabled: e.target.checked }))}
            />
            <span>
              <strong>Generic Email Notifications</strong> (opt-in generic summaries; no private notes)
            </span>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "0.9rem" }}>
            <input
              type="checkbox"
              checked={preferences.weeklyDigestEnabled}
              onChange={(e) => setPreferences((p) => ({ ...p, weeklyDigestEnabled: e.target.checked }))}
            />
            <span>
              <strong>Weekly Activity Digest</strong> (safe high-level summary of your own workload logging)
            </span>
          </label>

          <div>
            <button
              type="submit"
              style={{
                marginTop: "6px",
                padding: "8px 18px",
                borderRadius: "6px",
                border: "none",
                background: colors.accent,
                color: "#ffffff",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Save Preferences
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
