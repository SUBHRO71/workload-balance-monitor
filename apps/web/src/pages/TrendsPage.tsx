import React from "react";
import { colors } from "@workload/design-tokens";
import { useWorkload } from "../context/WorkloadContext";

export const TrendsPage: React.FC = () => {
  const { preferences, trends, evidenceStrength } = useWorkload();

  const maxEffort = Math.max(...trends.map((t) => t.effortValue), preferences.weeklyCapacity?.value ?? 40, 10);

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ margin: "0 0 6px", color: colors.text, fontSize: "1.8rem" }}>
          Personal Workload Trends
        </h1>
        <p style={{ margin: 0, color: colors.muted, fontSize: "0.95rem" }}>
          Fixed weekly windows of your logged effort and voluntary check-in manageability. Missing data reflects insufficient data, never a productivity judgment.
        </p>
      </div>

      <div
        style={{
          background: colors.surface,
          padding: "24px",
          border: "1px solid #dbe6df",
          borderRadius: "14px",
          marginBottom: "24px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div>
            <h2 style={{ fontSize: "1.15rem", margin: "0 0 4px", color: colors.text }}>Weekly Effort & Manageability</h2>
            <div style={{ fontSize: "0.85rem", color: colors.muted }}>
              Evidence Strength: <strong style={{ color: colors.accent }}>{evidenceStrength.toUpperCase()}</strong> ({trends.length} weekly windows)
            </div>
          </div>

          {preferences.weeklyCapacity?.value ? (
            <div style={{ fontSize: "0.85rem", color: colors.muted, background: "#f8faf9", padding: "6px 12px", borderRadius: "6px" }}>
              Target Weekly Capacity: <strong>{preferences.weeklyCapacity.value} {preferences.weeklyCapacity.unit}</strong>
            </div>
          ) : null}
        </div>

        {trends.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: colors.muted }}>
            Insufficient data to compute weekly trends. Enter tasks or check-ins to view your personal trends.
          </div>
        ) : (
          <div>
            {/* Visual Bar Chart */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: "16px", height: "200px", padding: "20px 0 30px", borderBottom: "1px solid #e0eae4" }}>
              {trends.map((point) => {
                const heightPercent = Math.min(100, Math.round((point.effortValue / maxEffort) * 100));
                const capacityExceeded = preferences.weeklyCapacity?.value && point.effortValue > preferences.weeklyCapacity.value;

                return (
                  <div
                    key={point.weekStart}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      height: "100%",
                      justifyContent: "flex-end",
                      position: "relative",
                    }}
                  >
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, color: colors.text, marginBottom: "6px" }}>
                      {point.effortValue} {point.effortUnit === "hours" ? "h" : "pts"}
                    </span>
                    <div
                      style={{
                        width: "100%",
                        maxWidth: "40px",
                        height: `${heightPercent}%`,
                        background: capacityExceeded ? "#e06d53" : colors.accent,
                        borderRadius: "6px 6px 0 0",
                        transition: "height 0.3s ease",
                      }}
                    />
                    <span style={{ fontSize: "0.75rem", color: colors.muted, marginTop: "8px", whiteSpace: "nowrap" }}>
                      {point.weekStart.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Accessible Table Alternative */}
            <div style={{ marginTop: "24px" }}>
              <h3 style={{ fontSize: "0.95rem", color: colors.text, marginBottom: "10px" }}>
                Accessible Data Table
              </h3>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
                <thead>
                  <tr style={{ background: "#f8faf9", borderBottom: "1px solid #dbe6df", color: colors.muted }}>
                    <th style={{ padding: "8px 12px" }}>Week Starting</th>
                    <th style={{ padding: "8px 12px" }}>Logged Effort</th>
                    <th style={{ padding: "8px 12px" }}>Avg Manageability</th>
                    <th style={{ padding: "8px 12px" }}>Tasks Count</th>
                  </tr>
                </thead>
                <tbody>
                  {trends.map((point) => (
                    <tr key={point.weekStart} style={{ borderBottom: "1px solid #eef3f0" }}>
                      <td style={{ padding: "8px 12px", color: colors.text }}>{point.weekStart}</td>
                      <td style={{ padding: "8px 12px", fontWeight: 600 }}>{point.effortValue} {point.effortUnit}</td>
                      <td style={{ padding: "8px 12px" }}>
                        {point.meanManageability !== undefined ? `${point.meanManageability.toFixed(1)} / 5` : "No rating"}
                      </td>
                      <td style={{ padding: "8px 12px", color: colors.muted }}>{point.taskIds.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
