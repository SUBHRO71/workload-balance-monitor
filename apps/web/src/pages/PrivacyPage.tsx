import React, { useState } from "react";
import { colors } from "@workload/design-tokens";
import { useWorkload } from "../context/WorkloadContext";

export const PrivacyPage: React.FC = () => {
  const { consent, updateConsent, exportData, deleteAccount } = useWorkload();

  const [isExporting, setIsExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState("");

  const handleToggle = (key: keyof typeof consent) => {
    if (key === "notifications") return;
    updateConsent({
      ...consent,
      [key]: !consent[key],
    });
  };

  const handleNotificationToggle = (channel: "inApp" | "managerEmail") => {
    updateConsent({
      ...consent,
      notifications: {
        ...consent.notifications,
        [channel]: !consent.notifications[channel],
      },
    });
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportMsg("");
    try {
      const jsonStr = await exportData();
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `workload-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportMsg("✓ Export downloaded (24h validity).");
    } catch {
      setExportMsg("Export request failed.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirmDelete) return;
    setIsDeleting(true);
    setDeleteMsg("");
    try {
      const res = await deleteAccount();
      setDeleteMsg(`✓ Account deleted. Purged ${res.deletedCount} private items.`);
      setConfirmDelete(false);
    } catch {
      setDeleteMsg("Account deletion failed.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ margin: "0 0 6px", color: colors.text, fontSize: "1.8rem" }}>
          🛡️ Privacy Boundaries & Consent
        </h1>
        <p style={{ margin: 0, color: colors.muted, fontSize: "0.95rem" }}>
          Consent defaults to off. All sharing and processing choices are explicit and can be revoked at any time.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Scope 1: Personal Processing */}
        <div style={{ background: colors.surface, padding: "20px", border: "1px solid #dbe6df", borderRadius: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "20px" }}>
            <div>
              <strong style={{ fontSize: "1.1rem", color: colors.text, display: "block", marginBottom: "4px" }}>
                1. Personal Storage & Processing
              </strong>
              <p style={{ margin: 0, color: colors.muted, fontSize: "0.9rem", lineHeight: 1.5 }}>
                Allows the app to store your workload entries, voluntary check-ins, and private items to compute personal trends and observations.
                When turned off, new data collection halts immediately while keeping your historical data accessible for review/export/deletion.
              </p>
            </div>
            <input
              type="checkbox"
              checked={consent.personalProcessing}
              onChange={() => handleToggle("personalProcessing")}
              style={{ transform: "scale(1.4)", cursor: "pointer", marginTop: "4px" }}
            />
          </div>
        </div>

        {/* Scope 2: Team Aggregation */}
        <div style={{ background: colors.surface, padding: "20px", border: "1px solid #dbe6df", borderRadius: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "20px" }}>
            <div>
              <strong style={{ fontSize: "1.1rem", color: colors.text, display: "block", marginBottom: "4px" }}>
                2. Team Aggregation
              </strong>
              <p style={{ margin: 0, color: colors.muted, fontSize: "0.9rem", lineHeight: 1.5 }}>
                Allows your eligible numeric effort and manageability values to contribute to manager-facing team aggregate releases.
                Protected by a strict floor: <strong>at least 5 distinct consenting contributors</strong> are required, or the release is suppressed.
                Private notes and private items are strictly excluded.
              </p>
            </div>
            <input
              type="checkbox"
              checked={consent.teamAggregation}
              onChange={() => handleToggle("teamAggregation")}
              style={{ transform: "scale(1.4)", cursor: "pointer", marginTop: "4px" }}
            />
          </div>
        </div>

        {/* Scope 3: Organization (HR) Aggregation */}
        <div style={{ background: colors.surface, padding: "20px", border: "1px solid #dbe6df", borderRadius: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "20px" }}>
            <div>
              <strong style={{ fontSize: "1.1rem", color: colors.text, display: "block", marginBottom: "4px" }}>
                3. Organization (HR) Aggregation
              </strong>
              <p style={{ margin: 0, color: colors.muted, fontSize: "0.9rem", lineHeight: 1.5 }}>
                Allows your eligible numeric inputs to contribute to company-wide aggregate trends viewed by HR.
                HR has <strong>no individual drill-down, no individual shares, and no team participation lists</strong>.
              </p>
            </div>
            <input
              type="checkbox"
              checked={consent.organizationAggregation}
              onChange={() => handleToggle("organizationAggregation")}
              style={{ transform: "scale(1.4)", cursor: "pointer", marginTop: "4px" }}
            />
          </div>
        </div>

        {/* Scope 4: Notification Channels */}
        <div style={{ background: colors.surface, padding: "20px", border: "1px solid #dbe6df", borderRadius: "12px" }}>
          <strong style={{ fontSize: "1.1rem", color: colors.text, display: "block", marginBottom: "6px" }}>
            4. Notifications Delivery Channels
          </strong>
          <p style={{ margin: "0 0 14px", color: colors.muted, fontSize: "0.9rem" }}>
            Choose how you wish to receive personal reminders and access updates. Generic text only; no private notes in delivery payloads.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.92rem", color: colors.text }}>
              <input
                type="checkbox"
                checked={consent.notifications.inApp}
                onChange={() => handleNotificationToggle("inApp")}
              />
              In-app notification inbox
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.92rem", color: colors.text }}>
              <input
                type="checkbox"
                checked={consent.notifications.managerEmail}
                onChange={() => handleNotificationToggle("managerEmail")}
              />
              Generic manager review email notification (SNS)
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.92rem", color: colors.muted }}>
              <input type="checkbox" disabled checked={false} />
              Mobile device push notifications (Deferred in First Release)
            </label>
          </div>
        </div>

        {/* Scope 5: Data Portability & Owner Export (GDPR Art. 20) */}
        <div style={{ background: colors.surface, padding: "20px", border: "1px solid #dbe6df", borderRadius: "12px" }}>
          <strong style={{ fontSize: "1.1rem", color: colors.text, display: "block", marginBottom: "6px" }}>
            5. Data Portability & Archive Export
          </strong>
          <p style={{ margin: "0 0 12px", color: colors.muted, fontSize: "0.9rem", lineHeight: 1.5 }}>
            Download a complete JSON archive of all your personal tasks, voluntary check-ins, private items, preferences, consent versions, and observations.
            The archive contains strictly your personal records (zero coworker data or raw aggregate sets). Generated exports are available for 24 hours.
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <button
              onClick={handleExport}
              disabled={isExporting}
              style={{
                padding: "8px 16px",
                background: colors.accent,
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                fontWeight: 600,
                cursor: isExporting ? "wait" : "pointer",
                fontSize: "0.9rem",
              }}
            >
              {isExporting ? "Compiling Archive..." : "📥 Download My Data (JSON)"}
            </button>
            {exportMsg && (
              <span style={{ fontSize: "0.88rem", color: colors.accent, fontWeight: 500 }}>
                {exportMsg}
              </span>
            )}
          </div>
        </div>

        {/* Scope 6: Right to Erasure / Account Deletion (GDPR Art. 17) */}
        <div style={{ background: "#fdf6f6", padding: "20px", border: "1px solid #f2c7c7", borderRadius: "12px" }}>
          <strong style={{ fontSize: "1.1rem", color: "#b91c1c", display: "block", marginBottom: "6px" }}>
            6. Danger Zone: Right to Erasure & Account Deletion
          </strong>
          <p style={{ margin: "0 0 14px", color: "#7f1d1d", fontSize: "0.9rem", lineHeight: 1.5 }}>
            Permanently delete your account and all associated personal records in the <code>PRIVATE#</code> partition.
            This immediately revokes all active sharing grants, wipes approved publications and recipient inbox pointers,
            and synchronously invalidates affected team and organization releases. This action is irreversible.
          </p>

          <div style={{ marginBottom: "14px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.9rem", color: "#7f1d1d", fontWeight: 500, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={confirmDelete}
                onChange={(e) => setConfirmDelete(e.target.checked)}
              />
              I understand that all my personal workload data and active shares will be permanently erased.
            </label>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <button
              onClick={handleDeleteAccount}
              disabled={!confirmDelete || isDeleting}
              style={{
                padding: "8px 16px",
                background: confirmDelete ? "#dc2626" : "#fca5a5",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                fontWeight: 600,
                cursor: confirmDelete && !isDeleting ? "pointer" : "not-allowed",
                fontSize: "0.9rem",
              }}
            >
              {isDeleting ? "Erasing Records..." : "🗑️ Permanently Delete My Data"}
            </button>
            {deleteMsg && (
              <span style={{ fontSize: "0.88rem", color: "#dc2626", fontWeight: 600 }}>
                {deleteMsg}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
