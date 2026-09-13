import React, { useEffect, useState } from "react";
import { colors } from "@workload/design-tokens";
import { useWorkload } from "../context/WorkloadContext";

export const NotificationsPage: React.FC = () => {
  const { notifications, notificationPreferences, markNotificationRead, markAllNotificationsRead, updateNotificationPreferences } = useWorkload();
  const [preferences, setPreferences] = useState(notificationPreferences);
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  useEffect(() => {
    setPreferences(notificationPreferences);
  }, [notificationPreferences]);

  const savePreferences = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setSavedFeedback(null);
    try {
      await updateNotificationPreferences(preferences);
      setSavedFeedback("Preferences saved.");
      window.setTimeout(() => setSavedFeedback(null), 3000);
    } catch (error) {
      setSavedFeedback(error instanceof Error ? error.message : "Preferences could not be saved. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <p style={{ color: colors.accent, margin: "0 0 8px", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>Your inbox</p>
        <h1 style={{ color: colors.text, margin: "0 0 6px", fontSize: "1.8rem" }}>Notifications</h1>
        <p style={{ color: colors.muted, margin: 0, fontSize: "0.95rem" }}>Generic updates only. Personal notes and task descriptions never appear in a notification.</p>
      </div>

      <div style={{ background: "#f0f7f3", border: `1px solid ${colors.accent}`, borderRadius: "10px", padding: "16px 20px" }}>
        <strong style={{ color: colors.accent, display: "block", marginBottom: "4px" }}>Privacy-protected delivery</strong>
        <span style={{ fontSize: "0.88rem", color: colors.text, lineHeight: 1.5 }}>Delivery re-checks your opt-in and current access before sending. Links still ask you to sign in and re-authorize.</span>
      </div>

      {savedFeedback && <div role="status" style={{ padding: "12px 18px", borderRadius: "8px", background: savedFeedback === "Preferences saved." ? "#eefaf1" : "#fff1f1", border: `1px solid ${savedFeedback === "Preferences saved." ? "#bcebc8" : "#e3b5b5"}`, color: savedFeedback === "Preferences saved." ? "#1b6a2e" : "#9b2c2c", fontSize: "0.9rem" }}>{savedFeedback}</div>}

      <section style={{ background: colors.surface, padding: "20px", borderRadius: "10px", border: "1px solid #e0eae4" }} aria-labelledby="notification-inbox-heading">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", gap: "16px" }}>
          <h2 id="notification-inbox-heading" style={{ margin: 0, color: colors.text, fontSize: "1.1rem" }}>Inbox <span style={{ color: colors.muted, fontWeight: 500 }}>({unreadCount} unread)</span></h2>
          {unreadCount > 0 && <button onClick={() => void markAllNotificationsRead()} style={{ background: "none", border: 0, color: colors.accent, cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }}>Mark all read</button>}
        </div>
        {notifications.length === 0 ? (
          <div style={{ padding: "28px 12px", textAlign: "center", border: "1px dashed #cbd9d0", borderRadius: "8px" }}>
            <strong style={{ color: colors.text }}>You’re all caught up</strong>
            <p style={{ margin: "6px auto 0", maxWidth: 420, color: colors.muted, fontSize: "0.88rem" }}>When a permitted update arrives, it will appear here without exposing private content.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {notifications.map((notification) => <article key={notification.id} style={{ padding: "14px 16px", background: notification.read ? "#fafcfb" : "#ffffff", border: `1px solid ${notification.read ? "#e5ede8" : colors.accent}`, borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
              <div><strong style={{ color: colors.text, fontSize: "0.95rem" }}>{notification.title}</strong><p style={{ margin: "5px 0 6px", color: colors.text, fontSize: "0.88rem", lineHeight: 1.4 }}>{notification.message}</p><span style={{ fontSize: "0.8rem", color: colors.muted }}>{new Date(notification.createdAt).toLocaleString()} · {notification.category}</span></div>
              <button onClick={() => void markNotificationRead(notification.id, !notification.read)} style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #cedcd3", background: "#ffffff", color: colors.text, fontSize: "0.82rem", cursor: "pointer", whiteSpace: "nowrap" }}>{notification.read ? "Mark unread" : "Mark read"}</button>
            </article>)}
          </div>
        )}
      </section>

      <section style={{ background: colors.surface, padding: "20px", borderRadius: "10px", border: "1px solid #e0eae4" }}>
        <h2 style={{ margin: "0 0 8px", color: colors.text, fontSize: "1.1rem" }}>Delivery preferences</h2>
        <p style={{ margin: "0 0 16px", color: colors.muted, fontSize: "0.88rem" }}>Each channel is independent and can be turned off at any time.</p>
        <form onSubmit={(event) => void savePreferences(event)} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {([["inAppEnabled", "In-app notifications", "Show generic updates in your workspace."], ["emailEnabled", "Generic email notifications", "Opt in to safe email summaries."], ["weeklyDigestEnabled", "Weekly activity digest", "Receive a high-level summary of your own logging."]] as const).map(([key, label, description]) => <label key={key} style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer", fontSize: "0.9rem" }}><input type="checkbox" checked={preferences[key]} onChange={(event) => setPreferences((current) => ({ ...current, [key]: event.target.checked }))} /><span><strong style={{ display: "block", color: colors.text }}>{label}</strong><span style={{ color: colors.muted, fontSize: "0.84rem" }}>{description}</span></span></label>)}
          <button type="submit" disabled={saving} style={{ alignSelf: "flex-start", marginTop: "6px", padding: "10px 18px", borderRadius: "6px", border: "none", background: colors.accent, color: "#ffffff", fontWeight: 600, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>{saving ? "Saving…" : "Save preferences"}</button>
        </form>
      </section>
    </div>
  );
};
