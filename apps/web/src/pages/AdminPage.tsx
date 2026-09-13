import React, { useEffect, useMemo, useState } from "react";
import { WorkloadApiClient } from "@workload/api-client";
import { colors } from "@workload/design-tokens";
import type {
  AdminAuditRecord,
  InvitationRecord,
  Membership,
  OrganizationPolicy,
  OrganizationRole,
  TeamRecord,
} from "@workload/contracts";
import { useAuth } from "../auth";

export const AdminPage: React.FC = () => {
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

  const [activeSection, setActiveSection] = useState<"members" | "teams" | "policy" | "audit">(
    "members",
  );

  // --- Members & Invitations ---
  const [members, setMembers] = useState<Membership[]>([]);
  const [invitations, setInvitations] = useState<InvitationRecord[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState("");

  // --- Teams ---
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamsError, setTeamsError] = useState("");

  // --- Policy ---
  const [policy, setPolicy] = useState<OrganizationPolicy | null>(null);
  const [policyLoading, setPolicyLoading] = useState(true);
  const [policyError, setPolicyError] = useState("");

  // --- Audit ---
  const [auditLogs, setAuditLogs] = useState<AdminAuditRecord[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditError, setAuditError] = useState("");

  // --- Forms ---
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrganizationRole>("member");
  const [newTeamId, setNewTeamId] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [newFloorInput, setNewFloorInput] = useState("");
  const [feedback, setFeedback] = useState<{ message: string; type: "success" | "error" } | null>(
    null,
  );
  const [formBusy, setFormBusy] = useState(false);

  // Load data for each section when it becomes active
  useEffect(() => {
    if (!auth.accessToken || !orgId) return;
    if (activeSection === "members") {
      setMembersLoading(true);
      void Promise.all([api.listAdminMembers(), api.listAdminInvitations()])
        .then(([{ items: m }, { items: inv }]) => {
          setMembers(m);
          setInvitations(inv);
        })
        .catch((cause: unknown) =>
          setMembersError(
            cause instanceof Error ? cause.message : "Unable to load members",
          ),
        )
        .finally(() => setMembersLoading(false));
    } else if (activeSection === "teams") {
      setTeamsLoading(true);
      void api
        .listAdminTeams()
        .then(({ items }) => setTeams(items))
        .catch((cause: unknown) =>
          setTeamsError(
            cause instanceof Error ? cause.message : "Unable to load teams",
          ),
        )
        .finally(() => setTeamsLoading(false));
    } else if (activeSection === "policy") {
      setPolicyLoading(true);
      void api
        .getAdminPolicy()
        .then((p) => {
          setPolicy(p);
          setNewFloorInput(String(p.minimumContributors));
        })
        .catch((cause: unknown) =>
          setPolicyError(
            cause instanceof Error ? cause.message : "Unable to load policy",
          ),
        )
        .finally(() => setPolicyLoading(false));
    } else if (activeSection === "audit") {
      setAuditLoading(true);
      void api
        .listAdminAuditEvents()
        .then(({ items }) => setAuditLogs(items))
        .catch((cause: unknown) =>
          setAuditError(
            cause instanceof Error ? cause.message : "Unable to load audit log",
          ),
        )
        .finally(() => setAuditLoading(false));
    }
  }, [api, auth.accessToken, orgId, activeSection]);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setFormBusy(true);
    setFeedback(null);
    try {
      const newInvite = await api.createAdminInvitation({
        email: inviteEmail,
        roles: [inviteRole],
      });
      setInvitations((prev) => [newInvite, ...prev]);
      setInviteEmail("");
      setFeedback({ message: `Invitation dispatched to ${inviteEmail}.`, type: "success" });
    } catch (cause) {
      setFeedback({
        message: cause instanceof Error ? cause.message : "Failed to create invitation",
        type: "error",
      });
    } finally {
      setFormBusy(false);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    const teamId = (newTeamId.trim() || newTeamName.toLowerCase().replace(/[^a-z0-9_-]+/g, "-")).slice(0, 96);
    if (!teamId) return;
    setFormBusy(true);
    setFeedback(null);
    try {
      const newTeam = await api.createAdminTeam({ teamId, teamName: newTeamName.trim() });
      setTeams((prev) => [...prev, newTeam]);
      setNewTeamId("");
      setNewTeamName("");
      setFeedback({ message: `Team "${newTeam.teamName}" created.`, type: "success" });
    } catch (cause) {
      setFeedback({
        message: cause instanceof Error ? cause.message : "Failed to create team",
        type: "error",
      });
    } finally {
      setFormBusy(false);
    }
  };

  const handleUpdatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(newFloorInput, 10);
    if (isNaN(val) || val < 5) {
      setFeedback({
        message: "Privacy floor cannot be lowered below 5 distinct contributors.",
        type: "error",
      });
      return;
    }
    setFormBusy(true);
    setFeedback(null);
    try {
      const updated = await api.patchAdminPolicy({ minimumContributors: val });
      setPolicy(updated);
      setFeedback({
        message: `Privacy floor updated to ${updated.minimumContributors} contributors.`,
        type: "success",
      });
    } catch (cause) {
      setFeedback({
        message: cause instanceof Error ? cause.message : "Failed to update policy",
        type: "error",
      });
    } finally {
      setFormBusy(false);
    }
  };

  const handleDeactivateMember = async (userId: string) => {
    setFormBusy(true);
    setFeedback(null);
    try {
      const updated = await api.updateAdminMember(userId, { status: "inactive" });
      setMembers((prev) => prev.map((m) => (m.userId === updated.userId ? updated : m)));
      setFeedback({ message: "Member deactivated.", type: "success" });
    } catch (cause) {
      setFeedback({
        message: cause instanceof Error ? cause.message : "Failed to deactivate member",
        type: "error",
      });
    } finally {
      setFormBusy(false);
    }
  };

  const sectionBtn = (id: typeof activeSection, label: string) => (
    <button
      onClick={() => { setActiveSection(id); setFeedback(null); }}
      style={{
        padding: "8px 16px",
        borderRadius: "6px",
        border: "none",
        background: activeSection === id ? colors.accent : "transparent",
        color: activeSection === id ? "#ffffff" : colors.text,
        fontWeight: activeSection === id ? 600 : 500,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
          <h1 style={{ margin: 0, fontSize: "1.8rem", color: colors.text }}>
            Organization Administration
          </h1>
          <span
            style={{
              padding: "2px 10px",
              background: "#fce8e6",
              color: "#c5221f",
              borderRadius: "12px",
              fontSize: "0.75rem",
              fontWeight: 600,
            }}
          >
            ORG ADMIN
          </span>
        </div>
        <p style={{ margin: 0, color: colors.muted, fontSize: "0.95rem" }}>
          Manage organization membership, team structure, privacy policy, and administrative audit.
          No personal workload data or consent records are accessible here.
        </p>
      </div>

      {/* Section nav */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid #dbe6df", paddingBottom: "8px" }}>
        {sectionBtn("members", "👥 Members & Invitations")}
        {sectionBtn("teams", "🏗️ Teams")}
        {sectionBtn("policy", "📋 Privacy Policy")}
        {sectionBtn("audit", "🔍 Audit Log")}
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          role="alert"
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            background: feedback.type === "success" ? "#e6f4ea" : "#fce8e6",
            color: feedback.type === "success" ? "#137333" : "#b3261e",
            fontWeight: 500,
          }}
        >
          {feedback.message}
        </div>
      )}

      {/* Members & Invitations */}
      {activeSection === "members" && (
        <section style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Invite form */}
          <div
            style={{
              background: colors.surface,
              padding: "20px",
              borderRadius: "10px",
              border: "1px solid #e0eae4",
            }}
          >
            <h3 style={{ margin: "0 0 14px", color: colors.text }}>Send Invitation</h3>
            <form
              onSubmit={(e) => void handleSendInvite(e)}
              style={{ display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap" }}
            >
              <div style={{ flex: 1, minWidth: "200px" }}>
                <label style={{ display: "block", fontSize: "0.85rem", color: colors.muted, marginBottom: "4px" }}>
                  Email address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cedcd3", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: colors.muted, marginBottom: "4px" }}>
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as OrganizationRole)}
                  style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #cedcd3" }}
                >
                  <option value="member">Member</option>
                  <option value="manager">Manager</option>
                  <option value="hr">HR</option>
                  <option value="org_admin">Org Admin</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={formBusy}
                style={{
                  padding: "9px 20px",
                  borderRadius: "6px",
                  border: "none",
                  background: colors.accent,
                  color: "#ffffff",
                  fontWeight: 600,
                  cursor: formBusy ? "wait" : "pointer",
                }}
              >
                {formBusy ? "Sending…" : "Send Invitation"}
              </button>
            </form>
          </div>

          {/* Pending invitations */}
          {invitations.length > 0 && (
            <div style={{ background: colors.surface, padding: "20px", borderRadius: "10px", border: "1px solid #e0eae4" }}>
              <h3 style={{ margin: "0 0 12px", color: colors.text }}>Pending Invitations ({invitations.length})</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {invitations.map((inv) => (
                  <div key={inv.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "#fef7e0", borderRadius: "6px", fontSize: "0.9rem" }}>
                    <span><strong>{inv.email}</strong> — {inv.roles.join(", ")}</span>
                    <span style={{ color: colors.muted }}>Expires {inv.expiresAt.slice(0, 10)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active members */}
          <div style={{ background: colors.surface, padding: "20px", borderRadius: "10px", border: "1px solid #e0eae4" }}>
            <h3 style={{ margin: "0 0 12px", color: colors.text }}>Organization Members</h3>
            {membersLoading && <p style={{ color: colors.muted }}>Loading members…</p>}
            {membersError && (
              <div role="alert" style={{ padding: "12px", color: "#b3261e", background: "#fce8e6", borderRadius: "8px" }}>{membersError}</div>
            )}
            {!membersLoading && !membersError && members.length === 0 && (
              <p style={{ color: colors.muted }}>No members found.</p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {members.map((m) => (
                <div
                  key={m.userId}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 14px",
                    background: "#fafcfb",
                    border: "1px solid #e5ede8",
                    borderRadius: "8px",
                  }}
                >
                  <div>
                    <strong style={{ color: colors.text }}>{m.displayName}</strong>
                    <span style={{ color: colors.muted, fontSize: "0.85rem", marginLeft: "10px" }}>{m.email}</span>
                    <div style={{ marginTop: "4px", display: "flex", gap: "6px" }}>
                      {m.roles.map((r) => (
                        <span key={r} style={{ fontSize: "0.75rem", padding: "2px 8px", borderRadius: "4px", background: "#e8f0fe", color: "#1a73e8", fontWeight: 600 }}>
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span
                      style={{
                        fontSize: "0.8rem",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        background: m.status === "active" ? "#e6f4ea" : "#f1f3f4",
                        color: m.status === "active" ? "#137333" : "#5f6368",
                        fontWeight: 600,
                      }}
                    >
                      {m.status.toUpperCase()}
                    </span>
                    {m.status === "active" && (
                      <button
                        disabled={formBusy}
                        onClick={() => void handleDeactivateMember(m.userId)}
                        style={{
                          padding: "4px 10px",
                          borderRadius: "4px",
                          border: "1px solid #c8d8cf",
                          background: "white",
                          cursor: formBusy ? "wait" : "pointer",
                          fontSize: "0.8rem",
                          color: "#b91c1c",
                        }}
                      >
                        Deactivate
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Teams */}
      {activeSection === "teams" && (
        <section style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ background: colors.surface, padding: "20px", borderRadius: "10px", border: "1px solid #e0eae4" }}>
            <h3 style={{ margin: "0 0 14px", color: colors.text }}>Create Team</h3>
            <form
              onSubmit={(e) => void handleCreateTeam(e)}
              style={{ display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap" }}
            >
              <div style={{ flex: 1, minWidth: "180px" }}>
                <label style={{ display: "block", fontSize: "0.85rem", color: colors.muted, marginBottom: "4px" }}>
                  Team ID (optional)
                </label>
                <input
                  type="text"
                  value={newTeamId}
                  onChange={(e) => setNewTeamId(e.target.value)}
                  placeholder="e.g. platform-team"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cedcd3", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ flex: 1, minWidth: "180px" }}>
                <label style={{ display: "block", fontSize: "0.85rem", color: colors.muted, marginBottom: "4px" }}>
                  Team name
                </label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g. Platform Team"
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cedcd3", boxSizing: "border-box" }}
                />
              </div>
              <button
                type="submit"
                disabled={formBusy}
                style={{
                  padding: "9px 20px",
                  borderRadius: "6px",
                  border: "none",
                  background: colors.accent,
                  color: "#ffffff",
                  fontWeight: 600,
                  cursor: formBusy ? "wait" : "pointer",
                }}
              >
                {formBusy ? "Creating…" : "Create Team"}
              </button>
            </form>
          </div>

          <div style={{ background: colors.surface, padding: "20px", borderRadius: "10px", border: "1px solid #e0eae4" }}>
            <h3 style={{ margin: "0 0 12px", color: colors.text }}>Teams ({teams.length})</h3>
            {teamsLoading && <p style={{ color: colors.muted }}>Loading teams…</p>}
            {teamsError && (
              <div role="alert" style={{ padding: "12px", color: "#b3261e", background: "#fce8e6", borderRadius: "8px" }}>{teamsError}</div>
            )}
            {!teamsLoading && !teamsError && teams.length === 0 && (
              <p style={{ color: colors.muted }}>No teams yet. Create one above.</p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {teams.map((team) => (
                <div
                  key={team.teamId}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 14px",
                    background: "#fafcfb",
                    border: "1px solid #e5ede8",
                    borderRadius: "8px",
                  }}
                >
                  <div>
                    <strong style={{ color: colors.text }}>{team.teamName}</strong>
                    <span style={{ color: colors.muted, fontSize: "0.85rem", marginLeft: "10px" }}>ID: {team.teamId}</span>
                  </div>
                  <span
                    style={{
                      fontSize: "0.8rem",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      background: team.status === "active" ? "#e6f4ea" : "#f1f3f4",
                      color: team.status === "active" ? "#137333" : "#5f6368",
                      fontWeight: 600,
                    }}
                  >
                    {team.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Privacy Policy */}
      {activeSection === "policy" && (
        <section style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ background: colors.surface, padding: "20px", borderRadius: "10px", border: "1px solid #e0eae4" }}>
            {policyLoading && <p style={{ color: colors.muted }}>Loading policy…</p>}
            {policyError && (
              <div role="alert" style={{ padding: "12px", color: "#b3261e", background: "#fce8e6", borderRadius: "8px" }}>{policyError}</div>
            )}
            {policy && (
              <>
                <h3 style={{ margin: "0 0 6px", color: colors.text }}>Current Privacy Policy</h3>
                <p style={{ margin: "0 0 16px", color: colors.muted, fontSize: "0.88rem" }}>
                  The minimum contributor floor may only be raised, never lowered below the enforced
                  baseline of 5.
                </p>
                <div style={{ display: "flex", gap: "24px", marginBottom: "20px" }}>
                  <div>
                    <div style={{ fontSize: "0.85rem", color: colors.muted }}>Current floor</div>
                    <div style={{ fontSize: "1.8rem", fontWeight: 700, color: colors.accent }}>
                      {policy.minimumContributors}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.85rem", color: colors.muted }}>Policy version</div>
                    <div style={{ fontSize: "1.8rem", fontWeight: 700, color: colors.text }}>
                      v{policy.policyVersion}
                    </div>
                  </div>
                </div>
                <form
                  onSubmit={(e) => void handleUpdatePolicy(e)}
                  style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}
                >
                  <div>
                    <label style={{ display: "block", fontSize: "0.85rem", color: colors.muted, marginBottom: "4px" }}>
                      New minimum contributors (≥ 5)
                    </label>
                    <input
                      type="number"
                      min={5}
                      value={newFloorInput}
                      onChange={(e) => setNewFloorInput(e.target.value)}
                      style={{ width: "100px", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cedcd3" }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={formBusy}
                    style={{
                      padding: "9px 20px",
                      borderRadius: "6px",
                      border: "none",
                      background: colors.accent,
                      color: "#ffffff",
                      fontWeight: 600,
                      cursor: formBusy ? "wait" : "pointer",
                    }}
                  >
                    {formBusy ? "Updating…" : "Update Policy"}
                  </button>
                </form>
              </>
            )}
          </div>
        </section>
      )}

      {/* Audit Log */}
      {activeSection === "audit" && (
        <section>
          <div style={{ background: colors.surface, padding: "20px", borderRadius: "10px", border: "1px solid #e0eae4" }}>
            <h3 style={{ margin: "0 0 12px", color: colors.text }}>Administrative Audit Log</h3>
            <p style={{ margin: "0 0 16px", color: colors.muted, fontSize: "0.88rem" }}>
              Role, membership, invitation and policy changes. No personal workload data, private
              notes, or employee check-in details appear here.
            </p>
            {auditLoading && <p style={{ color: colors.muted }}>Loading audit log…</p>}
            {auditError && (
              <div role="alert" style={{ padding: "12px", color: "#b3261e", background: "#fce8e6", borderRadius: "8px" }}>{auditError}</div>
            )}
            {!auditLoading && !auditError && auditLogs.length === 0 && (
              <p style={{ color: colors.muted }}>No audit events recorded yet.</p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  style={{
                    padding: "12px 14px",
                    background: "#fafcfb",
                    border: "1px solid #e5ede8",
                    borderRadius: "8px",
                    fontSize: "0.9rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <strong style={{ color: colors.text }}>{log.action}</strong>
                    <span style={{ color: colors.muted, fontSize: "0.8rem" }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ color: colors.muted }}>
                    By <strong>{log.actorEmail}</strong> → target: {log.targetId}
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
