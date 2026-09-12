import React, { useState } from "react";
import { colors } from "@workload/design-tokens";
import type { HumanActionRecord } from "@workload/contracts";

interface MockOrgAggregate {
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

export const HrPage: React.FC = () => {
  const [activeScenario, setActiveScenario] = useState<"available" | "insufficient" | "overlap">("available");
  const [hrActions, setHrActions] = useState<HumanActionRecord[]>([
    {
      id: "act-hr-1",
      orgId: "demo-org",
      scope: "hr",
      authorId: "user-hr-01",
      authorName: "People Operations Lead",
      rationale: "Organization-wide average effort remains elevated above 37 hours across cohorts. Initiating company-wide 'Focus Friday' pilot to reduce meeting load.",
      status: "in_progress",
      followUpAt: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
    },
  ]);
  const [newHrActionRationale, setNewHrActionRationale] = useState("");
  const [newHrActionFollowUp, setNewHrActionFollowUp] = useState("");

  const scenarios: Record<string, MockOrgAggregate> = {
    available: {
      state: "available",
      range: { startDate: "2026-03-01", endDate: "2026-03-07" },
      generatedAt: "2026-03-08T00:00:00.000Z",
      evidenceStrength: "consistent",
      metrics: [
        { key: "meanWeeklyEffort", value: 37.8, contributorCountBand: "10-19" },
        { key: "meanManageability", value: 3.9, contributorCountBand: "10-19" },
      ],
    },
    insufficient: {
      state: "insufficient_contributors",
      range: { startDate: "2026-03-01", endDate: "2026-03-07" },
      generatedAt: "2026-03-08T00:00:00.000Z",
      evidenceStrength: "limited",
      reason: "At least 5 distinct consenting contributors are required to disclose aggregate metrics",
    },
    overlap: {
      state: "unsafe_overlap",
      range: { startDate: "2026-03-08", endDate: "2026-03-14" },
      generatedAt: "2026-03-15T00:00:00.000Z",
      evidenceStrength: "developing",
      reason: "The contributor change is too small to safely publish a successive release",
    },
  };

  const aggregate = scenarios[activeScenario]!;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
          <h1 style={{ margin: 0, fontSize: "1.8rem", color: colors.text }}>
            HR Overview: Protected Organization Releases
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
            HR SCOPE
          </span>
        </div>
        <p style={{ margin: 0, color: colors.muted, fontSize: "0.95rem" }}>
          Organization-level approved aggregates, trends, and evidence coverage. Strictly no individual lookup, employee ranking, or team drill-down.
        </p>
      </div>

      <div
        style={{
          background: "#e6f4ea",
          border: "1px solid #137333",
          borderRadius: "8px",
          padding: "14px 18px",
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
          fontSize: "0.85rem",
          color: "#137333",
        }}
      >
        <span style={{ fontSize: "1.2rem" }}>🛡️</span>
        <div>
          <strong>Strict Privacy Baseline:</strong> Releases require at least 5 distinct consenting contributors per reporting window (<code>consent.organizationAggregation = true</code>). Successive release overlap suppression prevents differential identification when team composition changes.
        </div>
      </div>

      {/* Scenario selector */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "0.85rem", color: colors.muted, fontWeight: 600 }}>Demo Scenario:</span>
        <button
          onClick={() => setActiveScenario("available")}
          style={{
            padding: "6px 12px",
            borderRadius: "6px",
            border: "1px solid #dbe6df",
            background: activeScenario === "available" ? colors.accent : colors.surface,
            color: activeScenario === "available" ? "#ffffff" : colors.text,
            cursor: "pointer",
            fontSize: "0.85rem",
          }}
        >
          Eligible Cohort (Disclosed)
        </button>
        <button
          onClick={() => setActiveScenario("insufficient")}
          style={{
            padding: "6px 12px",
            borderRadius: "6px",
            border: "1px solid #dbe6df",
            background: activeScenario === "insufficient" ? colors.accent : colors.surface,
            color: activeScenario === "insufficient" ? "#ffffff" : colors.text,
            cursor: "pointer",
            fontSize: "0.85rem",
          }}
        >
          Under Threshold (&lt;5 Consenting)
        </button>
        <button
          onClick={() => setActiveScenario("overlap")}
          style={{
            padding: "6px 12px",
            borderRadius: "6px",
            border: "1px solid #dbe6df",
            background: activeScenario === "overlap" ? colors.accent : colors.surface,
            color: activeScenario === "overlap" ? "#ffffff" : colors.text,
            cursor: "pointer",
            fontSize: "0.85rem",
          }}
        >
          Unsafe Overlap Shift
        </button>
      </div>

