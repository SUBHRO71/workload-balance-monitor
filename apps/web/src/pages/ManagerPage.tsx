import React, { useEffect, useMemo, useState } from "react";
import { WorkloadApiClient } from "@workload/api-client";
import { colors } from "@workload/design-tokens";
import type { HumanActionRecord, Publication, SharingGrant } from "@workload/contracts";
import { useAuth } from "../auth";

interface MockPublication {
  grantId: string;
  ownerDisplayName: string;
  range: { from: string; to: string };
  expiresAt: string;
  items: Array<{ title: string; date: string; effort: string; status: string }>;
}

function publicationCard(grant: SharingGrant, publication: Publication): MockPublication {
  return {
    grantId: grant.id,
    ownerDisplayName: `Direct report ${grant.ownerId}`,
    range: grant.range,
    expiresAt: grant.expiresAt.slice(0, 10),
    items: publication.selectedValues.map(({ selection, values }) => {
      const effort = values.effort as { value?: unknown; unit?: unknown } | undefined;
      return {
        title: typeof values.title === "string" ? values.title : selection.recordType === "check_in" ? "Voluntary check-in" : "Shared workload item",
        date: typeof values.workDate === "string" ? values.workDate : typeof values.checkInDate === "string" ? values.checkInDate : "",
        effort: effort && effort.value !== undefined ? `${String(effort.value)} ${String(effort.unit ?? "")}` : values.manageability !== undefined ? `Manageability ${String(values.manageability)}/5` : "",
        status: typeof values.status === "string" ? values.status : "shared",
      };
    }),
  };
}

interface MockTeamAggregate {
  teamId: string;
  teamName: string;
  state: "available" | "insufficient_contributors" | "unsafe_overlap" | "invalid";
  range: { startDate: string; endDate: string };
  generatedAt: string;
  evidenceStrength: "limited" | "developing" | "consistent";
  metrics?: Array<{
    key: "meanWeeklyEffort" | "meanManageability";
    value: number;
    contributorCountBand: "5-9" | "10-19" | "20+";
  }>;
  reason?: string;
}

