import React, { useEffect, useMemo, useState } from "react";
import { WorkloadApiClient } from "@workload/api-client";
import { colors } from "@workload/design-tokens";
import type { AggregateResponse, HumanActionRecord } from "@workload/contracts";
import { useAuth } from "../auth";

// ---- Presentation-only helpers (no data fetching, no backend contact) ----
type CSSVars = React.CSSProperties & { [key: `${"--"}${string}`]: string | number };
const RING_CIRCUMFERENCE = 2 * Math.PI * 42;
const FULL_TIME_REFERENCE_HOURS = 40;
const EVIDENCE_LEVELS = ["limited", "developing", "consistent"] as const;

const HEALTH = {
  good: { fg: "#137333", bg: "#e6f4ea", ring: "#137333" },
  warn: { fg: "#b06000", bg: "#fef7e0", ring: "#b06000" },
  bad: { fg: "#b3261e", bg: "#fce8e6", ring: "#b3261e" },
} as const;

function manageabilityHealth(value: number): typeof HEALTH[keyof typeof HEALTH] & { key: "good" | "warn" | "bad" } {
  if (value >= 3.75) return { ...HEALTH.good, key: "good" };
  if (value >= 2.5) return { ...HEALTH.warn, key: "warn" };
  return { ...HEALTH.bad, key: "bad" };
}

const STATUS_META: Record<string, { fg: string; bg: string }> = {
  resolved: HEALTH.good,
  in_progress: { fg: "#1a73e8", bg: "#e8f0fe" },
  open: HEALTH.warn,
};

const STATE_META: Record<string, { fg: string; bg: string; border: string; label: string }> = {
  available: { fg: "#137333", bg: "#e6f4ea", border: "#b7e1c2", label: "Disclosed" },
  unsafe_overlap: { fg: "#c5221f", bg: "#fce8e6", border: "#fad2cf", label: "Suppressed · unsafe overlap" },
  insufficient_contributors: { fg: "#b06000", bg: "#fef7e0", border: "#feefc3", label: "Suppressed · insufficient contributors" },
};

function stateMeta(state: string) {
  return STATE_META[state] ?? { fg: "#b06000", bg: "#fef7e0", border: "#feefc3", label: "Suppressed" };
}

