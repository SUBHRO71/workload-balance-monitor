import React, { useEffect, useMemo, useState } from "react";
import { WorkloadApiClient } from "@workload/api-client";
import { colors } from "@workload/design-tokens";
import type { Publication, ShareSelection, SharingGrant, SharingGrantInput } from "@workload/contracts";
import { useAuth } from "../auth";
import { useWorkload } from "../context/WorkloadContext";

interface DirectManager {
  userId: string;
  displayName: string;
  teamId: string;
  assignmentVersion: number;
}

const today = () => new Date().toISOString().slice(0, 10);

export const SharingPage: React.FC = () => {
  const auth = useAuth();
  const { tasks, checkIns } = useWorkload();
  const orgId = auth.memberships.find((membership) => membership.status === "active")?.orgId;
  const api = useMemo(() => new WorkloadApiClient({
    baseUrl: import.meta.env.VITE_API_URL as string,
    getAccessToken: async () => auth.accessToken,
    ...(orgId ? { orgId } : {}),
  }), [auth.accessToken, orgId]);
  const [managers, setManagers] = useState<DirectManager[]>([]);
  const [managerId, setManagerId] = useState("");
  const [grants, setGrants] = useState<SharingGrant[]>([]);
  const [isComposing, setIsComposing] = useState(false);
  const [fromDate, setFromDate] = useState(today());
  const [toDate, setToDate] = useState(today());
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [selectedCheckInIds, setSelectedCheckInIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<Publication | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!auth.accessToken || !orgId) return;
    void Promise.all([api.listMyManagers(), api.listMyShares()])
      .then(([managerPage, grantPage]) => {
        setManagers(managerPage.items);
        setManagerId((current) => current || managerPage.items[0]?.userId || "");
        setGrants(grantPage.items);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load sharing data"));
  }, [api, auth.accessToken, orgId]);

  const buildInput = (): SharingGrantInput => {
    const selections: ShareSelection[] = [];
    for (const taskId of selectedTaskIds) {
      const task = tasks.find((item) => item.id === taskId);
      if (task) selections.push({ recordType: "task", recordId: task.id, recordVersion: task.version, fields: ["title", "workDate", "effort", "status"] });
    }
    for (const checkInId of selectedCheckInIds) {
      const checkIn = checkIns.find((item) => item.id === checkInId);
      if (checkIn) selections.push({ recordType: "check_in", recordId: checkIn.id, recordVersion: checkIn.version, fields: ["checkInDate", "manageability"] });
    }
    return {
      recipientManagerId: managerId,
      range: { from: fromDate, to: toDate },
      expiresAt: new Date(Date.now() + expiresInDays * 86_400_000).toISOString(),
      selections,
    };
  };

  const handlePreview = async () => {
    setBusy(true); setError("");
    try { setPreview(await api.createSharePreview(buildInput())); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to build preview"); }
    finally { setBusy(false); }
  };

  const handleConfirm = async () => {
    if (!preview) return;
    setBusy(true); setError("");
    try {
      const result = await api.createShare(buildInput());
      setGrants((current) => [result.grant, ...current]);
      setPreview(null); setSelectedTaskIds([]); setSelectedCheckInIds([]); setIsComposing(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to publish share"); }
    finally { setBusy(false); }
  };

  const handleRevoke = async (grantId: string) => {
    setBusy(true); setError("");
    try {
      const revoked = await api.revokeMyShare(grantId);
      setGrants((current) => current.map((grant) => grant.id === grantId ? revoked : grant));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to revoke share"); }
    finally { setBusy(false); }
  };

  const toggle = (id: string, selected: string[], update: React.Dispatch<React.SetStateAction<string[]>>) => {
    update(selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id]);
    setPreview(null);
  };
  const hasSelection = selectedTaskIds.length + selectedCheckInIds.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: "1.8rem", color: colors.text }}>Explicit Sharing Center</h1>
          <p style={{ margin: 0, color: colors.muted }}>Saved records remain private. Only exact fields in a confirmed snapshot become visible to the selected direct manager.</p>
        </div>
        <button disabled={managers.length === 0} onClick={() => { setIsComposing((value) => !value); setPreview(null); }} style={{ padding: "10px 18px", border: 0, borderRadius: 8, background: colors.accent, color: "white", fontWeight: 600, cursor: managers.length ? "pointer" : "not-allowed" }}>
          {isComposing ? "Close Composer" : "+ New Manager Share"}
        </button>
      </div>
      {managers.length === 0 && <div style={{ padding: 14, background: "#fef7e0", border: "1px solid #f9ab00", borderRadius: 8 }}>No active direct-manager assignment is available. Ask an administrator to assign you to a team before sharing.</div>}
      {error && <div role="alert" style={{ padding: 12, color: "#b3261e", background: "#fce8e6", borderRadius: 8 }}>{error}</div>}

      {isComposing && <section style={{ background: colors.surface, border: `2px solid ${colors.accent}`, borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
        <h2 style={{ margin: 0, color: colors.text }}>Choose the exact snapshot</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
          <label>Direct manager<select value={managerId} onChange={(event) => { setManagerId(event.target.value); setPreview(null); }} style={{ display: "block", width: "100%", padding: 8 }}>{managers.map((manager) => <option key={`${manager.teamId}-${manager.userId}`} value={manager.userId}>{manager.displayName} ({manager.teamId})</option>)}</select></label>
          <label>From<input type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setPreview(null); }} style={{ display: "block", width: "100%", padding: 8 }} /></label>
          <label>To<input type="date" value={toDate} onChange={(event) => { setToDate(event.target.value); setPreview(null); }} style={{ display: "block", width: "100%", padding: 8 }} /></label>
          <label>Expires<select value={expiresInDays} onChange={(event) => { setExpiresInDays(Number(event.target.value)); setPreview(null); }} style={{ display: "block", width: "100%", padding: 8 }}><option value={3}>3 days</option><option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option></select></label>
        </div>
        <div><h3>Tasks</h3>{tasks.length === 0 ? <p style={{ color: colors.muted }}>No saved tasks.</p> : tasks.map((task) => <label key={task.id} style={{ display: "block", margin: "8px 0" }}><input type="checkbox" checked={selectedTaskIds.includes(task.id)} onChange={() => toggle(task.id, selectedTaskIds, setSelectedTaskIds)} /> <strong>{task.title}</strong> — {task.workDate}</label>)}</div>
        <div><h3>Check-ins</h3><p style={{ color: colors.muted, fontSize: ".85rem" }}>Only date and manageability are selectable. Private notes have no sharing path.</p>{checkIns.length === 0 ? <p style={{ color: colors.muted }}>No saved check-ins.</p> : checkIns.map((checkIn) => <label key={checkIn.id} style={{ display: "block", margin: "8px 0" }}><input type="checkbox" checked={selectedCheckInIds.includes(checkIn.id)} onChange={() => toggle(checkIn.id, selectedCheckInIds, setSelectedCheckInIds)} /> {checkIn.checkInDate} — manageability {checkIn.manageability}/5</label>)}</div>
        <button disabled={!hasSelection || !managerId || busy} onClick={() => void handlePreview()} style={{ alignSelf: "flex-start", padding: "10px 18px" }}>{busy ? "Working…" : "Preview server projection"}</button>
        {preview && (
          <div style={{ padding: 16, background: "#f0f7f3", border: "1px solid #a3c9b3", borderRadius: 8 }}>
            <h3 style={{ marginTop: 0 }}>What the manager will see</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: 14 }}>
              {preview.selectedValues.map((item, idx) => {
                const effort = item.values.effort as { value?: unknown; unit?: unknown } | undefined;
                const title = typeof item.values.title === "string" ? item.values.title : item.selection.recordType === "check_in" ? "Voluntary check-in" : "Shared workload item";
                const date = typeof item.values.workDate === "string" ? item.values.workDate : typeof item.values.checkInDate === "string" ? item.values.checkInDate : "—";
                const effortLabel = effort?.value !== undefined ? `${String(effort.value)} ${String(effort.unit ?? "")}` : item.values.manageability !== undefined ? `Manageability ${String(item.values.manageability)}/5` : "—";
                return (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "white", border: "1px solid #c9d8d0", borderRadius: 6, fontSize: "0.9rem" }}>
                    <div>
                      <strong style={{ color: "#276749" }}>{title}</strong>
                      <span style={{ color: "#52635a", fontSize: "0.82rem", marginLeft: 10 }}>{date}</span>
                    </div>
                    <span style={{ color: "#276749", fontWeight: 600, fontSize: "0.88rem" }}>{effortLabel}</span>
                  </div>
                );
              })}
            </div>
            <button disabled={busy} onClick={() => void handleConfirm()} style={{ padding: "10px 18px", background: "#276749", color: "white", border: 0, borderRadius: 6, fontWeight: 600, cursor: busy ? "wait" : "pointer" }}>Confirm and publish</button>
          </div>
        )}
      </section>}

      <section><h2>Active & past sharing grants</h2>{grants.length === 0 ? <p style={{ color: colors.muted }}>No sharing grants created yet.</p> : grants.map((grant) => <div key={grant.id} style={{ background: colors.surface, border: "1px solid #dbe6df", borderRadius: 10, padding: 16, marginBottom: 10, display: "flex", justifyContent: "space-between", gap: 12 }}><div><strong>{grant.status.toUpperCase()}</strong><div style={{ color: colors.muted, marginTop: 4 }}>Manager: {managers.find((manager) => manager.userId === grant.recipientManagerId)?.displayName ?? grant.recipientManagerId}</div><small>{grant.selections.length} selection(s), expires {grant.expiresAt.slice(0, 10)}</small></div>{grant.status === "active" && <button disabled={busy} onClick={() => void handleRevoke(grant.id)}>Revoke access</button>}</div>)}</section>
    </div>
  );
};
