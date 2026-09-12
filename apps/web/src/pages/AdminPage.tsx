import React, { useState } from "react";
import { colors } from "@workload/design-tokens";
import type {
  AdminAuditRecord,
  InvitationRecord,
  Membership,
  OrganizationPolicy,
  OrganizationRole,
  TeamRecord,
} from "@workload/contracts";

export const AdminPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState<"members" | "teams" | "policy" | "audit">("members");

  // Sample/Demo state for presentation
  const [members] = useState<Membership[]>([
    {
      orgId: "demo-org",
      userId: "user-admin-01",
      displayName: "Security Admin",
      email: "admin@example.invalid",
      roles: ["org_admin", "member"],
      status: "active",
      membershipVersion: 1,
    },
    {
      orgId: "demo-org",
      userId: "user-mgr-01",
      displayName: "Engineering Lead",
      email: "manager@example.invalid",
      roles: ["manager", "member"],
      status: "active",
      membershipVersion: 1,
    },
    {
      orgId: "demo-org",
      userId: "user-hr-01",
      displayName: "People Operations",
      email: "hr@example.invalid",
      roles: ["hr", "member"],
      status: "active",
      membershipVersion: 1,
    },
    {
      orgId: "demo-org",
      userId: "user-dev-01",
      displayName: "Software Engineer",
      email: "engineer@example.invalid",
      roles: ["member"],
      status: "active",
      membershipVersion: 1,
    },
  ]);

  const [invitations, setInvitations] = useState<InvitationRecord[]>([
    {
      id: "inv-demo-101",
      orgId: "demo-org",
      email: "prospective@example.invalid",
      roles: ["member"],
      status: "pending",
      expiresAt: new Date(Date.now() + 6 * 86400000).toISOString(),
      createdAt: new Date().toISOString(),
    },
  ]);

  const [teams, setTeams] = useState<TeamRecord[]>([
    {
      orgId: "demo-org",
      teamId: "team-platform",
      teamName: "Core Platform Team",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      orgId: "demo-org",
      teamId: "team-product",
      teamName: "Product Experience Team",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);

  const [policy, setPolicy] = useState<OrganizationPolicy>({
    orgId: "demo-org",
    minimumContributors: 5,
    policyVersion: 1,
    disclosureGeneration: 1,
  });

  const [auditLogs, setAuditLogs] = useState<AdminAuditRecord[]>([
    {
      id: "evt-001",
      orgId: "demo-org",
      actorId: "user-admin-01",
      actorEmail: "admin@example.invalid",
      action: "policy.patch",
      targetId: "demo-org",
      details: { minimumContributors: 5, note: "Initial privacy floor enforced at 5" },
      timestamp: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: "evt-002",
      orgId: "demo-org",
      actorId: "user-admin-01",
      actorEmail: "admin@example.invalid",
      action: "member.invite",
      targetId: "inv-demo-101",
      details: { email: "prospective@example.invalid", roles: ["member"] },
      timestamp: new Date(Date.now() - 1800000).toISOString(),
    },
  ]);

  // Form states
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrganizationRole>("member");
  const [newTeamId, setNewTeamId] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [newFloorInput, setNewFloorInput] = useState("5");
  const [feedback, setFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    const newInvite: InvitationRecord = {
      id: `inv-${Date.now()}`,
      orgId: "demo-org",
      email: inviteEmail,
      roles: [inviteRole],
      status: "pending",
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      createdAt: new Date().toISOString(),
    };
    setInvitations((prev) => [newInvite, ...prev]);
    setAuditLogs((prev) => [
      {
        id: `evt-${Date.now()}`,
        orgId: "demo-org",
        actorId: "user-admin-01",
        actorEmail: "admin@example.invalid",
        action: "member.invite",
        targetId: newInvite.id,
        details: { email: inviteEmail, roles: [inviteRole] },
        timestamp: new Date().toISOString(),
      },
      ...prev,
    ]);
    setInviteEmail("");
    setFeedback({ message: `Invitation dispatched to ${inviteEmail}.`, type: "success" });
  };

  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamId || !newTeamName) return;
    const newTeam: TeamRecord = {
      orgId: "demo-org",
      teamId: newTeamId.toLowerCase().replace(/\s+/g, "-"),
      teamName: newTeamName,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTeams((prev) => [...prev, newTeam]);
    setAuditLogs((prev) => [
      {
        id: `evt-${Date.now()}`,
        orgId: "demo-org",
        actorId: "user-admin-01",
        actorEmail: "admin@example.invalid",
        action: "team.create",
        targetId: newTeam.teamId,
        details: { teamName: newTeam.teamName },
        timestamp: new Date().toISOString(),
      },
      ...prev,
    ]);
    setNewTeamId("");
    setNewTeamName("");
    setFeedback({ message: `Team "${newTeam.teamName}" created.`, type: "success" });
  };

  const handleUpdatePolicy = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(newFloorInput, 10);
    if (isNaN(val) || val < 5) {
      setFeedback({ message: "Security Violation: Privacy floor cannot be lowered below 5 distinct contributors.", type: "error" });
      return;
    }
    setPolicy((prev) => ({
      ...prev,
      minimumContributors: val,
      policyVersion: prev.policyVersion + 1,
      disclosureGeneration: prev.disclosureGeneration + 1,
    }));
    setAuditLogs((prev) => [
      {
        id: `evt-${Date.now()}`,
        orgId: "demo-org",
        actorId: "user-admin-01",
        actorEmail: "admin@example.invalid",
        action: "policy.patch",
        targetId: "demo-org",
        details: { previousFloor: policy.minimumContributors, newFloor: val },
        timestamp: new Date().toISOString(),
      },
      ...prev,
    ]);
    setFeedback({ message: `Privacy threshold updated to ${val}. Existing aggregate releases have been invalidated for recomputation.`, type: "success" });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div>
        <h1 style={{ color: colors.text, margin: "0 0 6px 0", fontSize: "1.8rem" }}>
          Organization Administration
        </h1>
        <p style={{ color: colors.muted, margin: 0, fontSize: "0.95rem" }}>
          Manage membership directory, team reporting lines, and disclosure policies without accessing employee private records.
        </p>
      </div>

      {/* IAM Privacy Isolation Banner */}
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
        <span style={{ fontSize: "1.6rem" }}>🛡️</span>
        <div>
          <strong style={{ color: colors.accent, display: "block", marginBottom: "4px" }}>
            Zero-Trust Architectural Isolation
          </strong>
          <span style={{ fontSize: "0.88rem", color: colors.text, lineHeight: 1.5 }}>
            Organization administrators manage directory metadata and disclosure controls. IAM policies strictly deny administrative execution roles access to the <code>PRIVATE#*</code> partition. Administrators cannot inspect private tasks, personal leave items, individual check-in ratings, or employee ranking metrics.
          </span>
        </div>
      </div>

      {feedback && (
        <div
          style={{
            padding: "12px 18px",
            borderRadius: "8px",
            background: feedback.type === "success" ? "#eefaf1" : "#fdf2f2",
            border: `1px solid ${feedback.type === "success" ? "#bcebc8" : "#f5c6cb"}`,
            color: feedback.type === "success" ? "#1b6a2e" : "#b02a37",
            fontSize: "0.9rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{feedback.message}</span>
          <button
            onClick={() => setFeedback(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontWeight: "bold" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Section Tabs */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid #dbe6df", paddingBottom: "8px" }}>
        {([
          { id: "members", label: "People & Invitations", icon: "👥" },
          { id: "teams", label: "Teams & Reporting Lines", icon: "🏢" },
          { id: "policy", label: "Policy & Privacy Floor", icon: "⚖️" },
          { id: "audit", label: "Administrative Audit Log", icon: "📜" },
        ] as const).map((sec) => (
          <button
            key={sec.id}
            onClick={() => setActiveSection(sec.id)}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: "none",
              background: activeSection === sec.id ? colors.accent : "transparent",
              color: activeSection === sec.id ? "#ffffff" : colors.text,
              cursor: "pointer",
              fontWeight: activeSection === sec.id ? 600 : 500,
              fontSize: "0.9rem",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span>{sec.icon}</span>
            {sec.label}
          </button>
        ))}
      </div>

      {/* SECTION 1: Members & Invitations */}
      {activeSection === "members" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Invite Member Form */}
          <div style={{ background: colors.surface, padding: "20px", borderRadius: "10px", border: "1px solid #e0eae4" }}>
            <h3 style={{ margin: "0 0 14px 0", color: colors.text, fontSize: "1.1rem" }}>Invite New Organization Member</h3>
            <form onSubmit={handleSendInvite} style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 240px" }}>
                <label style={{ display: "block", fontSize: "0.85rem", color: colors.muted, marginBottom: "4px" }}>
                  Employee Email
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="employee@example.invalid"
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cedcd3" }}
                />
              </div>

              <div style={{ width: "160px" }}>
                <label style={{ display: "block", fontSize: "0.85rem", color: colors.muted, marginBottom: "4px" }}>
                  Proposed Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as OrganizationRole)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cedcd3" }}
                >
                  <option value="member">Member</option>
                  <option value="manager">Manager</option>
                  <option value="hr">HR</option>
                  <option value="org_admin">Org Admin</option>
                </select>
              </div>

              <button
                type="submit"
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
                Send Invitation
              </button>
            </form>
          </div>

          {/* Members Table */}
          <div style={{ background: colors.surface, padding: "20px", borderRadius: "10px", border: "1px solid #e0eae4" }}>
            <h3 style={{ margin: "0 0 14px 0", color: colors.text, fontSize: "1.1rem" }}>Active Members ({members.length})</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #dbe6df", textAlign: "left" }}>
                    <th style={{ padding: "8px 12px", color: colors.muted }}>Display Name</th>
                    <th style={{ padding: "8px 12px", color: colors.muted }}>Email</th>
                    <th style={{ padding: "8px 12px", color: colors.muted }}>Roles</th>
                    <th style={{ padding: "8px 12px", color: colors.muted }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.userId} style={{ borderBottom: "1px solid #edf4f0" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>{m.displayName}</td>
                      <td style={{ padding: "10px 12px", color: colors.muted }}>{m.email}</td>
                      <td style={{ padding: "10px 12px" }}>
                        {m.roles.map((r) => (
                          <span
                            key={r}
                            style={{
                              background: r === "org_admin" ? "#fce8e6" : r === "manager" ? "#e8f0fe" : "#edf4f0",
                              color: r === "org_admin" ? "#c5221f" : r === "manager" ? "#1a73e8" : colors.text,
                              padding: "2px 8px",
                              borderRadius: "4px",
                              fontSize: "0.8rem",
                              marginRight: "4px",
                            }}
                          >
                            {r}
                          </span>
                        ))}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ color: m.status === "active" ? "#1b6a2e" : "#b02a37", fontWeight: 600 }}>
                          ● {m.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pending Invitations */}
          {invitations.length > 0 && (
            <div style={{ background: colors.surface, padding: "20px", borderRadius: "10px", border: "1px solid #e0eae4" }}>
              <h3 style={{ margin: "0 0 14px 0", color: colors.text, fontSize: "1.1rem" }}>Pending Invitations ({invitations.length})</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {invitations.map((inv) => (
                  <div
                    key={inv.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 16px",
                      background: "#fafcfb",
                      border: "1px solid #e2ece6",
                      borderRadius: "6px",
                      fontSize: "0.88rem",
                    }}
                  >
                    <div>
                      <strong>{inv.email}</strong>
                      <span style={{ marginLeft: "10px", color: colors.muted }}>
                        Role: {inv.roles.join(", ")}
                      </span>
                    </div>
                    <span style={{ color: "#d97706", fontWeight: 500 }}>
                      Expires {new Date(inv.expiresAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: Teams & Reporting Lines */}
      {activeSection === "teams" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Create Team */}
          <div style={{ background: colors.surface, padding: "20px", borderRadius: "10px", border: "1px solid #e0eae4" }}>
            <h3 style={{ margin: "0 0 14px 0", color: colors.text, fontSize: "1.1rem" }}>Create New Team</h3>
            <form onSubmit={handleCreateTeam} style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 200px" }}>
                <label style={{ display: "block", fontSize: "0.85rem", color: colors.muted, marginBottom: "4px" }}>
                  Team Identifier
                </label>
                <input
                  type="text"
                  value={newTeamId}
                  onChange={(e) => setNewTeamId(e.target.value)}
                  placeholder="e.g. team-analytics"
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cedcd3" }}
                />
              </div>
              <div style={{ flex: "2 1 260px" }}>
                <label style={{ display: "block", fontSize: "0.85rem", color: colors.muted, marginBottom: "4px" }}>
                  Team Name
                </label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g. Analytics & Insights"
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cedcd3" }}
                />
              </div>
              <button
                type="submit"
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
                Create Team
              </button>
            </form>
          </div>

          {/* Teams List */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
            {teams.map((t) => (
              <div
                key={t.teamId}
                style={{
                  background: colors.surface,
                  padding: "18px",
                  borderRadius: "10px",
                  border: "1px solid #e0eae4",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: "1.05rem", color: colors.text }}>{t.teamName}</strong>
                  <span style={{ color: "#1b6a2e", fontSize: "0.8rem", fontWeight: 600 }}>● {t.status}</span>
                </div>
                <code style={{ fontSize: "0.8rem", color: colors.muted }}>{t.teamId}</code>
                <span style={{ fontSize: "0.85rem", color: colors.muted, marginTop: "4px" }}>
                  Assignment changes automatically trigger release invalidation for aggregate safety.
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 3: Policy Settings */}
      {activeSection === "policy" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div style={{ background: colors.surface, padding: "24px", borderRadius: "10px", border: "1px solid #e0eae4" }}>
            <h3 style={{ margin: "0 0 10px 0", color: colors.text, fontSize: "1.15rem" }}>
              Differential Privacy & Aggregate Floor
            </h3>
            <p style={{ color: colors.muted, fontSize: "0.9rem", lineHeight: 1.5, margin: "0 0 20px 0" }}>
              To prevent personal workload re-identification, aggregates are only calculated and released when at least the minimum threshold of consenting contributors participate. Administrators may raise this threshold, but can <strong>never lower it below the privacy floor of 5</strong>.
            </p>

            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginBottom: "24px" }}>
              <div style={{ background: "#edf4f0", padding: "14px 18px", borderRadius: "8px", flex: "1 1 200px" }}>
                <span style={{ fontSize: "0.8rem", color: colors.muted, display: "block" }}>CURRENT MINIMUM</span>
                <strong style={{ fontSize: "1.6rem", color: colors.accent }}>{policy.minimumContributors} contributors</strong>
              </div>
              <div style={{ background: "#edf4f0", padding: "14px 18px", borderRadius: "8px", flex: "1 1 160px" }}>
                <span style={{ fontSize: "0.8rem", color: colors.muted, display: "block" }}>POLICY VERSION</span>
                <strong style={{ fontSize: "1.6rem", color: colors.text }}>v{policy.policyVersion}</strong>
              </div>
              <div style={{ background: "#edf4f0", padding: "14px 18px", borderRadius: "8px", flex: "1 1 160px" }}>
                <span style={{ fontSize: "0.8rem", color: colors.muted, display: "block" }}>DISCLOSURE GENERATION</span>
                <strong style={{ fontSize: "1.6rem", color: colors.text }}>#{policy.disclosureGeneration}</strong>
              </div>
            </div>

            <form onSubmit={handleUpdatePolicy} style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
              <div style={{ width: "160px" }}>
                <label style={{ display: "block", fontSize: "0.85rem", color: colors.muted, marginBottom: "4px" }}>
                  New Threshold (≥ 5)
                </label>
                <input
                  type="number"
                  min={5}
                  max={100}
                  value={newFloorInput}
                  onChange={(e) => setNewFloorInput(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cedcd3" }}
                />
              </div>
              <button
                type="submit"
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
                Update Policy & Invalidate Releases
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SECTION 4: Audit Logs */}
      {activeSection === "audit" && (
        <div style={{ background: colors.surface, padding: "20px", borderRadius: "10px", border: "1px solid #e0eae4" }}>
          <div style={{ marginBottom: "16px" }}>
            <h3 style={{ margin: "0 0 6px 0", color: colors.text, fontSize: "1.1rem" }}>Administrative Audit Events</h3>
            <p style={{ margin: 0, color: colors.muted, fontSize: "0.88rem" }}>
              Content-free audit logging: tracks role, team, membership, and policy alterations without storing personal notes or workload values.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {auditLogs.map((log) => (
              <div
                key={log.id}
                style={{
                  padding: "14px 16px",
                  background: "#fafcfb",
                  border: "1px solid #e5ede8",
                  borderRadius: "8px",
                  fontSize: "0.88rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span
                      style={{
                        background: "#e8f0fe",
                        color: "#1a73e8",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontWeight: 600,
                        fontSize: "0.8rem",
                        marginRight: "8px",
                      }}
                    >
                      {log.action}
                    </span>
                    <strong>{log.actorEmail ?? log.actorId}</strong>
                  </div>
                  <span style={{ color: colors.muted, fontSize: "0.82rem" }}>
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
                <div style={{ color: colors.text, fontSize: "0.85rem" }}>
                  Target: <code>{log.targetId}</code> · Details: {JSON.stringify(log.details)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