// Animates a number counting up on mount / whenever the target changes —
// purely cosmetic, reads no data that isn't already in state.
const CountUp: React.FC<{ value: number; decimals?: number; suffix?: string }> = ({ value, decimals = 0, suffix = "" }) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const duration = 650;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(value * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{display.toFixed(decimals)}{suffix}</>;
};

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

  // ---- Purely derived, display-only values — no new data sources ----
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), 60);
    return () => window.clearTimeout(t);
  }, []);

  const now = Date.now();
  const isOverdue = (a: HumanActionRecord) => a.status === "open" && !!a.followUpAt && new Date(a.followUpAt).getTime() < now;
  const overdueCount = actions.filter(isOverdue).length;
  const openCount = actions.filter((a) => a.status === "open").length;
  const resolvedCount = actions.filter((a) => a.status === "resolved").length;
  const inProgressCount = actions.filter((a) => a.status === "in_progress").length;
  const actionTotal = actions.length || 1;

  const metrics = aggregate?.state === "available" ? aggregate.metrics?.filter((m) => m.key !== "capacityRatio") : undefined;
  const effortMetric = metrics?.find((m) => m.key === "meanWeeklyEffort");
  const manageabilityMetric = metrics?.find((m) => m.key === "meanManageability");
  const health = manageabilityMetric ? manageabilityHealth(manageabilityMetric.value) : undefined;
  const manageabilityPct = manageabilityMetric ? Math.min(1, manageabilityMetric.value / 5) : 0;
  const effortPct = effortMetric ? Math.min(1, effortMetric.value / FULL_TIME_REFERENCE_HOURS) : 0;
  const evidenceIdx = aggregate ? EVIDENCE_LEVELS.indexOf(aggregate.evidenceStrength) : -1;
  const releaseMeta = aggregate ? stateMeta(aggregate.state) : undefined;

  const pageVars: CSSVars = {
    "--hr-accent": colors.accent,
    "--hr-text": colors.text,
    "--hr-muted": colors.muted,
    "--hr-surface": colors.surface,
  };

  return (
    <div className={`hr-root${mounted ? " hr-mounted" : ""}`} style={pageVars}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=Inter:wght@400;500;600;700&display=swap');

        .hr-root { font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif; color: var(--hr-text); }
        .hr-root * { box-sizing: border-box; }
        .hr-serif { font-family: "Newsreader", Georgia, serif; }

        .hr-head { margin-bottom: 22px; }
        .hr-head-row { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; flex-wrap: wrap; }
        .hr-head-row h1 { margin: 0; font-size: 1.7rem; font-weight: 500; color: var(--hr-text); }
        .hr-scope-badge {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 3px 10px; border-radius: 20px;
          background: #e8f0fe; color: #1a73e8;
          font-size: 0.72rem; font-weight: 600;
        }
        .hr-scope-badge::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: #1a73e8; }
        .hr-head p { margin: 0; color: var(--hr-muted); font-size: 0.94rem; max-width: 74ch; line-height: 1.5; }

        /* Quick stat strip */
        .hr-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1px; background: #dbe6df; border: 1px solid #dbe6df; border-radius: 12px; overflow: hidden; margin-bottom: 22px; }
        .hr-stat { background: var(--hr-surface); padding: 14px 18px; transition: background 0.2s ease; }
        .hr-stat:hover { background: #f8faf9; }
        .hr-stat-label { font-size: 0.76rem; color: var(--hr-muted); margin-bottom: 6px; }
        .hr-stat-value { font-size: 1.4rem; font-weight: 600; font-family: "Newsreader", Georgia, serif; }
        .hr-stat-flag { font-size: 0.72rem; font-weight: 600; color: #b3261e; margin-top: 4px; display: flex; align-items: center; gap: 4px; }
        .hr-pulse-dot { width: 6px; height: 6px; border-radius: 50%; background: #b3261e; animation: hrPulse 1.6s ease-in-out infinite; }
        @keyframes hrPulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.4); } }
        @media (prefers-reduced-motion: reduce) { .hr-pulse-dot { animation: none; } }

        .hr-evidence-dots { display: flex; gap: 4px; margin-top: 6px; }
        .hr-evidence-dot { width: 22px; height: 5px; border-radius: 3px; background: #eef3f0; }
        .hr-evidence-dot.hr-on { background: var(--hr-accent); }

        .hr-fade-in { animation: hrFadeIn 0.32s ease both; }
        @keyframes hrFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .hr-fade-in { animation: none; } }

        .hr-notice {
          border-radius: 10px; padding: 13px 18px; display: flex; align-items: flex-start; gap: 12px;
          font-size: 0.86rem; margin-bottom: 22px; border: 1px solid;
        }
        .hr-notice svg { flex-shrink: 0; margin-top: 1px; }

        .hr-panel { background: var(--hr-surface); border: 1px solid #dbe6df; border-radius: 14px; padding: 24px; transition: box-shadow 0.2s ease; }
        .hr-panel:hover { box-shadow: 0 4px 18px rgba(20, 40, 30, 0.05); }
        .hr-panel + .hr-panel { margin-top: 16px; }
        .hr-panel-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; flex-wrap: wrap; margin-bottom: 18px; }
        .hr-panel-title { font-size: 1.14rem; font-weight: 600; color: var(--hr-text); margin: 0 0 4px; }
        .hr-panel-sub { font-size: 0.84rem; color: var(--hr-muted); }

        .hr-pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; white-space: nowrap; border: 1px solid transparent; }

        .hr-metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
        .hr-metric-card { border-radius: 12px; padding: 20px; display: flex; align-items: center; gap: 18px; border: 1px solid #eef3f0; transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .hr-metric-card:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(20,40,30,0.06); }
        .hr-metric-text-label { font-size: 0.83rem; color: var(--hr-muted); margin-bottom: 4px; }
        .hr-metric-value { font-size: 1.7rem; font-weight: 500; }
        .hr-metric-band { font-size: 0.75rem; color: var(--hr-muted); margin-top: 8px; }
        .hr-metric-band b { color: var(--hr-text); font-weight: 600; }
        .hr-metric-bar-track { height: 6px; border-radius: 3px; background: #eef3f0; overflow: hidden; margin-top: 10px; width: 100%; }
        .hr-metric-bar-fill { height: 100%; border-radius: 3px; background: var(--hr-accent); width: 0%; transition: width 1.1s cubic-bezier(0.2,0.6,0.2,1); }
        .hr-mounted .hr-metric-bar-fill { width: var(--fill, 0%); }
        .hr-ring-bg { fill: none; stroke: #eef3f0; stroke-width: 7; }

        .hr-suppressed-box { border-radius: 10px; padding: 18px 20px; font-size: 0.9rem; display: flex; gap: 12px; align-items: flex-start; border: 1px solid; }

        /* Decision status breakdown */
        .hr-breakdown-bar { display: flex; height: 10px; border-radius: 5px; overflow: hidden; background: #eef3f0; }
        .hr-breakdown-seg { height: 100%; width: 0%; transition: width 0.9s cubic-bezier(0.2,0.6,0.2,1); }
        .hr-mounted .hr-breakdown-seg { width: var(--seg, 0%); }
        .hr-breakdown-legend { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 10px; font-size: 0.78rem; color: var(--hr-muted); }
        .hr-breakdown-legend span { display: inline-flex; align-items: center; gap: 6px; }
        .hr-legend-dot { width: 8px; height: 8px; border-radius: 50%; }

        .hr-field { display: flex; flex-direction: column; gap: 5px; }
        .hr-field label { font-size: 0.83rem; color: var(--hr-muted); }
        .hr-field textarea, .hr-field input[type="date"] {
          font-family: inherit; font-size: 0.9rem; padding: 10px 12px;
          border-radius: 8px; border: 1px solid #cedcd3; background: #fff; color: var(--hr-text);
          transition: border-color 0.15s ease, box-shadow 0.15s ease; width: 100%;
        }
        .hr-field textarea:focus, .hr-field input:focus { outline: none; border-color: var(--hr-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--hr-accent) 15%, transparent); }

        .hr-submit {
          padding: 10px 22px; border-radius: 8px; border: none;
          background: var(--hr-accent); color: #fff; font-weight: 600; font-size: 0.9rem;
          cursor: pointer; transition: opacity 0.15s ease, transform 0.15s ease;
        }
        .hr-submit:disabled { opacity: 0.6; cursor: wait; }
        .hr-submit:not(:disabled):hover { opacity: 0.92; transform: translateY(-1px); }

        .hr-action-card { padding: 16px 18px; border-radius: 10px; border-left: 3px solid #e5ede8; background: #fafcfb; border-top: 1px solid #e5ede8; border-right: 1px solid #e5ede8; border-bottom: 1px solid #e5ede8; transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .hr-action-card:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(20,40,30,0.05); }
        .hr-action-card + .hr-action-card { margin-top: 10px; }
        .hr-action-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
        .hr-action-author { color: var(--hr-text); font-size: 0.94rem; font-weight: 600; }
        .hr-action-rationale { margin: 8px 0 0; color: var(--hr-text); font-size: 0.9rem; line-height: 1.5; }
        .hr-action-meta { display: flex; justify-content: space-between; color: var(--hr-muted); font-size: 0.78rem; margin-top: 8px; }
        .hr-overdue-text { color: #b3261e; font-weight: 600; }

        .hr-status-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; margin-right: 6px; }
        .hr-empty { color: var(--hr-muted); font-size: 0.9rem; padding: 6px 0; }

        @media (max-width: 640px) {
          .hr-panel { padding: 18px; }
          .hr-metric-card { flex-direction: column; align-items: flex-start; }
        }
      `}</style>

      {/* Header */}
      <div className="hr-head">
        <div className="hr-head-row">
          <h1 className="hr-serif">HR overview: organization releases</h1>
          <span className="hr-scope-badge">HR scope</span>
        </div>
        <p>
          Organization-level approved aggregates, trends, and evidence coverage. Strictly no individual lookup,
          employee ranking, or team drill-down.
        </p>
      </div>

      {/* Quick stat strip — derived purely from already-loaded aggregate/actions */}
      <div className="hr-stats">
        <div className="hr-stat">
          <div className="hr-stat-label">Release state</div>
          <div className="hr-stat-value" style={{ fontSize: "1.02rem", color: releaseMeta?.fg ?? colors.muted }}>
            {aggregate ? releaseMeta?.label : "—"}
          </div>
        </div>
        <div className="hr-stat">
          <div className="hr-stat-label">Evidence strength</div>
          <div className="hr-stat-value" style={{ fontSize: "1.02rem", textTransform: "capitalize" }}>
            {aggregate ? aggregate.evidenceStrength : "—"}
          </div>
          <div className="hr-evidence-dots">
            {EVIDENCE_LEVELS.map((lvl, i) => (
              <span key={lvl} className={`hr-evidence-dot${i <= evidenceIdx ? " hr-on" : ""}`} />
            ))}
          </div>
        </div>
        <div className="hr-stat">
          <div className="hr-stat-label">Mean manageability</div>
          <div className="hr-stat-value" style={{ color: health?.fg }}>
            {manageabilityMetric ? <><CountUp value={manageabilityMetric.value} decimals={1} /> / 5</> : "—"}
          </div>
        </div>
        <div className="hr-stat">
          <div className="hr-stat-label">Open decisions</div>
          <div className="hr-stat-value">
            <CountUp value={openCount} />
          </div>
          {overdueCount > 0 && (
            <div className="hr-stat-flag">
              <span className="hr-pulse-dot" />
              {overdueCount} overdue
            </div>
          )}
        </div>
      </div>

      {/* Privacy baseline notice */}
      <div className="hr-notice" style={{ background: "#e6f4ea", borderColor: "#137333", color: "#137333" }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6l7-3z" stroke="#137333" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M9 12l2 2 4-4" stroke="#137333" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div>
          <strong>Strict privacy baseline.</strong> Releases require at least 5 distinct consenting contributors per
          reporting window (<code>consent.organizationAggregation = true</code>). Successive release overlap
          suppression prevents differential identification when organization composition changes.
        </div>
      </div>

      {/* Organization Aggregate */}
      <div className="hr-panel hr-fade-in">
        <div className="hr-panel-head">
          <div>
            <p className="hr-panel-title">Organization weekly release</p>
            {aggregate && (
              <span className="hr-panel-sub">
                Window: {aggregate.range.from} to {aggregate.range.to} · Generated:{" "}
                {aggregate.generatedAt ? new Date(aggregate.generatedAt).toLocaleString() : "—"}
              </span>
            )}
          </div>
          {aggregate && releaseMeta && (
            <span className="hr-pill" style={{ background: releaseMeta.bg, color: releaseMeta.fg, borderColor: releaseMeta.border }}>
              {releaseMeta.label}
            </span>
          )}
        </div>

        {aggregateLoading && <p className="hr-empty">Loading organization aggregate…</p>}
        {aggregateError && (
          <div role="alert" className="hr-pill" style={{ background: "#fce8e6", color: "#b3261e", marginBottom: 8 }}>
            {aggregateError}
          </div>
        )}

        {!aggregateLoading && aggregate?.state === "available" && metrics && (
          <div className="hr-metric-grid">
            {effortMetric && (
              <div className="hr-metric-card" style={{ background: "#f9fbfa" }}>
                <div style={{ flex: 1 }}>
                  <div className="hr-metric-text-label">Mean weekly effort</div>
                  <div className="hr-metric-value hr-serif">
                    <CountUp value={effortMetric.value} decimals={1} /> hrs
                  </div>
                  <div className="hr-metric-bar-track">
                    <div className="hr-metric-bar-fill" style={{ "--fill": `${effortPct * 100}%` } as CSSVars} />
                  </div>
                  <div className="hr-metric-band">Relative to a standard {FULL_TIME_REFERENCE_HOURS}h week · Cohort: <b>{effortMetric.contributorCountBand}</b></div>
                </div>
              </div>
            )}
            {manageabilityMetric && health && (
              <div className="hr-metric-card" style={{ background: health.bg }}>
                <svg width="80" height="80" viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
                  <circle className="hr-ring-bg" cx="50" cy="50" r="42" />
                  <circle
                    cx="50" cy="50" r="42"
                    fill="none"
                    stroke={health.ring}
                    strokeWidth="7"
                    strokeLinecap="round"
                    style={{ transform: "rotate(-90deg)", transformOrigin: "50px 50px", transition: "stroke-dashoffset 1.1s cubic-bezier(0.2,0.6,0.2,1)" }}
                    strokeDasharray={RING_CIRCUMFERENCE}
                    strokeDashoffset={mounted ? RING_CIRCUMFERENCE * (1 - manageabilityPct) : RING_CIRCUMFERENCE}
                  />
                  <text x="50" y="55" textAnchor="middle" fontSize="19" fontWeight={600} fill={health.fg}>
                    {manageabilityMetric.value}
                  </text>
                </svg>
                <div>
                  <div className="hr-metric-text-label">Mean manageability</div>
                  <div className="hr-metric-value hr-serif" style={{ color: health.fg }}>
                    {health.key === "good" ? "Healthy" : health.key === "warn" ? "Watch" : "At risk"}
                  </div>
                  <div className="hr-metric-band">Cohort: <b>{manageabilityMetric.contributorCountBand} members</b></div>
                </div>
              </div>
            )}
          </div>
        )}

        {!aggregateLoading && aggregate?.state && aggregate.state !== "available" && (
          <div
            className="hr-suppressed-box"
            style={{
              background: releaseMeta?.bg,
              borderColor: releaseMeta?.border,
              color: releaseMeta?.fg,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ marginTop: 2, flexShrink: 0 }}>
              <rect x="5" y="10" width="14" height="10" rx="2" stroke={releaseMeta?.fg} strokeWidth="1.6" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke={releaseMeta?.fg} strokeWidth="1.6" />
            </svg>
            <div><strong>Release suppressed.</strong> {aggregate.reason}</div>
          </div>
        )}

        {!aggregateLoading && !aggregate && !aggregateError && (
          <p className="hr-empty">No organization release is available yet.</p>
        )}
      </div>

      {/* Organization Human Actions */}
      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }} className="hr-fade-in">
        {actions.length > 0 && (
          <div className="hr-panel">
            <p className="hr-panel-title">Decision status breakdown</p>
            <span className="hr-panel-sub" style={{ display: "block", marginBottom: 14 }}>
              {actions.length} recorded decision{actions.length === 1 ? "" : "s"} at the organization level
            </span>
            <div className="hr-breakdown-bar">
              {resolvedCount > 0 && <span className="hr-breakdown-seg" style={{ background: HEALTH.good.fg, "--seg": `${(resolvedCount / actionTotal) * 100}%` } as CSSVars} />}
              {inProgressCount > 0 && <span className="hr-breakdown-seg" style={{ background: "#1a73e8", "--seg": `${(inProgressCount / actionTotal) * 100}%` } as CSSVars} />}
              {openCount - overdueCount > 0 && <span className="hr-breakdown-seg" style={{ background: HEALTH.warn.fg, "--seg": `${((openCount - overdueCount) / actionTotal) * 100}%` } as CSSVars} />}
              {overdueCount > 0 && <span className="hr-breakdown-seg" style={{ background: HEALTH.bad.fg, "--seg": `${(overdueCount / actionTotal) * 100}%` } as CSSVars} />}
            </div>
            <div className="hr-breakdown-legend">
              <span><span className="hr-legend-dot" style={{ background: HEALTH.good.fg }} />Resolved · {resolvedCount}</span>
              <span><span className="hr-legend-dot" style={{ background: "#1a73e8" }} />In progress · {inProgressCount}</span>
              <span><span className="hr-legend-dot" style={{ background: HEALTH.warn.fg }} />Open · {openCount - overdueCount}</span>
              {overdueCount > 0 && <span><span className="hr-legend-dot" style={{ background: HEALTH.bad.fg }} />Overdue · {overdueCount}</span>}
            </div>
          </div>
        )}

        <div className="hr-panel">
          <p className="hr-panel-title">Organization-level human decisions &amp; follow-up</p>
          <p className="hr-panel-sub" style={{ marginBottom: 16, display: "block" }}>
            Record organization-wide initiatives (e.g. wellness cycles, hiring allocation, workload rebalancing).
            Human follow-ups operate at the organization level without individual employee case files.
          </p>

          <form onSubmit={(e) => void recordAction(e)} style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 6 }}>
            <div className="hr-field">
              <label>Action rationale &amp; program plan</label>
              <textarea
                rows={3}
                value={newRationale}
                onChange={(e) => setNewRationale(e.target.value)}
                placeholder="Document organization-level follow-up (e.g. scheduling no-meeting focus blocks, reviewing project headcount allocation)..."
                required
              />
            </div>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div className="hr-field" style={{ width: 180 }}>
                <label>Follow-up date (optional)</label>
                <input type="date" value={newFollowUp} onChange={(e) => setNewFollowUp(e.target.value)} />
              </div>
              <button type="submit" className="hr-submit" disabled={submitting}>
                {submitting ? "Saving…" : "Record organization action"}
              </button>
            </div>
            {submitError && (
              <div role="alert" className="hr-pill" style={{ background: "#fce8e6", color: "#b3261e" }}>
                {submitError}
              </div>
            )}
          </form>

          {actionsLoading && <p className="hr-empty">Loading HR actions…</p>}
          {actionsError && (
            <div role="alert" className="hr-pill" style={{ background: "#fce8e6", color: "#b3261e" }}>
              {actionsError}
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            {!actionsLoading && actions.length === 0 && !actionsError && (
              <p className="hr-empty">No organization-level actions recorded yet.</p>
            )}
            {actions.map((act) => {
              const overdue = isOverdue(act);
              const meta = overdue ? HEALTH.bad : (STATUS_META[act.status] ?? { fg: "#5f6368", bg: "#eef0ef" });
              return (
                <div className="hr-action-card" style={{ borderLeftColor: meta.fg }} key={act.id}>
                  <div className="hr-action-head">
                    <strong className="hr-action-author">{act.authorName}</strong>
                    <span style={{ fontSize: "0.83rem", color: meta.fg, display: "flex", alignItems: "center", fontWeight: 600 }}>
                      <span className="hr-status-dot" style={{ background: meta.fg }} />
                      {overdue ? "Overdue" : act.status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="hr-action-rationale">{act.rationale}</p>
                  <div className="hr-action-meta">
                    <span>Recorded: {new Date(act.createdAt).toLocaleDateString()}</span>
                    {act.followUpAt && (
                      <span className={overdue ? "hr-overdue-text" : ""}>Review by: {act.followUpAt.slice(0, 10)}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};