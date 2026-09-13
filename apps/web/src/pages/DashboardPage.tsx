import React from "react";
import { colors } from "@workload/design-tokens";
import { useWorkload } from "../context/WorkloadContext";
import type { NavTab } from "../components/Navigation";

// Extend CSSProperties so we can pass CSS custom properties (--wl-*) through
// inline style without fighting TypeScript. All real colors still come from
// the design-token `colors` object or the existing neutral palette already
// used across this file (#dbe6df, #f8faf9, #eef3f0, #fff9eb/#ffe2a3) — no new
// colors are introduced.
type CSSVars = React.CSSProperties & { [key: `--${string}`]: string | number };

const CIRCUMFERENCE = 2 * Math.PI * 54; // r=54 gauge

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
  const manageabilityPct = latestTrend?.meanManageability
    ? Math.min(1, Math.max(0, latestTrend.meanManageability / 5))
    : 0;

  // Recent effort history for the sparkline (oldest → newest, last 8 points)
  const sparklinePoints = trends.slice(-8);
  const sparklineValues = sparklinePoints.map((t) => t.effortValue);
  const sparkMin = sparklineValues.length ? Math.min(...sparklineValues) : 0;
  const sparkMax = sparklineValues.length ? Math.max(...sparklineValues) : 1;
  const sparkRange = sparkMax - sparkMin || 1;

  const sparkWidth = 220;
  const sparkHeight = 56;
  const sparkCoords = sparklineValues.map((v, i) => {
    const x = sparklineValues.length > 1 ? (i / (sparklineValues.length - 1)) * sparkWidth : sparkWidth / 2;
    const y = sparkHeight - ((v - sparkMin) / sparkRange) * (sparkHeight - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const sparklinePath = sparkCoords.length ? `M ${sparkCoords.join(" L ")}` : "";

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), 60);
    return () => window.clearTimeout(t);
  }, []);

  const rootVars: CSSVars = {
    "--wl-accent": colors.accent,
    "--wl-text": colors.text,
    "--wl-muted": colors.muted,
    "--wl-surface": colors.surface,
  };

  return (
    <div className="wl-root" style={rootVars}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=Inter:wght@400;500;600;700&display=swap');

        .wl-root {
          font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
          color: var(--wl-text);
          max-width: 980px;
        }
        .wl-root * { box-sizing: border-box; }
        .wl-serif { font-family: "Newsreader", Georgia, serif; }

        .wl-intro { margin-bottom: 36px; }
        .wl-intro h1 {
          font-size: 2.15rem;
          font-weight: 500;
          line-height: 1.2;
          margin: 0 0 12px;
          color: var(--wl-text);
          max-width: 22ch;
        }
        .wl-intro p {
          margin: 0;
          color: var(--wl-muted);
          font-size: 0.96rem;
          max-width: 52ch;
          line-height: 1.55;
        }

        .wl-consent-banner {
          padding: 16px 20px;
          background: #fff9eb;
          border: 1px solid #ffe2a3;
          border-radius: 10px;
          margin-bottom: 28px;
        }
        .wl-consent-banner strong { color: #8a5800; font-weight: 600; }
        .wl-consent-banner p { margin: 6px 0 0; color: #6b4500; font-size: 0.92rem; }

        /* ---- Hero: headline + gauge, one unified panel with a hairline divider ---- */
        .wl-hero {
          display: grid;
          grid-template-columns: 1.15fr 1fr;
          gap: 0;
          border: 1px solid #dbe6df;
          border-radius: 14px;
          background: var(--wl-surface);
          overflow: hidden;
          margin-bottom: 32px;
        }
        .wl-hero-left, .wl-hero-right {
          padding: 28px 30px;
        }
        .wl-hero-left {
          border-right: 1px solid #eef3f0;
        }
        .wl-hero-eyebrow {
          font-size: 0.8rem;
          color: var(--wl-muted);
          margin: 0 0 6px;
        }
        .wl-hero-figure {
          font-size: 2.7rem;
          font-weight: 500;
          margin: 0 0 4px;
          line-height: 1;
        }
        .wl-hero-sub {
          font-size: 0.86rem;
          color: var(--wl-muted);
          margin: 0 0 18px;
        }
        .wl-sparkline-wrap { margin-top: 4px; }
        .wl-sparkline-path {
          fill: none;
          stroke: var(--wl-accent);
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-dasharray: 700;
          stroke-dashoffset: 700;
          transition: stroke-dashoffset 1.1s cubic-bezier(0.2, 0.6, 0.2, 1);
        }
        .wl-root.wl-mounted .wl-sparkline-path { stroke-dashoffset: 0; }
        .wl-sparkline-caption {
          margin-top: 6px;
          font-size: 0.78rem;
          color: var(--wl-muted);
        }

        .wl-gauge-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          text-align: center;
        }
        .wl-gauge-ring-bg { fill: none; stroke: #eef3f0; stroke-width: 8; }
        .wl-gauge-ring-fg {
          fill: none;
          stroke: var(--wl-accent);
          stroke-width: 8;
          stroke-linecap: round;
          transform: rotate(-90deg);
          transform-origin: 60px 60px;
          transition: stroke-dashoffset 1.2s cubic-bezier(0.2, 0.6, 0.2, 1);
        }
        .wl-gauge-value {
          font-size: 1.5rem;
          font-weight: 500;
        }
        .wl-gauge-label {
          font-size: 0.78rem;
          color: var(--wl-muted);
          margin-top: 2px;
        }
        .wl-gauge-caption {
          margin-top: 14px;
          font-size: 0.82rem;
          color: var(--wl-muted);
        }
        .wl-gauge-caption b { color: var(--wl-text); font-weight: 600; }

        /* ---- Check-ins timeline ---- */
        .wl-section { margin-top: 36px; }
        .wl-section-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        .wl-section-head h2 {
          font-size: 1.2rem;
          font-weight: 500;
          margin: 0;
          color: var(--wl-text);
        }
        .wl-add-checkin {
          background: none;
          border: none;
          padding: 0;
          color: var(--wl-accent);
          font-size: 0.88rem;
          font-weight: 600;
          cursor: pointer;
          border-bottom: 1px solid transparent;
        }
        .wl-add-checkin:hover, .wl-add-checkin:focus-visible {
          border-bottom-color: var(--wl-accent);
        }

        .wl-timeline { display: flex; flex-direction: column; }
        .wl-timeline-row {
          display: grid;
          grid-template-columns: 100px 20px 1fr;
          align-items: center;
          padding: 9px 0;
        }
        .wl-timeline-row + .wl-timeline-row { border-top: 1px solid #eef3f0; }
        .wl-timeline-date { font-size: 0.85rem; color: var(--wl-muted); }
        .wl-timeline-dot-col { display: flex; justify-content: center; }
        .wl-timeline-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: var(--wl-accent);
        }
        .wl-timeline-bar-track {
          height: 6px;
          border-radius: 3px;
          background: #eef3f0;
          overflow: hidden;
        }
        .wl-timeline-bar-fill {
          height: 100%;
          border-radius: 3px;
          background: var(--wl-accent);
        }
        .wl-empty {
          padding: 22px 0;
          color: var(--wl-muted);
          font-size: 0.92rem;
        }

        /* ---- Insights ---- */
        .wl-insight {
          display: grid;
          grid-template-columns: 3px 1fr auto;
          gap: 18px;
          align-items: start;
          padding: 16px 4px;
        }
        .wl-insight + .wl-insight { border-top: 1px solid #eef3f0; }
        .wl-insight-bar { align-self: stretch; background: var(--wl-accent); border-radius: 2px; }
        .wl-insight-meta {
          display: flex; align-items: center; gap: 10px;
          font-size: 0.78rem; color: var(--wl-muted);
          margin-bottom: 5px;
        }
        .wl-insight-category { color: var(--wl-accent); font-weight: 600; }
        .wl-insight-title {
          font-size: 1.02rem;
          font-weight: 600;
          margin: 0 0 4px;
          color: var(--wl-text);
        }
        .wl-insight-explanation {
          margin: 0;
          font-size: 0.9rem;
          line-height: 1.5;
          color: var(--wl-muted);
          max-width: 62ch;
        }
        .wl-dismiss {
          background: none;
          border: none;
          padding: 4px 2px;
          color: var(--wl-muted);
          font-size: 0.82rem;
          cursor: pointer;
          border-bottom: 1px solid transparent;
          white-space: nowrap;
        }
        .wl-dismiss:hover, .wl-dismiss:focus-visible { color: var(--wl-text); border-bottom-color: currentColor; }

        /* ---- Tasks table ---- */
        .wl-table-wrap { border: 1px solid #dbe6df; border-radius: 12px; overflow: hidden; }
        .wl-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; text-align: left; }
        .wl-table thead th {
          padding: 11px 18px;
          background: #f8faf9;
          color: var(--wl-muted);
          font-weight: 500;
          font-size: 0.82rem;
          border-bottom: 1px solid #dbe6df;
        }
        .wl-table tbody tr + tr td { border-top: 1px solid #eef3f0; }
        .wl-table td { padding: 11px 18px; }
        .wl-task-title { font-weight: 600; color: var(--wl-text); }
        .wl-task-date, .wl-task-effort { color: var(--wl-muted); }
        .wl-status { display: inline-flex; align-items: center; gap: 6px; font-size: 0.85rem; color: var(--wl-text); }
        .wl-status-dot { width: 6px; height: 6px; border-radius: 50%; background: #9aa39c; }
        .wl-status-dot.done { background: #137333; }

        button:focus-visible, a:focus-visible {
          outline: 2px solid var(--wl-accent);
          outline-offset: 2px;
        }

        @media (prefers-reduced-motion: reduce) {
          .wl-sparkline-path, .wl-gauge-ring-fg { transition: none !important; }
        }

        @media (max-width: 760px) {
          .wl-hero { grid-template-columns: 1fr; }
          .wl-hero-left { border-right: none; border-bottom: 1px solid #eef3f0; }
          .wl-timeline-row { grid-template-columns: 84px 16px 1fr; }
        }
      `}</style>

      <div className={mounted ? "wl-mounted" : ""} style={{ display: "contents" }}>
        <div className="wl-intro">
          <h1 className="wl-serif">How is your workload feeling this week?</h1>
          <p>
            This workspace is private to you. No employer rankings, no automated surveillance, and no data
            shared without your explicit grant.
          </p>
        </div>

        {!consent.personalProcessing ? (
          <div className="wl-consent-banner">
            <strong>Personal processing is disabled</strong>
            <p>
              Data entry and trend derivations are currently turned off. Go to Privacy &amp; Consent to enable
              personal processing.
            </p>
          </div>
        ) : null}

        {/* Hero: effort trend + manageability gauge, one panel, hairline divider */}
        <div className="wl-hero">
          <div className="wl-hero-left">
            <p className="wl-hero-eyebrow">Weekly logged effort</p>
            <p className="wl-hero-figure wl-serif">
              {latestTrend ? (
                <>
                  {latestTrend.effortValue}
                  <span style={{ fontSize: "1.1rem", fontWeight: 400, color: colors.muted, marginLeft: 6 }}>
                    {latestTrend.effortUnit}
                  </span>
                </>
              ) : (
                "No data yet"
              )}
            </p>
            <p className="wl-hero-sub">
              {preferences.weeklyCapacity?.value
                ? `Target capacity: ${preferences.weeklyCapacity.value} ${preferences.weeklyCapacity.unit}`
                : "No target capacity set"}
            </p>

            {sparkCoords.length > 1 ? (
              <div className="wl-sparkline-wrap">
                <svg width={sparkWidth} height={sparkHeight} viewBox={`0 0 ${sparkWidth} ${sparkHeight}`}>
                  <path className="wl-sparkline-path" d={sparklinePath} />
                </svg>
                <p className="wl-sparkline-caption">Last {sparkCoords.length} logged weeks</p>
              </div>
            ) : (
              <p className="wl-sparkline-caption">Log a few more weeks to see your trend.</p>
            )}
          </div>

          <div className="wl-hero-right">
            <div className="wl-gauge-wrap">
              <svg width="120" height="120" viewBox="0 0 120 120">
                <circle className="wl-gauge-ring-bg" cx="60" cy="60" r="54" />
                <circle
                  className="wl-gauge-ring-fg"
                  cx="60"
                  cy="60"
                  r="54"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={mounted ? CIRCUMFERENCE * (1 - manageabilityPct) : CIRCUMFERENCE}
                />
                <text x="60" y="56" textAnchor="middle" className="wl-gauge-value" fill={colors.text}>
                  {latestTrend?.meanManageability ? latestTrend.meanManageability.toFixed(1) : "–"}
                </text>
                <text x="60" y="74" textAnchor="middle" className="wl-gauge-label" fill={colors.muted}>
                  / 5
                </text>
              </svg>
              <p className="wl-gauge-caption">
                Average manageability · evidence coverage <b>{evidenceStrength}</b>
              </p>
            </div>
          </div>
        </div>

        {/* Check-ins */}
        <div className="wl-section">
          <div className="wl-section-head">
            <h2>Recent check-ins</h2>
            <button className="wl-add-checkin" onClick={() => onNavigate?.("checkins")}>
              Add check-in
            </button>
          </div>

          {checkIns.length === 0 ? (
            <p className="wl-empty">No check-ins recorded yet.</p>
          ) : (
            <div className="wl-timeline">
              {checkIns.slice(0, 5).map((ci) => (
                <div className="wl-timeline-row" key={ci.id}>
                  <span className="wl-timeline-date">{ci.checkInDate}</span>
                  <span className="wl-timeline-dot-col">
                    <span className="wl-timeline-dot" />
                  </span>
                  <span className="wl-timeline-bar-track">
                    <span
                      className="wl-timeline-bar-fill"
                      style={{ width: `${(ci.manageability / 5) * 100}%` }}
                    />
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Observations */}
        <div className="wl-section">
          <div className="wl-section-head">
            <h2>Explainable observations</h2>
          </div>
          {insights.length === 0 ? (
            <p className="wl-empty">
              No workload anomalies detected for this window. Observations are generated deterministically
              based on your logged history.
            </p>
          ) : (
            <div>
              {insights.map((ins, i) => (
                <div className="wl-insight" key={i}>
                  <div className="wl-insight-bar" />
                  <div>
                    <div className="wl-insight-meta">
                      <span className="wl-insight-category">{ins.category}</span>
                      <span>Evidence: {ins.evidenceStrength}</span>
                    </div>
                    <p className="wl-insight-title">{ins.title}</p>
                    <p className="wl-insight-explanation">{ins.explanation}</p>
                  </div>
                  <button className="wl-dismiss" onClick={() => dismissInsight(ins.title)}>
                    Dismiss
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tasks */}
        <div className="wl-section">
          <div className="wl-section-head">
            <h2>Recent tasks</h2>
          </div>
          <div className="wl-table-wrap">
            <table className="wl-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Date</th>
                  <th>Effort</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {tasks.slice(0, 5).map((task) => (
                  <tr key={task.id}>
                    <td className="wl-task-title">{task.title}</td>
                    <td className="wl-task-date">{task.workDate}</td>
                    <td className="wl-task-effort">
                      {task.effort.value} {task.effort.unit}
                    </td>
                    <td>
                      <span className="wl-status">
                        <span className={`wl-status-dot${task.status === "done" ? " done" : ""}`} />
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
    </div>
  );
};