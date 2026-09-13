import React, { useEffect, useMemo, useState } from "react";
import { WorkloadApiClient } from "@workload/api-client";
import { colors } from "@workload/design-tokens";
import type { AggregateResponse, HumanActionRecord } from "@workload/contracts";
import { useAuth } from "../auth";

export const HrPage: React.FC = () => {
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

  const [aggregate, setAggregate] = useState<AggregateResponse | null>(null);
  const [aggregateLoading, setAggregateLoading] = useState(true);
  const [aggregateError, setAggregateError] = useState("");

  const [actions, setActions] = useState<HumanActionRecord[]>([]);
  const [actionsLoading, setActionsLoading] = useState(true);
  const [actionsError, setActionsError] = useState("");

  const [newRationale, setNewRationale] = useState("");
  const [newFollowUp, setNewFollowUp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!auth.accessToken || !orgId) return;
    setAggregateLoading(true);
    void api
      .getOrgTrends()
      .then((result) => setAggregate(result))
      .catch((cause: unknown) =>
        setAggregateError(
          cause instanceof Error ? cause.message : "Unable to load organization aggregate",
        ),
      )
      .finally(() => setAggregateLoading(false));
  }, [api, auth.accessToken, orgId]);

  useEffect(() => {
    if (!auth.accessToken || !orgId) return;
    setActionsLoading(true);
    void api
      .listHrActions()
      .then(({ items }) => setActions(items))
      .catch((cause: unknown) =>
        setActionsError(
          cause instanceof Error ? cause.message : "Unable to load HR actions",
        ),
      )
      .finally(() => setActionsLoading(false));
  }, [api, auth.accessToken, orgId]);

  const recordAction = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newRationale) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const created = await api.createHrAction({
        rationale: newRationale,
        status: "open",
        ...(newFollowUp
          ? { followUpAt: new Date(`${newFollowUp}T00:00:00.000Z`).toISOString() }
          : {}),
      });
      setActions((prev) => [created, ...prev]);
      setNewRationale("");
      setNewFollowUp("");
    } catch (cause) {
      setSubmitError(
        cause instanceof Error ? cause.message : "Failed to record action",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
          <h1 style={{ margin: 0, fontSize: "1.8rem", color: colors.text }}>
            HR Overview: Organization Releases
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
          Organization-level approved aggregates, trends, and evidence coverage. Strictly no
          individual lookup, employee ranking, or team drill-down.
        </p>
      </div>

      {/* Privacy baseline notice */}
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
          <strong>Strict Privacy Baseline:</strong> Releases require at least 5 distinct consenting
          contributors per reporting window (<code>consent.organizationAggregation = true</code>).
          Successive release overlap suppression prevents differential identification when
          organization composition changes.
        </div>
      </div>

      {/* Organization Aggregate Card */}
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "1.2rem", color: colors.text }}>
              Organization Weekly Release
            </h2>
            {aggregate && (
              <span style={{ fontSize: "0.85rem", color: colors.muted }}>
                Window: {aggregate.range.from} to {aggregate.range.to} | Generated:{" "}
                {aggregate.generatedAt
                  ? new Date(aggregate.generatedAt).toLocaleString()
                  : "—"}{" "}
                | Evidence: {aggregate.evidenceStrength.toUpperCase()}
              </span>
            )}
          </div>
          {aggregate && (
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
          )}
        </div>

        {aggregateLoading && (
          <p style={{ color: colors.muted, margin: 0 }}>Loading organization aggregate…</p>
        )}
        {aggregateError && (
          <div
            role="alert"
            style={{ padding: "12px", color: "#b3261e", background: "#fce8e6", borderRadius: "8px" }}
          >
            {aggregateError}
          </div>
        )}

        {!aggregateLoading && aggregate?.state === "available" && aggregate.metrics && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
            }}
          >
            {aggregate.metrics
              .filter((m) => m.key !== "capacityRatio")
              .map((metric) => (
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
                    Cohort Contributor Band:{" "}
                    <strong>{metric.contributorCountBand} members</strong>
                  </span>
                </div>
              ))}
          </div>
        )}

        {!aggregateLoading && aggregate?.state && aggregate.state !== "available" && (
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

        {!aggregateLoading && !aggregate && !aggregateError && (
          <p style={{ color: colors.muted, margin: 0 }}>No organization release is available yet.</p>
        )}
      </div>

      {/* Organization Human Actions */}
      <div
        style={{
          background: colors.surface,
          padding: "20px",
          borderRadius: "10px",
          border: "1px solid #e0eae4",
        }}
      >
        <h3 style={{ margin: "0 0 8px 0", color: colors.text, fontSize: "1.1rem" }}>
          Organization-Level Human Decisions &amp; Follow-up
        </h3>
        <p style={{ margin: "0 0 16px 0", color: colors.muted, fontSize: "0.88rem" }}>
          Record organization-wide initiatives (e.g. wellness cycles, hiring allocation, workload
          rebalancing). Human follow-ups operate at the organization level without individual
          employee case files.
        </p>

        <form
          onSubmit={(e) => void recordAction(e)}
          style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}
        >
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.85rem",
                color: colors.muted,
                marginBottom: "4px",
              }}
            >
              Action Rationale &amp; Program Plan
            </label>
            <textarea
              rows={3}
              value={newRationale}
              onChange={(e) => setNewRationale(e.target.value)}
              placeholder="Document organization-level follow-up (e.g. scheduling no-meeting focus blocks, reviewing project headcount allocation)..."
              required
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "6px",
                border: "1px solid #cedcd3",
                fontSize: "0.9rem",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
            <div style={{ width: "180px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  color: colors.muted,
                  marginBottom: "4px",
                }}
              >
                Follow-up Date (Optional)
              </label>
              <input
                type="date"
                value={newFollowUp}
                onChange={(e) => setNewFollowUp(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid #cedcd3",
                }}
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: "9px 20px",
                borderRadius: "6px",
                border: "none",
                background: colors.accent,
                color: "#ffffff",
                fontWeight: 600,
                cursor: submitting ? "wait" : "pointer",
              }}
            >
              {submitting ? "Saving…" : "Record Organization Action"}
            </button>
          </div>
          {submitError && (
            <div
              role="alert"
              style={{ padding: "10px", color: "#b3261e", background: "#fce8e6", borderRadius: "6px" }}
            >
              {submitError}
            </div>
          )}
        </form>

        {actionsLoading && (
          <p style={{ color: colors.muted }}>Loading HR actions…</p>
        )}
        {actionsError && (
          <div
            role="alert"
            style={{ padding: "12px", color: "#b3261e", background: "#fce8e6", borderRadius: "8px" }}
          >
            {actionsError}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {!actionsLoading && actions.length === 0 && !actionsError && (
            <p style={{ color: colors.muted }}>No organization-level actions recorded yet.</p>
          )}
          {actions.map((act) => (
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
              <div
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <strong style={{ color: colors.text, fontSize: "0.95rem" }}>
                  {act.authorName}
                </strong>
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: "4px",
                    background:
                      act.status === "resolved"
                        ? "#e6f4ea"
                        : act.status === "in_progress"
                          ? "#e8f0fe"
                          : "#fef7e0",
                    color:
                      act.status === "resolved"
                        ? "#137333"
                        : act.status === "in_progress"
                          ? "#1a73e8"
                          : "#b06000",
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
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  color: colors.muted,
                  fontSize: "0.8rem",
                }}
              >
                <span>Recorded: {new Date(act.createdAt).toLocaleDateString()}</span>
                {act.followUpAt && <span>Review by: {act.followUpAt.slice(0, 10)}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
