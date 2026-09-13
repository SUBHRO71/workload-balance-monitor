import React from "react";
import { colors } from "@workload/design-tokens";
import { useWorkload } from "../context/WorkloadContext";
import type { NavTab } from "../components/Navigation";

export const DashboardPage: React.FC<{ onNavigate?: (tab: NavTab) => void }> = ({ onNavigate }) => {
  const {
    consent,
    preferences,
    tasks,
    checkIns,
    trends,
    insights,
    evidenceStrength,
    dismissInsight,
  } = useWorkload();

  const latestTrend = trends.at(-1);

  return (
    <div>
      <div style={{ marginBottom: "28px" }}>
        <span style={{ color: colors.accent, fontWeight: 700, fontSize: "0.85rem", letterSpacing: "0.08em" }}>
          PERSONAL OVERVIEW
        </span>
        <h1 style={{ color: colors.text, margin: "6px 0 10px", fontSize: "2rem" }}>
          How is your workload feeling?
        </h1>
        <p style={{ color: colors.muted, margin: 0 }}>
          This workspace is private to you. No employer rankings, no automated surveillance, and no data shared without your explicit grant.
        </p>
      </div>

      {!consent.personalProcessing ? (
        <div
          style={{
            padding: "20px",
            background: "#fff9eb",
            border: "1px solid #ffe2a3",
            borderRadius: "12px",
            marginBottom: "24px",
          }}
        >
          <strong style={{ color: "#8a5800" }}>⚠️ Personal processing is disabled</strong>
          <p style={{ margin: "6px 0 0", color: "#6b4500", fontSize: "0.95rem" }}>
            Data entry and trend derivations are currently turned off. Go to <strong>Privacy & Consent</strong> to enable personal processing.
          </p>
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
        {/* Quick Check-in Shortcut */}
        <div
          style={{
            background: colors.surface,
            padding: "20px",
            borderRadius: "14px",
            border: "1px solid #dbe6df",
            boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
          }}
        >
          <h2 style={{ fontSize: "1.2rem", margin: "0 0 12px", color: colors.text }}>
            🌱 Recent Check-ins
          </h2>
          {checkIns.length === 0 ? (
            <p style={{ color: colors.muted, fontSize: "0.88rem", margin: "0 0 14px" }}>
              No check-ins recorded yet.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "14px" }}>
              {checkIns.slice(0, 3).map((ci) => (
                <div key={ci.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "#f8faf9", borderRadius: "8px", fontSize: "0.9rem" }}>
                  <span style={{ color: colors.muted }}>{ci.checkInDate}</span>
                  <span style={{ fontWeight: 600, color: colors.text }}>
                    {"★".repeat(ci.manageability)}{"☆".repeat(5 - ci.manageability)} {ci.manageability}/5
                  </span>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => onNavigate?.("checkins")}
            style={{
              padding: "9px 16px",
              background: colors.accent,
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: "0.9rem",
            }}
          >
            + Add Check-in
          </button>
        </div>

        {/* Current Summary Card */}
        <div
          style={{
            background: colors.surface,
            padding: "20px",
            borderRadius: "14px",
            border: "1px solid #dbe6df",
            boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
          }}
        >
          <h2 style={{ fontSize: "1.2rem", margin: "0 0 12px", color: colors.text }}>
            📊 Current Workload Status
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ padding: "12px", background: "#f8faf9", borderRadius: "8px" }}>
              <div style={{ fontSize: "0.85rem", color: colors.muted }}>Weekly Logged Effort</div>
              <div style={{ fontSize: "1.6rem", fontWeight: 700, color: colors.text }}>
                {latestTrend ? `${latestTrend.effortValue} ${latestTrend.effortUnit}` : "No data yet"}
              </div>
              {preferences.weeklyCapacity?.value ? (
                <div style={{ fontSize: "0.82rem", color: colors.muted, marginTop: "4px" }}>
                  Target capacity: {preferences.weeklyCapacity.value} {preferences.weeklyCapacity.unit}
                </div>
              ) : null}
            </div>

            <div style={{ padding: "12px", background: "#f8faf9", borderRadius: "8px" }}>
              <div style={{ fontSize: "0.85rem", color: colors.muted }}>Average Manageability</div>
              <div style={{ fontSize: "1.6rem", fontWeight: 700, color: colors.text }}>
                {latestTrend?.meanManageability ? `${latestTrend.meanManageability.toFixed(1)} / 5` : "N/A"}
              </div>
            </div>

            <div style={{ fontSize: "0.85rem", color: colors.muted }}>
              Evidence Coverage: <span style={{ fontWeight: 600, color: colors.text }}>{evidenceStrength}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Observations and Suggestions */}
      <div style={{ marginTop: "30px" }}>
        <h2 style={{ fontSize: "1.3rem", color: colors.text, marginBottom: "14px" }}>
          💡 Explainable Observations
        </h2>
        {insights.length === 0 ? (
          <div style={{ padding: "24px", background: colors.surface, border: "1px solid #dbe6df", borderRadius: "12px", color: colors.muted }}>
            No workload anomalies detected for this window. Observations are generated deterministically based on your logged history.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {insights.map((ins, i) => (
              <div
                key={i}
                style={{
                  background: colors.surface,
                  border: "1px solid #dbe6df",
                  borderLeft: `5px solid ${colors.accent}`,
                  padding: "16px 20px",
                  borderRadius: "10px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "16px",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        background: "#eaf2ee",
                        color: colors.accent,
                      }}
                    >
                      {ins.category}
                    </span>
                    <span style={{ fontSize: "0.8rem", color: colors.muted }}>
                      Evidence: {ins.evidenceStrength}
                    </span>
                  </div>
                  <strong style={{ display: "block", color: colors.text, fontSize: "1.05rem", marginBottom: "4px" }}>
                    {ins.title}
                  </strong>
                  <p style={{ margin: 0, color: colors.muted, fontSize: "0.92rem", lineHeight: 1.5 }}>
                    {ins.explanation}
                  </p>
                </div>
                <button
                  onClick={() => dismissInsight(ins.title)}
                  style={{
                    padding: "6px 12px",
                    background: "transparent",
                    border: "1px solid #c9d8d0",
                    borderRadius: "6px",
                    color: colors.muted,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Dismiss
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Tasks */}
      <div style={{ marginTop: "30px" }}>
        <h2 style={{ fontSize: "1.3rem", color: colors.text, marginBottom: "14px" }}>
          Recent Tasks
        </h2>
        <div style={{ background: colors.surface, border: "1px solid #dbe6df", borderRadius: "12px", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.92rem" }}>
            <thead>
              <tr style={{ background: "#f8faf9", borderBottom: "1px solid #dbe6df", color: colors.muted }}>
                <th style={{ padding: "12px 16px" }}>Title</th>
                <th style={{ padding: "12px 16px" }}>Date</th>
                <th style={{ padding: "12px 16px" }}>Effort</th>
                <th style={{ padding: "12px 16px" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {tasks.slice(0, 5).map((task) => (
                <tr key={task.id} style={{ borderBottom: "1px solid #eef3f0" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: colors.text }}>{task.title}</td>
                  <td style={{ padding: "12px 16px", color: colors.muted }}>{task.workDate}</td>
                  <td style={{ padding: "12px 16px", color: colors.text }}>
                    {task.effort.value} {task.effort.unit}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        background: task.status === "done" ? "#e6f4ea" : "#f1f3f4",
                        color: task.status === "done" ? "#137333" : "#3c4043",
                      }}
                    >
                      {task.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