export const ManagerPage: React.FC = () => {
  const auth = useAuth();
  const orgId = auth.memberships.find((membership) => membership.status === "active")?.orgId;
  const api = useMemo(() => new WorkloadApiClient({
    baseUrl: import.meta.env.VITE_API_URL as string,
    getAccessToken: async () => auth.accessToken,
    ...(orgId ? { orgId } : {}),
  }), [auth.accessToken, orgId]);
  const [activeTab, setActiveTab] = useState<"aggregates" | "shares" | "actions">("shares");
  const [shareError, setShareError] = useState("");

  const [actions, setActions] = useState<HumanActionRecord[]>([]);
  const [newActionRationale, setNewActionRationale] = useState("");
  const [newActionFollowUp, setNewActionFollowUp] = useState("");

  const [publications, setPublications] = useState<MockPublication[]>([]);

  useEffect(() => {
    if (!auth.accessToken || !orgId) return;
    void api.listManagerShares()
      .then((page) => setPublications(page.items.map(({ grant, publication }) => publicationCard(grant, publication))))
      .catch((cause: unknown) => setShareError(cause instanceof Error ? cause.message : "Unable to load shared publications"));
  }, [api, auth.accessToken, orgId]);

  const [teamAggregates, setTeamAggregates] = useState<MockTeamAggregate[]>([]);
  const [aggregatesLoading, setAggregatesLoading] = useState(true);

  useEffect(() => {
    if (!auth.accessToken || !orgId) return;
    setAggregatesLoading(true);
    void api.getManagerTeams().then(async ({ items }) => {
      const aggregates = await Promise.all(items.map(async ({ teamId }): Promise<MockTeamAggregate> => {
        const result = await api.getTeamTrends(teamId);
        const aggregate: MockTeamAggregate = {
          teamId,
          teamName: teamId,
          state: result.state === "stale" ? "invalid" as const : result.state,
          range: { startDate: result.range.from, endDate: result.range.to },
          generatedAt: result.generatedAt ?? "Not generated",
          evidenceStrength: result.evidenceStrength,
        };
        if (result.metrics) aggregate.metrics = result.metrics.filter((metric) => metric.key !== "capacityRatio") as NonNullable<MockTeamAggregate["metrics"]>;
        if (result.reason) aggregate.reason = result.reason;
        return aggregate;
      }));
      setTeamAggregates(aggregates);
      setSelectedTeamId((current) => current || aggregates[0]?.teamId || "");
    }).catch(() => setTeamAggregates([]))
      .finally(() => setAggregatesLoading(false));
  }, [api, auth.accessToken, orgId]);

  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const selectedTeam = teamAggregates.find((t) => t.teamId === selectedTeamId) ?? teamAggregates[0] ?? {
    teamId: "",
    teamName: "No assigned teams",
    state: "insufficient_contributors" as const,
    range: { startDate: "—", endDate: "—" },
    generatedAt: "Not generated",
    evidenceStrength: "limited" as const,
    reason: "No active manager team assignment is available.",
  };

  useEffect(() => {
    if (!selectedTeamId) { setActions([]); return; }
    void api.listManagerTeamActions(selectedTeamId).then(({ items }) => setActions(items)).catch(() => setActions([]));
  }, [api, selectedTeamId]);

  const recordAction = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newActionRationale || !selectedTeamId) return;
    const created = await api.createManagerTeamAction(selectedTeamId, {
      rationale: newActionRationale,
      status: "open",
      ...(newActionFollowUp ? { followUpAt: new Date(`${newActionFollowUp}T00:00:00.000Z`).toISOString() } : {}),
    });
    setActions((current) => [created, ...current]);
    setNewActionRationale("");
    setNewActionFollowUp("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
          <h1 style={{ margin: 0, fontSize: "1.8rem", color: colors.text }}>
            Manager Workspace
          </h1>
          <span
            style={{
              padding: "2px 10px",
              background: "#e8f0fe",
              color: "#1a73e8",
              borderRadius: "12px",
              fontSize: "0.75rem",
              fontWeight: 600,
            }}
          >
            MANAGER ROLE
          </span>
        </div>
        <p style={{ margin: 0, color: colors.muted, fontSize: "0.95rem" }}>
          Assigned-team aggregate releases and view-only direct report publications. No employee ranking, no individual surveillance, and no access to unshared private workspaces.
        </p>
      </div>

      <div
        style={{
          background: "#fef7e0",
          border: "1px solid #f9ab00",
          borderRadius: "8px",
          padding: "14px 18px",
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
          fontSize: "0.85rem",
          color: "#7a4100",
        }}
      >
        <span style={{ fontSize: "1.2rem" }}>ℹ️</span>
        <div>
          <strong>Privacy Boundary Enforced:</strong> Manager Lambda functions are strictly IAM-denied from reading
          employee <code>PRIVATE#</code> partitions. Team aggregates require ≥5 consenting contributors; publications require explicit user confirmation.
        </div>
      </div>

      {/* Sub-tab selection */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid #dbe6df", paddingBottom: "8px" }}>
        <button
          onClick={() => setActiveTab("aggregates")}
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            border: "none",
            background: activeTab === "aggregates" ? colors.accent : "transparent",
            color: activeTab === "aggregates" ? "#ffffff" : colors.text,
            fontWeight: activeTab === "aggregates" ? 600 : 500,
            cursor: "pointer",
          }}
        >
          📈 Team Aggregates ({teamAggregates.length} Teams)
        </button>
        <button
          onClick={() => setActiveTab("shares")}
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            border: "none",
            background: activeTab === "shares" ? colors.accent : "transparent",
            color: activeTab === "shares" ? "#ffffff" : colors.text,
            fontWeight: activeTab === "shares" ? 600 : 500,
            cursor: "pointer",
          }}
        >
          🤝 Shared Publications ({publications.length})
        </button>

        <button
          onClick={() => setActiveTab("actions")}
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            border: "none",
            background: activeTab === "actions" ? colors.accent : "transparent",
            color: activeTab === "actions" ? "#ffffff" : colors.text,
            fontWeight: activeTab === "actions" ? 600 : 500,
            cursor: "pointer",
          }}
        >
          📋 Human Decisions ({actions.length})
        </button>
      </div>

      {/* Team Aggregates Tab */}
      {activeTab === "aggregates" && (
        <section style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {aggregatesLoading && (
            <p style={{ color: colors.muted }}>Loading team aggregates…</p>
          )}
          {!aggregatesLoading && teamAggregates.length === 0 && (
            <div style={{ padding: "20px", background: "#fef7e0", border: "1px solid #feefc3", borderRadius: "8px", color: "#7a4100" }}>
              No assigned teams found for your account. Contact an administrator to assign you to a team.
            </div>
          )}
          {!aggregatesLoading && teamAggregates.length > 0 && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "0.9rem", color: colors.muted, fontWeight: 600 }}>Select Team:</span>
            {teamAggregates.map((t) => (
              <button
                key={t.teamId}
                onClick={() => setSelectedTeamId(t.teamId)}
                style={{
                  padding: "6px 14px",
                  borderRadius: "6px",
                  border: "1px solid #dbe6df",
                  background: selectedTeamId === t.teamId ? colors.accent : colors.surface,
                  color: selectedTeamId === t.teamId ? "#ffffff" : colors.text,
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  fontWeight: selectedTeamId === t.teamId ? 600 : 400,
                }}
              >
                {t.teamName}
              </button>
            ))}
          </div>

          <div
            style={{
              background: colors.surface,
              border: "1px solid #dbe6df",
              borderRadius: "12px",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <strong style={{ fontSize: "1.1rem", color: colors.text, display: "block" }}>
                  {selectedTeam.teamName} — Weekly Aggregate Release
                </strong>
                <span style={{ fontSize: "0.85rem", color: colors.muted }}>
                  Window: {selectedTeam.range.startDate} to {selectedTeam.range.endDate} | Evidence: {selectedTeam.evidenceStrength.toUpperCase()}
                </span>
              </div>
              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: "6px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  background: selectedTeam.state === "available" ? "#e6f4ea" : "#fef7e0",
                  color: selectedTeam.state === "available" ? "#137333" : "#b06000",
                }}
              >
                {selectedTeam.state === "available" ? "DISCLOSED (≥5 CONTRIBUTORS)" : "SUPPRESSED (<5 CONTRIBUTORS)"}
              </span>
            </div>

            {selectedTeam.state === "available" && selectedTeam.metrics && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
                {selectedTeam.metrics.map((metric) => (
                  <div
                    key={metric.key}
                    style={{
                      background: "#f9fbfa",
                      borderRadius: "8px",
                      padding: "14px",
                      border: "1px solid #eef3f0",
                    }}
                  >
                    <div style={{ fontSize: "0.85rem", color: colors.muted, marginBottom: "4px" }}>
                      {metric.key === "meanWeeklyEffort" ? "Mean Weekly Effort" : "Mean Manageability"}
                    </div>
                    <div style={{ fontSize: "1.6rem", fontWeight: 700, color: colors.accent }}>
                      {metric.value} {metric.key === "meanWeeklyEffort" ? "hrs" : "/ 5"}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: colors.muted, marginTop: "4px" }}>
                      Contributor Cohort Band: <strong>{metric.contributorCountBand} members</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedTeam.state !== "available" && (
              <div
                style={{
                  background: "#fef7e0",
                  border: "1px solid #feefc3",
                  borderRadius: "8px",
                  padding: "16px",
                  color: "#7a4100",
                  fontSize: "0.9rem",
                }}
              >
                <strong>🔒 Protected Release Suppressed:</strong> {selectedTeam.reason}
              </div>
            )}
          </div>
            </>
          )}
        </section>
      )}

      {/* Shared Publications Tab */}
      {activeTab === "shares" && (
        <section style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <h2 style={{ margin: 0, fontSize: "1.2rem", color: colors.text }}>
            Active Direct Report Publications ({publications.length})
          </h2>

          {shareError && <div role="alert" style={{ padding: "12px", color: "#b3261e", background: "#fce8e6", borderRadius: "8px" }}>{shareError}</div>}
          {!shareError && publications.length === 0 && <p style={{ color: colors.muted }}>No member has explicitly published a workload snapshot to you.</p>}

          {publications.map((pub) => (
            <div
              key={pub.grantId}
              style={{
                background: colors.surface,
                border: "1px solid #dbe6df",
                borderRadius: "12px",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <strong style={{ fontSize: "1.1rem", color: colors.text, display: "block" }}>
                    {pub.ownerDisplayName}
                  </strong>
                  <span style={{ fontSize: "0.85rem", color: colors.muted }}>
                    Grant ID: {pub.grantId} | Reporting Range: {pub.range.from} to {pub.range.to}
                  </span>
                </div>
                <div
                  style={{
                    background: "#e6f4ea",
                    color: "#137333",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    padding: "4px 10px",
                    borderRadius: "6px",
                  }}
                >
                  ACTIVE (Expires {pub.expiresAt})
                </div>
              </div>

              <div style={{ borderTop: "1px solid #eef3f0", paddingTop: "12px" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: colors.muted, marginBottom: "8px" }}>
                  USER-APPROVED WORKLOAD ITEMS:
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {pub.items.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 12px",
                        background: "#f9fbfa",
                        borderRadius: "6px",
                        fontSize: "0.9rem",
                      }}
                    >
                      <div>
                        <strong style={{ color: colors.text }}>{item.title}</strong>
                        <span style={{ color: colors.muted, fontSize: "0.8rem", marginLeft: "10px" }}>
                          {item.date}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "0.85rem", color: colors.accent, fontWeight: 600 }}>
                          {item.effort}
                        </span>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            background: item.status === "done" ? "#e6f4ea" : "#fef7e0",
                            color: item.status === "done" ? "#137333" : "#b06000",
                          }}
                        >
                          {item.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Human Actions Tab */}
      {activeTab === "actions" && (
        <section style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* New Action Form */}
          <div style={{ background: colors.surface, padding: "20px", borderRadius: "10px", border: "1px solid #e0eae4" }}>
            <h3 style={{ margin: "0 0 8px 0", color: colors.text, fontSize: "1.1rem" }}>
              Record Team Workload Decision
            </h3>
            <p style={{ margin: "0 0 16px 0", color: colors.muted, fontSize: "0.88rem" }}>
              Document manager actions and follow-up plans. Action records reference authorized releases without copying private text or shared field values.
            </p>

            <form
              onSubmit={(event) => void recordAction(event)}
              style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            >
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: colors.muted, marginBottom: "4px" }}>
                  Human Rationale & Action Plan
                </label>
                <textarea
                  rows={3}
                  value={newActionRationale}
                  onChange={(e) => setNewActionRationale(e.target.value)}
                  placeholder="Explain the workload context and agreed adjustments (e.g. reprioritizing roadmap tasks, adjusting sprint velocity, schedule recovery)..."
                  required
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "6px", border: "1px solid #cedcd3", fontSize: "0.9rem" }}
                />
              </div>

              <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
                <div style={{ width: "180px" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", color: colors.muted, marginBottom: "4px" }}>
                    Follow-up Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={newActionFollowUp}
                    onChange={(e) => setNewActionFollowUp(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cedcd3" }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={!selectedTeamId}
                  style={{
                    padding: "9px 20px",
                    borderRadius: "6px",
                    border: "none",
                    background: colors.accent,
                    color: "#ffffff",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Record Action
                </button>
              </div>
            </form>
          </div>

          {/* Actions List */}
          <div style={{ background: colors.surface, padding: "20px", borderRadius: "10px", border: "1px solid #e0eae4" }}>
            <h3 style={{ margin: "0 0 16px 0", color: colors.text, fontSize: "1.1rem" }}>
              Decision History ({actions.length})
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {actions.map((act) => (
                <div
                  key={act.id}
                  style={{
                    padding: "16px",
                    background: "#fafcfb",
                    border: "1px solid #e5ede8",
                    borderRadius: "8px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong style={{ color: colors.text, fontSize: "0.95rem" }}>{act.authorName}</strong>
                      <span style={{ color: colors.muted, fontSize: "0.85rem", marginLeft: "10px" }}>
                        Team: {act.teamId ?? "All"}
                      </span>
                    </div>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "4px",
                        background: act.status === "resolved" ? "#e6f4ea" : act.status === "in_progress" ? "#e8f0fe" : "#fef7e0",
                        color: act.status === "resolved" ? "#137333" : act.status === "in_progress" ? "#1a73e8" : "#b06000",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                      }}
                    >
                      {act.status.toUpperCase()}
                    </span>
                  </div>
                  <p style={{ margin: 0, color: colors.text, fontSize: "0.9rem", lineHeight: 1.5 }}>
                    {act.rationale}
                  </p>
                  <div style={{ display: "flex", justifyContent: "space-between", color: colors.muted, fontSize: "0.8rem", marginTop: "4px" }}>
                    <span>Recorded: {new Date(act.createdAt).toLocaleDateString()}</span>
                    {act.followUpAt && <span>Follow-up scheduled: {act.followUpAt}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
