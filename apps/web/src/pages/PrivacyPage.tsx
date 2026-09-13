import React, { useCallback, useEffect, useMemo, useState } from "react";
import { WorkloadApiClient } from "@workload/api-client";
import { colors } from "@workload/design-tokens";
import { useWorkload } from "../context/WorkloadContext";
import { useAuth } from "../auth";
import type { LifecycleJobRecord } from "@workload/contracts";

export const PrivacyPage: React.FC = () => {
  const { consent, updateConsent } = useWorkload();
  const auth = useAuth();
  const orgId = auth.memberships.find((m) => m.status === "active")?.orgId;
  const api = useMemo(
    () =>
      new WorkloadApiClient({
        baseUrl: import.meta.env.VITE_API_URL as string,
        getAccessToken: async () => auth.accessToken,
        ...(orgId ? { orgId } : {}),
      }),
    [auth.accessToken, orgId],
  );

  // ---- Consent ----
  const [consentError, setConsentError] = useState("");

  const handleToggle = async (key: keyof typeof consent) => {
    if (key === "notifications") return;
    setConsentError("");
    try {
      await updateConsent({ ...consent, [key]: !consent[key as keyof typeof consent] });
    } catch (cause) {
      setConsentError(cause instanceof Error ? cause.message : "Unable to update consent");
    }
  };

  const handleNotificationToggle = async (channel: "inApp" | "managerEmail") => {
    setConsentError("");
    try {
      await updateConsent({
        ...consent,
        notifications: { ...consent.notifications, [channel]: !consent.notifications[channel] },
      });
    } catch (cause) {
      setConsentError(cause instanceof Error ? cause.message : "Unable to update consent");
    }
  };

  // ---- Export (queued job) ----
  const [exportJob, setExportJob] = useState<LifecycleJobRecord | null>(null);
  const [exportPolling, setExportPolling] = useState(false);
  const [exportError, setExportError] = useState("");

  const pollExportJob = useCallback(
    async (jobId: string) => {
      setExportPolling(true);
      try {
        let attempts = 0;
        while (attempts < 20) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          const job = await api.getJob(jobId);
          setExportJob(job);
          if (job.status === "completed" || job.status === "failed") break;
          attempts++;
        }
      } catch (cause) {
        setExportError(cause instanceof Error ? cause.message : "Export polling failed");
      } finally {
        setExportPolling(false);
      }
    },
    [api],
  );

  const handleRequestExport = async () => {
    setExportError("");
    setExportJob(null);
    try {
      const job = await api.createExport({ scope: "all" });
      setExportJob(job);
      if (job.status !== "completed") {
        void pollExportJob(job.id);
      }
    } catch (cause) {
      setExportError(cause instanceof Error ? cause.message : "Export request failed");
    }
  };

  const handleDownload = async () => {
    if (!exportJob?.id) return;
    setExportError("");
    try {
      const { data } = await api.getExportDownload(exportJob.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `workload-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (cause) {
      setExportError(cause instanceof Error ? cause.message : "Download failed");
    }
  };

  // Reset export state if tab gets re-mounted
  useEffect(() => {
    return () => { setExportJob(null); setExportError(""); };
  }, []);

  // ---- Account deletion (queued job) ----
  const [deleteJob, setDeleteJob] = useState<LifecycleJobRecord | null>(null);
  const [deletePolling, setDeletePolling] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const pollDeleteJob = useCallback(
    async (jobId: string) => {
      setDeletePolling(true);
      try {
        let attempts = 0;
        while (attempts < 20) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          const job = await api.getJob(jobId);
          setDeleteJob(job);
          if (job.status === "completed" || job.status === "failed") break;
          attempts++;
        }
      } catch (cause) {
        setDeleteError(cause instanceof Error ? cause.message : "Deletion polling failed");
      } finally {
        setDeletePolling(false);
      }
    },
    [api],
  );

  const handleDeleteAccount = async () => {
    if (!confirmDelete) return;
    setDeleteError("");
    try {
      const job = await api.createDeletionRequest({ scope: "all", confirmed: true });
      setDeleteJob(job);
      setConfirmDelete(false);
      if (job.status !== "completed") {
        void pollDeleteJob(job.id);
      }
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : "Account deletion failed");
    }
  };

  const statusBadge = (job: LifecycleJobRecord) => {
    const color =
      job.status === "completed"
        ? "#137333"
        : job.status === "failed"
          ? "#b3261e"
          : "#b06000";
    const bg =
      job.status === "completed"
        ? "#e6f4ea"
        : job.status === "failed"
          ? "#fce8e6"
          : "#fef7e0";
    return (
      <span
        style={{
          padding: "2px 10px",
          borderRadius: "6px",
          background: bg,
          color,
          fontWeight: 600,
          fontSize: "0.85rem",
        }}
      >
        {job.status.toUpperCase()}
      </span>
    );
  };

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ margin: "0 0 6px", color: colors.text, fontSize: "1.8rem" }}>
          🛡️ Privacy Boundaries &amp; Consent
        </h1>
        <p style={{ margin: 0, color: colors.muted, fontSize: "0.95rem" }}>
          Consent defaults to off. All sharing and processing choices are explicit and can be
          revoked at any time.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {consentError && (
          <div role="alert" style={{ padding: "12px", color: "#b3261e", background: "#fce8e6", borderRadius: "8px" }}>
            {consentError}
          </div>
        )}

        {/* 1. Personal Processing */}
        <div style={{ background: colors.surface, padding: "20px", border: "1px solid #dbe6df", borderRadius: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "20px" }}>
            <div>
              <strong style={{ fontSize: "1.1rem", color: colors.text, display: "block", marginBottom: "4px" }}>
                1. Personal Storage &amp; Processing
              </strong>
              <p style={{ margin: 0, color: colors.muted, fontSize: "0.9rem", lineHeight: 1.5 }}>
                Allows the app to store your workload entries, voluntary check-ins, and private items
                to compute personal trends and observations. When turned off, new data collection
                halts immediately while keeping your historical data accessible for
                review/export/deletion.
              </p>
            </div>
            <input
              type="checkbox"
              checked={consent.personalProcessing}
              onChange={() => void handleToggle("personalProcessing")}
              style={{ transform: "scale(1.4)", cursor: "pointer", marginTop: "4px" }}
            />
          </div>
        </div>

        {/* 2. Team Aggregation */}
        <div style={{ background: colors.surface, padding: "20px", border: "1px solid #dbe6df", borderRadius: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "20px" }}>
            <div>
              <strong style={{ fontSize: "1.1rem", color: colors.text, display: "block", marginBottom: "4px" }}>
                2. Team Aggregation
              </strong>
              <p style={{ margin: 0, color: colors.muted, fontSize: "0.9rem", lineHeight: 1.5 }}>
                Allows your eligible numeric effort and manageability values to contribute to
                manager-facing team aggregate releases. Protected by a strict floor:{" "}
                <strong>at least 5 distinct consenting contributors</strong> are required, or the
                release is suppressed. Private notes and private items are strictly excluded.
              </p>
            </div>
            <input
              type="checkbox"
              checked={consent.teamAggregation}
              onChange={() => void handleToggle("teamAggregation")}
              style={{ transform: "scale(1.4)", cursor: "pointer", marginTop: "4px" }}
            />
          </div>
        </div>

        {/* 3. Organization Aggregation */}
        <div style={{ background: colors.surface, padding: "20px", border: "1px solid #dbe6df", borderRadius: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "20px" }}>
            <div>
              <strong style={{ fontSize: "1.1rem", color: colors.text, display: "block", marginBottom: "4px" }}>
                3. Organization (HR) Aggregation
              </strong>
              <p style={{ margin: 0, color: colors.muted, fontSize: "0.9rem", lineHeight: 1.5 }}>
                Allows your eligible numeric inputs to contribute to company-wide aggregate trends
                viewed by HR. HR has{" "}
                <strong>no individual drill-down, no individual shares, and no team participation lists</strong>.
              </p>
            </div>
            <input
              type="checkbox"
              checked={consent.organizationAggregation}
              onChange={() => void handleToggle("organizationAggregation")}
              style={{ transform: "scale(1.4)", cursor: "pointer", marginTop: "4px" }}
            />
          </div>
        </div>

        {/* 4. Notification Channels */}
        <div style={{ background: colors.surface, padding: "20px", border: "1px solid #dbe6df", borderRadius: "12px" }}>
          <strong style={{ fontSize: "1.1rem", color: colors.text, display: "block", marginBottom: "6px" }}>
            4. Notification Delivery Channels
          </strong>
          <p style={{ margin: "0 0 14px", color: colors.muted, fontSize: "0.9rem" }}>
            Choose how you wish to receive personal reminders and access updates. Generic text only;
            no private notes in delivery payloads.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.92rem", color: colors.text }}>
              <input
                type="checkbox"
                checked={consent.notifications.inApp}
                onChange={() => void handleNotificationToggle("inApp")}
              />
              In-app notification inbox
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.92rem", color: colors.text }}>
              <input
                type="checkbox"
                checked={consent.notifications.managerEmail}
                onChange={() => void handleNotificationToggle("managerEmail")}
              />
              Generic manager review email notification (SNS)
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.92rem", color: colors.muted }}>
              <input type="checkbox" disabled checked={false} />
              Mobile device push notifications (Deferred in First Release)
            </label>
          </div>
        </div>

        {/* 5. Export */}
        <div style={{ background: colors.surface, padding: "20px", border: "1px solid #dbe6df", borderRadius: "12px" }}>
          <strong style={{ fontSize: "1.1rem", color: colors.text, display: "block", marginBottom: "6px" }}>
            5. Data Portability &amp; Archive Export
          </strong>
          <p style={{ margin: "0 0 12px", color: colors.muted, fontSize: "0.9rem", lineHeight: 1.5 }}>
            Download a complete JSON archive of all your personal records. The archive contains
            strictly your data — no coworker data or aggregate sets. Generated exports are available
            for 24 hours via a background worker that writes to private S3 storage.
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "12px" }}>
            <button
              onClick={() => void handleRequestExport()}
              disabled={exportPolling || (exportJob?.status === "pending") || (exportJob?.status === "processing")}
              style={{
                padding: "8px 16px",
                background: colors.accent,
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                fontWeight: 600,
                cursor: exportPolling ? "wait" : "pointer",
                fontSize: "0.9rem",
              }}
            >
              {exportPolling ? "Processing…" : "📥 Request My Data Export"}
            </button>
            {exportJob && statusBadge(exportJob)}
          </div>

          {exportPolling && (
            <p style={{ color: colors.muted, fontSize: "0.88rem" }}>
              Export job queued — checking status every 2 seconds…
            </p>
          )}

          {exportJob?.status === "completed" && (
            <div style={{ padding: "12px", background: "#e6f4ea", borderRadius: "8px", display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ color: "#137333", fontSize: "0.9rem" }}>
                ✓ Export ready — download link expires in 24 hours.
              </span>
              <button
                onClick={() => void handleDownload()}
                style={{
                  padding: "6px 14px",
                  background: "#137333",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "0.88rem",
                }}
              >
                Download Archive
              </button>
            </div>
          )}

          {exportJob?.status === "failed" && (
            <div role="alert" style={{ padding: "12px", color: "#b3261e", background: "#fce8e6", borderRadius: "8px" }}>
              Export job failed. Please try again.
            </div>
          )}

          {exportError && (
            <div role="alert" style={{ padding: "12px", color: "#b3261e", background: "#fce8e6", borderRadius: "8px" }}>
              {exportError}
            </div>
          )}
        </div>

        {/* 6. Account Deletion */}
        <div style={{ background: "#fdf6f6", padding: "20px", border: "1px solid #f2c7c7", borderRadius: "12px" }}>
          <strong style={{ fontSize: "1.1rem", color: "#b91c1c", display: "block", marginBottom: "6px" }}>
            6. Danger Zone: Right to Erasure &amp; Account Deletion
          </strong>
          <p style={{ margin: "0 0 14px", color: "#7f1d1d", fontSize: "0.9rem", lineHeight: 1.5 }}>
            Permanently delete your account and all associated personal records in the{" "}
            <code>PRIVATE#</code> partition. This immediately revokes all active sharing grants,
            wipes approved publications and recipient inbox pointers, and synchronously invalidates
            affected team and organization releases. This action is irreversible.
          </p>

          {!deleteJob && (
            <>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.9rem", color: "#7f1d1d", fontWeight: 500, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={confirmDelete}
                    onChange={(e) => setConfirmDelete(e.target.checked)}
                  />
                  I understand that all my personal workload data and active shares will be
                  permanently erased.
                </label>
              </div>
              <button
                onClick={() => void handleDeleteAccount()}
                disabled={!confirmDelete || deletePolling}
                style={{
                  padding: "8px 16px",
                  background: confirmDelete ? "#dc2626" : "#fca5a5",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: 600,
                  cursor: confirmDelete && !deletePolling ? "pointer" : "not-allowed",
                  fontSize: "0.9rem",
                }}
              >
                🗑️ Permanently Delete My Data
              </button>
            </>
          )}

          {deleteJob && (
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {statusBadge(deleteJob)}
              {deletePolling && (
                <span style={{ color: "#7f1d1d", fontSize: "0.88rem" }}>
                  Deletion in progress…
                </span>
              )}
              {deleteJob.status === "completed" && (
                <span style={{ color: "#137333", fontSize: "0.88rem", fontWeight: 600 }}>
                  ✓ Account and personal data deleted.
                </span>
              )}
              {deleteJob.status === "failed" && (
                <span style={{ color: "#b3261e", fontSize: "0.88rem" }}>
                  Deletion failed — contact support.
                </span>
              )}
            </div>
          )}

          {deleteError && (
            <div role="alert" style={{ marginTop: "10px", padding: "12px", color: "#b3261e", background: "#fce8e6", borderRadius: "8px" }}>
              {deleteError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