      {/* Aggregate Report Card */}
      <div
        style={{
          background: colors.surface,
          border: "1px solid #dbe6df",
          borderRadius: "12px",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.2rem", color: colors.text }}>
              Weekly Organization Release ({aggregate.range.startDate} to {aggregate.range.endDate})
            </h2>
            <span style={{ fontSize: "0.85rem", color: colors.muted }}>
              Generated: {new Date(aggregate.generatedAt).toLocaleString()} | Evidence: {aggregate.evidenceStrength.toUpperCase()}
            </span>
          </div>

          <span
            style={{
              padding: "4px 12px",
              borderRadius: "8px",
              fontSize: "0.8rem",
              fontWeight: 600,
              background:
                aggregate.state === "available"
                  ? "#e6f4ea"
                  : aggregate.state === "unsafe_overlap"
                  ? "#fce8e6"
                  : "#fef7e0",
              color:
                aggregate.state === "available"
                  ? "#137333"
                  : aggregate.state === "unsafe_overlap"
                  ? "#c5221f"
                  : "#b06000",
            }}
          >
            STATE: {aggregate.state.toUpperCase()}
          </span>
        </div>

        {aggregate.state === "available" && aggregate.metrics && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            {aggregate.metrics.map((metric) => (
              <div
                key={metric.key}
                style={{
                  background: "#f9fbfa",
                  border: "1px solid #eef3f0",
                  borderRadius: "8px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                <span style={{ fontSize: "0.85rem", color: colors.muted }}>
                  {metric.key === "meanWeeklyEffort" ? "Mean Weekly Effort" : "Mean Manageability"}
                </span>
                <span style={{ fontSize: "1.8rem", fontWeight: 700, color: colors.accent }}>
                  {metric.value} {metric.key === "meanWeeklyEffort" ? "hrs" : "/ 5"}
                </span>
                <span style={{ fontSize: "0.75rem", color: colors.muted }}>
                  Cohort Contributor Band: <strong>{metric.contributorCountBand} members</strong>
                </span>
              </div>
            ))}
          </div>
        )}

        {aggregate.state !== "available" && (
          <div
            style={{
              background: aggregate.state === "unsafe_overlap" ? "#fce8e6" : "#fef7e0",
              border: `1px solid ${aggregate.state === "unsafe_overlap" ? "#fad2cf" : "#feefc3"}`,
              borderRadius: "8px",
              padding: "16px",
              color: aggregate.state === "unsafe_overlap" ? "#c5221f" : "#7a4100",
              fontSize: "0.9rem",
            }}
          >
            <strong>🔒 Release Suppressed:</strong> {aggregate.reason}
          </div>
        )}
      </div>

      {/* Organization Human Actions */}
      <div style={{ background: colors.surface, padding: "20px", borderRadius: "10px", border: "1px solid #e0eae4" }}>
        <h3 style={{ margin: "0 0 8px 0", color: colors.text, fontSize: "1.1rem" }}>
          Organization-Level Human Decisions & Follow-up
        </h3>
        <p style={{ margin: "0 0 16px 0", color: colors.muted, fontSize: "0.88rem" }}>
          Record organization-wide initiatives (e.g. company wellness cycles, hiring allocation, workload rebalancing). Human follow-ups operate at the organization level without individual employee case files.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newHrActionRationale) return;
            const newAct: HumanActionRecord = {
              id: `act-hr-${Date.now()}`,
              orgId: "demo-org",
              scope: "hr",
              authorId: "user-hr-01",
              authorName: "People Operations Lead",
              rationale: newHrActionRationale,
              status: "open",
              followUpAt: newHrActionFollowUp || undefined,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            setHrActions((prev) => [newAct, ...prev]);
            setNewHrActionRationale("");
            setNewHrActionFollowUp("");
          }}
          style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}
        >
          <div>
            <label style={{ display: "block", fontSize: "0.85rem", color: colors.muted, marginBottom: "4px" }}>
              Action Rationale & Program Plan
            </label>
            <textarea
              rows={3}
              value={newHrActionRationale}
              onChange={(e) => setNewHrActionRationale(e.target.value)}
              placeholder="Document organization-level follow-up (e.g. scheduling no-meeting focus blocks, reviewing project headcount allocation)..."
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
                value={newHrActionFollowUp}
                onChange={(e) => setNewHrActionFollowUp(e.target.value)}
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
              Record Organization Action
            </button>
          </div>
        </form>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {hrActions.map((act) => (
            <div
              key={act.id}
              style={{
                padding: "14px 16px",
                background: "#fafcfb",
                border: "1px solid #e5ede8",
                borderRadius: "8px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ color: colors.text, fontSize: "0.95rem" }}>{act.authorName}</strong>
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: "4px",
                    background: act.status === "resolved" ? "#e6f4ea" : "#e8f0fe",
                    color: act.status === "resolved" ? "#137333" : "#1a73e8",
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
              <div style={{ display: "flex", justifyContent: "space-between", color: colors.muted, fontSize: "0.8rem" }}>
                <span>Recorded: {new Date(act.createdAt).toLocaleDateString()}</span>
                {act.followUpAt && <span>Review by: {act.followUpAt}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
