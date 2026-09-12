import React, { useState } from "react";
import { colors } from "@workload/design-tokens";
import { useWorkload } from "../context/WorkloadContext";
import type { Publication, ShareSelection, SharingGrant, TaskShareField } from "@workload/contracts";

export const SharingPage: React.FC = () => {
  const { tasks, checkIns } = useWorkload();

  // Synthetic local sharing state for Demo Mode
  const [grants, setGrants] = useState<SharingGrant[]>([
    {
      entityType: "SHARING_GRANT",
      id: "grant-sample-01",
      orgId: "demo-org",
      ownerId: "demo-user",
      recipientManagerId: "manager-demo",
      range: { from: "2026-03-01", to: "2026-03-15" },
      expiresAt: new Date(Date.now() + 5 * 86400000).toISOString(),
      selections: [
        { recordType: "task", recordId: tasks[0]?.id ?? "task-1", recordVersion: 1, fields: ["title", "effort", "status"] },
      ],
      status: "active",
      gateGeneration: 1,
      assignmentVersion: 1,
      schemaVersion: 1,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);

  const [isComposing, setIsComposing] = useState(false);
  const [fromDate, setFromDate] = useState("2026-03-01");
  const [toDate, setToDate] = useState("2026-03-15");
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [selectedCheckInIds, setSelectedCheckInIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<Publication | null>(null);

  const directManagerName = "Sarah Chen (Engineering Lead)";
  const directManagerId = "manager-demo";

  const handleToggleTask = (taskId: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId],
    );
  };

  const handleToggleCheckIn = (checkInId: string) => {
    setSelectedCheckInIds((prev) =>
      prev.includes(checkInId) ? prev.filter((id) => id !== checkInId) : [...prev, checkInId],
    );
  };

  const handleBuildPreview = () => {
    const expiresAt = new Date(Date.now() + expiresInDays * 86400000).toISOString();
    const selections: ShareSelection[] = [];
    const selectedValues: Publication["selectedValues"] = [];

    for (const taskId of selectedTaskIds) {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) continue;
      const selection: ShareSelection = {
        recordType: "task",
        recordId: task.id,
        recordVersion: task.version,
        fields: ["title", "workDate", "effort", "status"] as TaskShareField[],
      };
      selections.push(selection);
      selectedValues.push({
        selection,
        values: { title: task.title, workDate: task.workDate, effort: task.effort, status: task.status },
      });
    }

    for (const checkInId of selectedCheckInIds) {
      const checkIn = checkIns.find((c) => c.id === checkInId);
      if (!checkIn) continue;
      const selection: ShareSelection = {
        recordType: "check_in",
        recordId: checkIn.id,
        recordVersion: checkIn.version,
        fields: ["checkInDate", "manageability"],
      };
      selections.push(selection);
      selectedValues.push({
        selection,
        values: { checkInDate: checkIn.checkInDate, manageability: checkIn.manageability },
      });
    }

    const previewPublication: Publication = {
      entityType: "PUBLICATION",
      grantId: "preview",
      publicationVersion: 1,
      orgId: "demo-org",
      ownerId: "demo-user",
      recipientManagerId: directManagerId,
      range: { from: fromDate, to: toDate },
      expiresAt,
      selectedValues,
      schemaVersion: 1,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setPreview(previewPublication);
  };

  const handleConfirmShare = () => {
    if (!preview || preview.selectedValues.length === 0) return;
    const now = new Date().toISOString();
    const grantId = `grant-${Date.now()}`;
    const newGrant: SharingGrant = {
      entityType: "SHARING_GRANT",
      id: grantId,
      orgId: "demo-org",
      ownerId: "demo-user",
      recipientManagerId: directManagerId,
      range: preview.range,
      expiresAt: preview.expiresAt,
      selections: preview.selectedValues.map((v) => v.selection),
      status: "active",
      gateGeneration: 1,
      assignmentVersion: 1,
      schemaVersion: 1,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    setGrants([newGrant, ...grants]);
    setIsComposing(false);
    setPreview(null);
    setSelectedTaskIds([]);
    setSelectedCheckInIds([]);
  };

  const handleRevoke = (grantId: string) => {
    setGrants((prev) =>
      prev.map((g) => (g.id === grantId ? { ...g, status: "revoked" as const, updatedAt: new Date().toISOString() } : g)),
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: "1.8rem", color: colors.text }}>
            Explicit Sharing Center
          </h1>
          <p style={{ margin: 0, color: colors.muted, fontSize: "0.95rem" }}>
            Share frozen, exact snapshots with your named direct manager. Recipient cannot see private notes.
          </p>
        </div>
        <button
          onClick={() => { setIsComposing(!isComposing); setPreview(null); }}
          style={{
            background: colors.accent,
            color: "#ffffff",
            border: "none",
            borderRadius: "8px",
            padding: "10px 18px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {isComposing ? "Close Composer" : "+ New Manager Share"}
        </button>
      </div>

      {isComposing ? (
        <section
          style={{
            background: colors.surface,
            border: `2px solid ${colors.accent}`,
            borderRadius: "12px",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "1.3rem", color: colors.text }}>
            Share Composer: Exact Snapshot
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", color: colors.muted, marginBottom: "4px" }}>
                Recipient (Direct Manager)
              </label>
              <input
                type="text"
                disabled
                value={directManagerName}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #c2d1c7", background: "#f1f5f3" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", color: colors.muted, marginBottom: "4px" }}>
                Range From
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #c2d1c7" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", color: colors.muted, marginBottom: "4px" }}>
                Range To
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #c2d1c7" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", color: colors.muted, marginBottom: "4px" }}>
                Expires After
              </label>
              <select
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(Number(e.target.value))}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #c2d1c7" }}
              >
                <option value={3}>3 days</option>
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
              </select>
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: "1rem", margin: "0 0 10px", color: colors.text }}>
              Select Tasks to Include:
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "150px", overflowY: "auto" }}>
              {tasks.map((task) => (
                <label key={task.id} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.9rem" }}>
                  <input
                    type="checkbox"
                    checked={selectedTaskIds.includes(task.id)}
                    onChange={() => handleToggleTask(task.id)}
                  />
                  <span>
                    <strong>{task.title}</strong> — {task.workDate} ({task.effort.value} {task.effort.unit})
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: "1rem", margin: "0 0 10px", color: colors.text }}>
              Select Check-ins to Include (Note: private notes are strictly omitted):
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "150px", overflowY: "auto" }}>
              {checkIns.map((checkIn) => (
                <label key={checkIn.id} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.9rem" }}>
                  <input
                    type="checkbox"
                    checked={selectedCheckInIds.includes(checkIn.id)}
                    onChange={() => handleToggleCheckIn(checkIn.id)}
                  />
                  <span>
                    Date: {checkIn.checkInDate} — Manageability Rating: {checkIn.manageability}/5
                  </span>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={handleBuildPreview}
            disabled={selectedTaskIds.length === 0 && selectedCheckInIds.length === 0}
            style={{
              alignSelf: "flex-start",
              padding: "10px 18px",
              background: colors.accent,
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              cursor: selectedTaskIds.length > 0 || selectedCheckInIds.length > 0 ? "pointer" : "not-allowed",
              fontWeight: 600,
            }}
          >
            🔍 Preview Recipient Projection
          </button>

          {preview ? (
            <div
              style={{
                background: "#f0f7f3",
                border: "1px solid #a3c9b3",
                borderRadius: "8px",
                padding: "16px",
                marginTop: "10px",
              }}
            >
              <h4 style={{ margin: "0 0 8px", color: colors.accent }}>
                Server Projection Preview (What Manager Will See)
              </h4>
              <p style={{ margin: "0 0 12px", fontSize: "0.85rem", color: colors.muted }}>
                Grant to: <strong>{preview.recipientManagerId}</strong> | Range: {preview.range.from} to {preview.range.to} | Expires: {preview.expiresAt.slice(0, 10)}
              </p>
              <pre
                style={{
                  background: "#ffffff",
                  padding: "12px",
                  borderRadius: "6px",
                  border: "1px solid #dbe6df",
                  fontSize: "0.85rem",
                  overflowX: "auto",
                }}
              >
                {JSON.stringify(preview.selectedValues, null, 2)}
              </pre>

              <button
                onClick={handleConfirmShare}
                style={{
                  marginTop: "12px",
                  background: colors.accent,
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "10px 20px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                ✓ Confirm & Publish Share
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      <section style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <h2 style={{ margin: 0, fontSize: "1.2rem", color: colors.text }}>
          Active & Past Sharing Grants
        </h2>
        {grants.length === 0 ? (
          <p style={{ color: colors.muted, fontStyle: "italic" }}>No sharing grants created yet.</p>
        ) : (
          grants.map((grant) => {
            const isReadable = grant.status === "active" && new Date(grant.expiresAt).getTime() > Date.now();
            return (
              <div
                key={grant.id}
                style={{
                  background: colors.surface,
                  border: `1px solid ${isReadable ? "#bce2cb" : "#e0e0e0"}`,
                  borderRadius: "10px",
                  padding: "16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <strong style={{ color: colors.text }}>{grant.id}</strong>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "12px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        background: grant.status === "active" ? "#e6f4ea" : grant.status === "revoked" ? "#fce8e6" : "#f1f3f4",
                        color: grant.status === "active" ? "#137333" : grant.status === "revoked" ? "#c5221f" : "#5f6368",
                      }}
                    >
                      {grant.status.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.85rem", color: colors.muted }}>
                    Recipient: <strong>{grant.recipientManagerId}</strong> | Range: {grant.range.from} to {grant.range.to}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: colors.muted, marginTop: "2px" }}>
                    Selections: {grant.selections.length} items | Expires: {grant.expiresAt.slice(0, 10)}
                  </div>
                </div>

                {grant.status === "active" ? (
                  <button
                    onClick={() => handleRevoke(grant.id)}
                    style={{
                      background: "none",
                      border: "1px solid #c5221f",
                      color: "#c5221f",
                      padding: "6px 14px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Revoke Access
                  </button>
                ) : (
                  <span style={{ fontSize: "0.85rem", color: colors.muted }}>No longer accessible</span>
                )}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
};
