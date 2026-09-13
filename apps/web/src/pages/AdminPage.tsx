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

// --- Inline Visual SVG Components & Micro-Illustrations ---

const ShieldCheckIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 18,
  color = "currentColor",
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

const UsersIcon: React.FC<{ size?: number; color?: string }> = ({ size = 18, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const TeamIcon: React.FC<{ size?: number; color?: string }> = ({ size = 18, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);

const LockIcon: React.FC<{ size?: number; color?: string }> = ({ size = 18, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const ActivityIcon: React.FC<{ size?: number; color?: string }> = ({ size = 18, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const PlusCircleIcon: React.FC<{ size?: number; color?: string }> = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

const MailIcon: React.FC<{ size?: number; color?: string }> = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const EmptyStateGraphic = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <div style={{ textAlign: "center", padding: "40px 20px" }}>
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 12px" }}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
    <div style={{ fontSize: "0.95rem", fontWeight: 600, color: colors.text }}>{title}</div>
    <div style={{ fontSize: "0.85rem", color: colors.muted, marginTop: "4px" }}>{subtitle}</div>
  </div>
);

// --- Main Page Component ---

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

  const sectionBtn = (id: typeof activeSection, label: string, IconComponent: React.FC<{ size?: number; color?: string }>) => {
    const isActive = activeSection === id;
    return (
      <button
        onClick={() => { setActiveSection(id); setFeedback(null); }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 18px",
          borderRadius: "8px",
          border: "none",
          background: isActive ? colors.accent : "transparent",
          color: isActive ? "#ffffff" : colors.text,
          fontWeight: isActive ? 600 : 500,
          fontSize: "0.9rem",
          cursor: "pointer",
          transition: "all 0.2s ease-in-out",
          boxShadow: isActive ? "0 2px 8px rgba(0, 0, 0, 0.12)" : "none",
        }}
      >
        <IconComponent size={16} color={isActive ? "#ffffff" : colors.text} />
        {label}
      </button>
    );
  };

  const activeMembersCount = members.filter((m) => m.status === "active").length;
  const activeTeamsCount = teams.filter((t) => t.status === "active").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "1200px", margin: "0 auto", width: "100%" }}>
      {/* Premium Header Container */}
      <div style={{
        background: colors.surface,
        padding: "24px 28px",
        borderRadius: "14px",
        border: "1px solid #e2e8f0",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        display: "flex",
        flexDirection: "column",
        gap: "20px"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700, color: colors.text }}>
                Organization Administration
              </h1>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "3px 10px",
                  background: "#fef2f2",
                  color: "#dc2626",
                  borderRadius: "20px",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  border: "1px solid #fecaca",
                  letterSpacing: "0.04em",
                }}
              >
                <ShieldCheckIcon size={12} color="#dc2626" />
                ORG ADMIN
              </span>
            </div>
            <p style={{ margin: 0, color: colors.muted, fontSize: "0.92rem", maxWidth: "720px", lineHeight: "1.5" }}>
              Manage organization membership, team structure, privacy policy, and administrative audit.
              No personal workload data or consent records are accessible here.
            </p>
          </div>

          {/* Quick Metrics Visualizer Widget */}
          <div style={{ display: "flex", gap: "12px" }}>
            <div style={{ padding: "10px 16px", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e2e8f0", textAlign: "center", minWidth: "90px" }}>
              <div style={{ fontSize: "0.75rem", color: colors.muted, textTransform: "uppercase", fontWeight: 600 }}>Active Members</div>
              <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#16a34a", marginTop: "2px" }}>
                {membersLoading ? "..." : activeMembersCount}
              </div>
            </div>
            <div style={{ padding: "10px 16px", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e2e8f0", textAlign: "center", minWidth: "90px" }}>
              <div style={{ fontSize: "0.75rem", color: colors.muted, textTransform: "uppercase", fontWeight: 600 }}>Teams</div>
              <div style={{ fontSize: "1.3rem", fontWeight: 700, color: colors.accent, marginTop: "2px" }}>
                {teamsLoading ? "..." : teams.length}
              </div>
            </div>
          </div>
        </div>

        {/* Section Navigation Tabs */}
        <div style={{ display: "flex", gap: "6px", borderTop: "1px solid #f1f5f9", paddingTop: "16px", flexWrap: "wrap" }}>
          {sectionBtn("members", "Members & Invitations", UsersIcon)}
          {sectionBtn("teams", "Teams", TeamIcon)}
          {sectionBtn("policy", "Privacy Policy", LockIcon)}
          {sectionBtn("audit", "Audit Log", ActivityIcon)}
        </div>
      </div>

      {/* Global Action Feedback Banner */}
      {feedback && (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "14px 18px",
            borderRadius: "10px",
            background: feedback.type === "success" ? "#f0fdf4" : "#fef2f2",
            border: `1px solid ${feedback.type === "success" ? "#bbf7d0" : "#fecaca"}`,
            color: feedback.type === "success" ? "#15803d" : "#b91c1c",
            fontWeight: 500,
            fontSize: "0.92rem",
            boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          }}
        >
          <span style={{
            display: "inline-block",
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: feedback.type === "success" ? "#16a34a" : "#dc2626"
          }} />
          {feedback.message}
        </div>
      )}

      {/* SECTION 1: MEMBERS & INVITATIONS */}
      {activeSection === "members" && (
        <section style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Invite Form Card */}
          <div
            style={{
              background: colors.surface,
              padding: "24px",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
              <MailIcon size={18} color={colors.accent} />
              <h3 style={{ margin: 0, color: colors.text, fontSize: "1.1rem", fontWeight: 600 }}>Send Invitation</h3>
            </div>
            <form
              onSubmit={(e) => void handleSendInvite(e)}
              style={{ display: "flex", gap: "14px", alignItems: "flex-end", flexWrap: "wrap" }}
            >
              <div style={{ flex: 2, minWidth: "240px" }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: colors.muted, marginBottom: "6px" }}>
                  EMAIL ADDRESS
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.92rem",
                    boxSizing: "border-box",
                    outline: "none",
                    transition: "border 0.2s ease",
                  }}
                />
              </div>
              <div style={{ flex: 1, minWidth: "160px" }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: colors.muted, marginBottom: "6px" }}>
                  ASSIGN ROLE
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as OrganizationRole)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.92rem",
                    background: "#ffffff",
                    cursor: "pointer",
                  }}
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
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "10px 22px",
                  borderRadius: "8px",
                  border: "none",
                  background: colors.accent,
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: "0.92rem",
                  cursor: formBusy ? "wait" : "pointer",
                  opacity: formBusy ? 0.7 : 1,
                  transition: "background 0.2s ease",
                }}
              >
                <PlusCircleIcon size={16} color="#ffffff" />
                {formBusy ? "Sending…" : "Send Invitation"}
              </button>
            </form>
          </div>

          {/* Pending Invitations Card */}
          {invitations.length > 0 && (
            <div style={{ background: colors.surface, padding: "24px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ margin: 0, color: colors.text, fontSize: "1.05rem", fontWeight: 600 }}>
                  Pending Invitations
                </h3>
                <span style={{ fontSize: "0.8rem", padding: "2px 8px", background: "#fef3c7", color: "#d97706", borderRadius: "12px", fontWeight: 700 }}>
                  {invitations.length} PENDING
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {invitations.map((inv) => (
                  <div key={inv.id} style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 16px",
                    background: "#fffbeb",
                    border: "1px solid #fef3c7",
                    borderRadius: "8px",
                    fontSize: "0.9rem"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f59e0b" }} />
                      <div>
                        <strong style={{ color: colors.text }}>{inv.email}</strong>
                        <div style={{ fontSize: "0.78rem", color: colors.muted, marginTop: "2px" }}>
                          Roles: {inv.roles.join(", ")}
                        </div>
                      </div>
                    </div>
                    <span style={{ color: colors.muted, fontSize: "0.82rem", background: "#ffffff", padding: "4px 8px", borderRadius: "6px", border: "1px solid #fef3c7" }}>
                      Expires {inv.expiresAt.slice(0, 10)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Members Table Component */}
          <div style={{ background: colors.surface, padding: "24px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, color: colors.text, fontSize: "1.05rem", fontWeight: 600 }}>Organization Members</h3>
              <span style={{ fontSize: "0.85rem", color: colors.muted }}>Total: {members.length}</span>
            </div>

            {membersLoading && (
              <div style={{ textAlign: "center", padding: "30px", color: colors.muted }}>Loading members…</div>
            )}
            {membersError && (
              <div role="alert" style={{ padding: "14px", color: "#b91c1c", background: "#fef2f2", borderRadius: "8px", border: "1px solid #fecaca" }}>
                {membersError}
              </div>
            )}
            {!membersLoading && !membersError && members.length === 0 && (
              <EmptyStateGraphic title="No Members Found" subtitle="Invitations sent will appear here upon acceptance." />
            )}

            {!membersLoading && !membersError && members.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {members.map((m) => {
                  const isActive = m.status === "active";
                  return (
                    <div
                      key={m.userId}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "14px 18px",
                        background: isActive ? "#ffffff" : "#f8fafc",
                        border: `1px solid ${isActive ? "#e2e8f0" : "#cbd5e1"}`,
                        borderRadius: "10px",
                        transition: "box-shadow 0.2s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                        {/* Member Visual Avatar Badge */}
                        <div style={{
                          width: "38px",
                          height: "38px",
                          borderRadius: "50%",
                          background: isActive ? "#f0fdf4" : "#f1f5f9",
                          color: isActive ? "#16a34a" : "#64748b",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: "0.95rem",
                          border: `1px solid ${isActive ? "#bbf7d0" : "#e2e8f0"}`
                        }}>
                          {m.displayName ? m.displayName.charAt(0).toUpperCase() : "U"}
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <strong style={{ color: colors.text, fontSize: "0.95rem" }}>{m.displayName}</strong>
                            <span style={{ color: colors.muted, fontSize: "0.85rem" }}>({m.email})</span>
                          </div>
                          <div style={{ marginTop: "6px", display: "flex", gap: "6px" }}>
                            {m.roles.map((r) => (
                              <span key={r} style={{ fontSize: "0.72rem", padding: "2px 8px", borderRadius: "4px", background: "#eff6ff", color: "#2563eb", fontWeight: 600, border: "1px solid #bfdbfe" }}>
                                {r.toUpperCase()}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        {/* Status Indicator Chip */}
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            fontSize: "0.78rem",
                            padding: "4px 10px",
                            borderRadius: "20px",
                            background: isActive ? "#f0fdf4" : "#f1f5f9",
                            color: isActive ? "#16a34a" : "#64748b",
                            border: `1px solid ${isActive ? "#bbf7d0" : "#cbd5e1"}`,
                            fontWeight: 600,
                          }}
                        >
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: isActive ? "#16a34a" : "#64748b" }} />
                          {m.status.toUpperCase()}
                        </span>

                        {isActive && (
                          <button
                            disabled={formBusy}
                            onClick={() => void handleDeactivateMember(m.userId)}
                            style={{
                              padding: "6px 12px",
                              borderRadius: "6px",
                              border: "1px solid #fecaca",
                              background: "#ffffff",
                              cursor: formBusy ? "wait" : "pointer",
                              fontSize: "0.82rem",
                              fontWeight: 600,
                              color: "#dc2626",
                              transition: "all 0.2s ease",
                            }}
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* SECTION 2: TEAMS */}
      {activeSection === "teams" && (
        <section style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ background: colors.surface, padding: "24px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
              <TeamIcon size={18} color={colors.accent} />
              <h3 style={{ margin: 0, color: colors.text, fontSize: "1.1rem", fontWeight: 600 }}>Create New Team</h3>
            </div>
            <form
              onSubmit={(e) => void handleCreateTeam(e)}
              style={{ display: "flex", gap: "14px", alignItems: "flex-end", flexWrap: "wrap" }}
            >
              <div style={{ flex: 1, minWidth: "200px" }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: colors.muted, marginBottom: "6px" }}>
                  TEAM ID (OPTIONAL)
                </label>
                <input
                  type="text"
                  value={newTeamId}
                  onChange={(e) => setNewTeamId(e.target.value)}
                  placeholder="e.g. platform-team"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.92rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ flex: 1, minWidth: "200px" }}>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: colors.muted, marginBottom: "6px" }}>
                  TEAM NAME
                </label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g. Platform Team"
                  required
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.92rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={formBusy}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "10px 22px",
                  borderRadius: "8px",
                  border: "none",
                  background: colors.accent,
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: "0.92rem",
                  cursor: formBusy ? "wait" : "pointer",
                }}
              >
                <PlusCircleIcon size={16} color="#ffffff" />
                {formBusy ? "Creating…" : "Create Team"}
              </button>
            </form>
          </div>

          <div style={{ background: colors.surface, padding: "24px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, color: colors.text, fontSize: "1.05rem", fontWeight: 600 }}>
                Configured Teams ({teams.length})
              </h3>
            </div>

            {teamsLoading && <div style={{ textAlign: "center", padding: "30px", color: colors.muted }}>Loading teams…</div>}
            {teamsError && (
              <div role="alert" style={{ padding: "14px", color: "#b91c1c", background: "#fef2f2", borderRadius: "8px" }}>{teamsError}</div>
            )}
            {!teamsLoading && !teamsError && teams.length === 0 && (
              <EmptyStateGraphic title="No Teams Configured" subtitle="Create your first organization team using the form above." />
            )}

            {!teamsLoading && !teamsError && teams.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "14px" }}>
                {teams.map((team) => {
                  const isActive = team.status === "active";
                  return (
                    <div
                      key={team.teamId}
                      style={{
                        padding: "18px",
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "10px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        gap: "12px",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <strong style={{ color: colors.text, fontSize: "1rem", display: "block" }}>{team.teamName}</strong>
                          <span style={{ color: colors.muted, fontSize: "0.8rem" }}>ID: {team.teamId}</span>
                        </div>
                        <span
                          style={{
                            fontSize: "0.72rem",
                            padding: "3px 8px",
                            borderRadius: "12px",
                            background: isActive ? "#f0fdf4" : "#f1f5f9",
                            color: isActive ? "#16a34a" : "#64748b",
                            fontWeight: 700,
                            border: `1px solid ${isActive ? "#bbf7d0" : "#cbd5e1"}`
                          }}
                        >
                          {team.status.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.8rem", color: colors.muted, borderTop: "1px solid #f8fafc", paddingTop: "8px", display: "flex", alignItems: "center", gap: "4px" }}>
                        <TeamIcon size={14} color={colors.muted} /> Active Team Identifier
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* SECTION 3: PRIVACY POLICY */}
      {activeSection === "policy" && (
        <section style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ background: colors.surface, padding: "24px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            {policyLoading && <div style={{ textAlign: "center", padding: "30px", color: colors.muted }}>Loading policy configuration…</div>}
            {policyError && (
              <div role="alert" style={{ padding: "14px", color: "#b91c1c", background: "#fef2f2", borderRadius: "8px" }}>{policyError}</div>
            )}

            {policy && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <LockIcon size={20} color={colors.accent} />
                  <h3 style={{ margin: 0, color: colors.text, fontSize: "1.1rem", fontWeight: 600 }}>Current Privacy Policy</h3>
                </div>
                <p style={{ margin: "0 0 20px", color: colors.muted, fontSize: "0.9rem" }}>
                  The minimum contributor floor may only be raised, never lowered below the enforced baseline of 5.
                </p>

                {/* Policy Dynamic Data Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
                  <div style={{ padding: "18px", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 600, color: colors.muted, textTransform: "uppercase" }}>Current Contributor Floor</div>
                    <div style={{ fontSize: "2.2rem", fontWeight: 800, color: colors.accent, marginTop: "4px" }}>
                      {policy.minimumContributors}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "#16a34a", marginTop: "4px", fontWeight: 600 }}>
                      ✓ Baseline Enforced
                    </div>
                  </div>

                  <div style={{ padding: "18px", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 600, color: colors.muted, textTransform: "uppercase" }}>Policy Version</div>
                    <div style={{ fontSize: "2.2rem", fontWeight: 800, color: colors.text, marginTop: "4px" }}>
                      v{policy.policyVersion}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: colors.muted, marginTop: "4px" }}>
                      Active Enforcement
                    </div>
                  </div>
                </div>

                {/* Form to adjust floor */}
                <form
                  onSubmit={(e) => void handleUpdatePolicy(e)}
                  style={{ display: "flex", gap: "14px", alignItems: "flex-end", background: "#ffffff", padding: "18px", borderRadius: "10px", border: "1px solid #e2e8f0" }}
                >
                  <div>
                    <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: colors.muted, marginBottom: "6px" }}>
                      NEW MINIMUM CONTRIBUTORS (≥ 5)
                    </label>
                    <input
                      type="number"
                      min={5}
                      value={newFloorInput}
                      onChange={(e) => setNewFloorInput(e.target.value)}
                      style={{
                        width: "140px",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "0.95rem",
                        fontWeight: 600,
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={formBusy}
                    style={{
                      padding: "10px 22px",
                      borderRadius: "8px",
                      border: "none",
                      background: colors.accent,
                      color: "#ffffff",
                      fontWeight: 600,
                      fontSize: "0.92rem",
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

      {/* SECTION 4: AUDIT LOG */}
      {activeSection === "audit" && (
        <section>
          <div style={{ background: colors.surface, padding: "24px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <ActivityIcon size={20} color={colors.accent} />
              <h3 style={{ margin: 0, color: colors.text, fontSize: "1.1rem", fontWeight: 600 }}>Administrative Audit Log</h3>
            </div>
            <p style={{ margin: "0 0 20px", color: colors.muted, fontSize: "0.88rem" }}>
              Role, membership, invitation and policy changes. No personal workload data, private notes, or employee check-in details appear here.
            </p>

            {auditLoading && <div style={{ textAlign: "center", padding: "30px", color: colors.muted }}>Loading audit log…</div>}
            {auditError && (
              <div role="alert" style={{ padding: "14px", color: "#b91c1c", background: "#fef2f2", borderRadius: "8px" }}>{auditError}</div>
            )}
            {!auditLoading && !auditError && auditLogs.length === 0 && (
              <EmptyStateGraphic title="No Audit Records" subtitle="System and policy changes will be recorded here automatically." />
            )}

            {!auditLoading && !auditError && auditLogs.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      padding: "14px 18px",
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "0.9rem",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.01)"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <span style={{
                        fontWeight: 700,
                        color: colors.text,
                        fontSize: "0.88rem",
                        background: "#f1f5f9",
                        padding: "3px 8px",
                        borderRadius: "4px"
                      }}>
                        {log.action}
                      </span>
                      <span style={{ color: colors.muted, fontSize: "0.8rem" }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ color: colors.muted, fontSize: "0.86rem", marginTop: "4px" }}>
                      By <strong style={{ color: colors.text }}>{log.actorEmail}</strong> &rarr; Target: <code style={{ background: "#f8fafc", padding: "2px 6px", borderRadius: "4px", border: "1px solid #e2e8f0" }}>{log.targetId}</code>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};