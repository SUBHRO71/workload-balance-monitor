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

// ---- Presentation-only helpers (no data fetching, no backend contact) ----
type CSSVars = React.CSSProperties & { [key: `--${string}`]: string | number };
const RING_CIRCUMFERENCE = 2 * Math.PI * 42;

// A single semantic health palette reused everywhere a value needs a
// good/warning/bad read — all three colors already exist elsewhere in this
// file's badges, just centralized so ring, bars, dots and chips agree.
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
  done: HEALTH.good,
  in_progress: { fg: "#1a73e8", bg: "#e8f0fe" },
  open: HEALTH.warn,
  shared: { fg: "#5f6368", bg: "#eef0ef" },
  blocked: HEALTH.bad,
  at_risk: HEALTH.bad,
};

function initialsFor(name: string): string {
  const parts = name.replace(/[^a-zA-Z0-9 ]/g, "").split(" ").filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

// Animates a number counting up on mount / whenever the target changes —
// purely cosmetic, reads no data that isn't already in state.
const CountUp: React.FC<{ value: number; decimals?: number; suffix?: string }> = ({ value, decimals = 0, suffix = "" }) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const duration = 650;
    const from = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (value - from) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{display.toFixed(decimals)}{suffix}</>;
};

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

  // ---- Purely derived, display-only values — no new data sources ----
  const maxWeeklyEffort = useMemo(() => {
    const values = teamAggregates.flatMap((t) => t.metrics?.filter((m) => m.key === "meanWeeklyEffort").map((m) => m.value) ?? []);
    return values.length ? Math.max(...values) : 0;
  }, [teamAggregates]);

  // Sorted, worst-first health overview across every already-loaded team.
  const teamHealthRows = useMemo(() => {
    return teamAggregates
      .map((t) => ({ team: t, manageability: t.metrics?.find((m) => m.key === "meanManageability")?.value }))
      .filter((row): row is { team: MockTeamAggregate; manageability: number } => row.team.state === "available" && row.manageability !== undefined)
      .sort((a, b) => a.manageability - b.manageability);
  }, [teamAggregates]);

  const disclosedCount = teamAggregates.filter((t) => t.state === "available").length;

  const now = Date.now();
  const isOverdue = (a: HumanActionRecord) => a.status === "open" && !!a.followUpAt && new Date(a.followUpAt).getTime() < now;
  const overdueCount = actions.filter(isOverdue).length;
  const openActionCount = actions.filter((a) => a.status === "open").length;
  const resolvedCount = actions.filter((a) => a.status === "resolved").length;
  const inProgressCount = actions.filter((a) => a.status === "in_progress").length;
  const actionTotal = actions.length || 1;

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), 60);
    return () => window.clearTimeout(t);
  }, []);

  const pageVars: CSSVars = {
    "--mp-accent": colors.accent,
    "--mp-text": colors.text,
    "--mp-muted": colors.muted,
    "--mp-surface": colors.surface,
  };

  const manageabilityMetric = selectedTeam.metrics?.find((m) => m.key === "meanManageability");
  const effortMetric = selectedTeam.metrics?.find((m) => m.key === "meanWeeklyEffort");
  const manageabilityPct = manageabilityMetric ? Math.min(1, manageabilityMetric.value / 5) : 0;
  const effortPct = effortMetric && maxWeeklyEffort ? Math.min(1, effortMetric.value / maxWeeklyEffort) : 0;
  const health = manageabilityMetric ? manageabilityHealth(manageabilityMetric.value) : undefined;

  return (
    <div className={`mp-root${mounted ? " mp-mounted" : ""}`} style={pageVars}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=Inter:wght@400;500;600;700&display=swap');

        .mp-root { font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif; color: var(--mp-text); }
        .mp-root * { box-sizing: border-box; }
        .mp-serif { font-family: "Newsreader", Georgia, serif; }

        .mp-head { margin-bottom: 22px; }
        .mp-head-row { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
        .mp-head-row h1 { margin: 0; font-size: 1.75rem; font-weight: 500; color: var(--mp-text); }
        .mp-role-badge {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 3px 10px; border-radius: 20px;
          background: #e8f0fe; color: #1a73e8;
          font-size: 0.72rem; font-weight: 600;
        }
        .mp-role-badge::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: #1a73e8; }
        .mp-head p { margin: 0; color: var(--mp-muted); font-size: 0.94rem; max-width: 70ch; line-height: 1.5; }

        /* Quick stat strip */
        .mp-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1px; background: #dbe6df; border: 1px solid #dbe6df; border-radius: 12px; overflow: hidden; margin-bottom: 22px; }
        .mp-stat { background: var(--mp-surface); padding: 14px 18px; transition: background 0.2s ease; }
        .mp-stat:hover { background: #f8faf9; }
        .mp-stat-label { font-size: 0.76rem; color: var(--mp-muted); margin-bottom: 4px; }
        .mp-stat-value { font-size: 1.5rem; font-weight: 600; font-family: "Newsreader", Georgia, serif; }
        .mp-stat-value.mp-stat-bad { color: #b3261e; }
        .mp-stat-value.mp-stat-good { color: #137333; }
        .mp-stat-flag { font-size: 0.72rem; font-weight: 600; color: #b3261e; margin-top: 2px; display: flex; align-items: center; gap: 4px; }
        .mp-stat-flag .mp-pulse-dot { width: 6px; height: 6px; border-radius: 50%; background: #b3261e; animation: mpPulse 1.6s ease-in-out infinite; }

        @keyframes mpPulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.4); } }
        @media (prefers-reduced-motion: reduce) { .mp-pulse-dot { animation: none; } }

        .mp-notice {
          background: #fef7e0; border: 1px solid #f9ab00; border-radius: 10px;
          padding: 13px 18px; display: flex; align-items: flex-start; gap: 12px;
          font-size: 0.86rem; color: #7a4100; margin-bottom: 26px;
        }
        .mp-notice svg { flex-shrink: 0; margin-top: 1px; }

        .mp-tabs { display: flex; gap: 4px; border-bottom: 1px solid #dbe6df; margin-bottom: 22px; }
        .mp-tab {
          position: relative; background: none; border: none; cursor: pointer;
          padding: 10px 6px; margin-right: 22px;
          font-size: 0.9rem; font-weight: 500; color: var(--mp-muted);
          display: flex; align-items: center; gap: 8px;
          transition: color 0.15s ease;
        }
        .mp-tab-count {
          font-size: 0.72rem; color: var(--mp-muted); background: #eef3f0;
          border-radius: 10px; padding: 1px 7px; font-weight: 600;
        }
        .mp-tab--active { color: var(--mp-text); font-weight: 600; }
        .mp-tab--active .mp-tab-count { background: var(--mp-accent); color: #fff; }
        .mp-tab::after {
          content: ""; position: absolute; left: 0; right: 22px; bottom: -1px; height: 2px;
          background: var(--mp-accent); transform: scaleX(0); transition: transform 0.18s ease;
        }
        .mp-tab--active::after { transform: scaleX(1); }
        .mp-tab:focus-visible { outline: 2px solid var(--mp-accent); outline-offset: 2px; border-radius: 4px; }

        .mp-fade-in { animation: mpFadeIn 0.32s ease both; }
        @keyframes mpFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .mp-fade-in { animation: none; } }

        .mp-team-chips { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 18px; }
        .mp-team-chips-label { font-size: 0.82rem; color: var(--mp-muted); margin-right: 2px; }
        .mp-team-chip {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 6px 14px; border-radius: 20px; border: 1px solid #dbe6df;
          background: var(--mp-surface); color: var(--mp-text); font-size: 0.84rem;
          cursor: pointer; transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
        }
        .mp-team-chip:hover { border-color: #c8d8cf; transform: translateY(-1px); }
        .mp-team-chip--active { background: var(--mp-text); color: #fff; border-color: var(--mp-text); font-weight: 600; }
        .mp-chip-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

        .mp-panel { background: var(--mp-surface); border: 1px solid #dbe6df; border-radius: 14px; padding: 24px; transition: box-shadow 0.2s ease; }
        .mp-panel:hover { box-shadow: 0 4px 18px rgba(20, 40, 30, 0.05); }
        .mp-panel + .mp-panel { margin-top: 16px; }
        .mp-panel-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; flex-wrap: wrap; margin-bottom: 18px; }
        .mp-panel-title { font-size: 1.12rem; font-weight: 600; color: var(--mp-text); margin: 0 0 4px; }
        .mp-panel-sub { font-size: 0.84rem; color: var(--mp-muted); }

        .mp-pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 11px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; white-space: nowrap; }
        .mp-pill--available { background: #e6f4ea; color: #137333; }
        .mp-pill--suppressed { background: #fef7e0; color: #b06000; }
        .mp-pill--active { background: #e6f4ea; color: #137333; }
        .mp-pill--error { background: #fce8e6; color: #b3261e; }

        /* Team health overview bars — worst-first, real values */
        .mp-health-list { display: flex; flex-direction: column; gap: 10px; }
        .mp-health-row { display: grid; grid-template-columns: 130px 1fr 46px; align-items: center; gap: 12px; cursor: pointer; padding: 4px; border-radius: 8px; transition: background 0.15s ease; }
        .mp-health-row:hover { background: #f8faf9; }
        .mp-health-name { font-size: 0.87rem; font-weight: 500; color: var(--mp-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .mp-health-track { height: 8px; border-radius: 4px; background: #eef3f0; overflow: hidden; }
        .mp-health-fill { height: 100%; border-radius: 4px; width: 0%; transition: width 1s cubic-bezier(0.2,0.6,0.2,1); }
        .mp-mounted .mp-health-fill { width: var(--fill, 0%); }
        .mp-health-value { font-size: 0.85rem; font-weight: 600; text-align: right; }

        .mp-metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
        .mp-metric-card { border-radius: 12px; padding: 18px; display: flex; align-items: center; gap: 16px; border: 1px solid #eef3f0; transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .mp-metric-card:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(20,40,30,0.06); }
        .mp-metric-text-label { font-size: 0.82rem; color: var(--mp-muted); margin-bottom: 4px; }
        .mp-metric-value { font-size: 1.55rem; font-weight: 500; }
        .mp-metric-band { font-size: 0.74rem; color: var(--mp-muted); margin-top: 6px; }
        .mp-metric-band b { color: var(--mp-text); font-weight: 600; }
        .mp-metric-bar-track { height: 6px; border-radius: 3px; background: #eef3f0; overflow: hidden; margin-top: 8px; width: 100%; }
        .mp-metric-bar-fill { height: 100%; border-radius: 3px; background: var(--mp-accent); width: 0%; transition: width 1s cubic-bezier(0.2,0.6,0.2,1); }
        .mp-mounted .mp-metric-bar-fill { width: var(--fill, 0%); }

        .mp-ring-bg { fill: none; stroke: #eef3f0; stroke-width: 7; }

        .mp-suppressed-box { background: #fef7e0; border: 1px solid #feefc3; border-radius: 10px; padding: 16px 18px; color: #7a4100; font-size: 0.9rem; display: flex; gap: 10px; align-items: flex-start; }

        .mp-pub-card { border-top: 1px solid #eef3f0; padding: 20px 0; transition: background 0.15s ease; border-radius: 8px; }
        .mp-pub-card:hover { background: #fafcfb; }
        .mp-pub-card:first-child { border-top: none; padding-top: 0; }
        .mp-pub-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; flex-wrap: wrap; margin-bottom: 14px; }
        .mp-pub-owner { display: flex; align-items: center; gap: 12px; }
        .mp-avatar { width: 36px; height: 36px; border-radius: 50%; background: var(--mp-text); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.78rem; font-weight: 600; flex-shrink: 0; }
        .mp-pub-owner-name { font-size: 1.02rem; font-weight: 600; color: var(--mp-text); display: block; }
        .mp-pub-owner-sub { font-size: 0.8rem; color: var(--mp-muted); }

        .mp-item-list-label { font-size: 0.78rem; font-weight: 600; color: var(--mp-muted); margin-bottom: 8px; }
        .mp-item-row { display: flex; justify-content: space-between; align-items: center; padding: 9px 8px; border-radius: 6px; transition: background 0.15s ease; }
        .mp-item-row:hover { background: #f2f6f4; }
        .mp-item-row + .mp-item-row { border-top: 1px solid #f2f6f4; }
        .mp-item-title { color: var(--mp-text); font-weight: 500; }
        .mp-item-date { color: var(--mp-muted); font-size: 0.8rem; margin-left: 10px; }
        .mp-item-effort { font-size: 0.85rem; color: var(--mp-accent); font-weight: 600; margin-right: 12px; }
        .mp-status-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; margin-right: 6px; }

        /* Decision status breakdown bar */
        .mp-breakdown-bar { display: flex; height: 10px; border-radius: 5px; overflow: hidden; background: #eef3f0; }
        .mp-breakdown-seg { height: 100%; width: 0%; transition: width 0.9s cubic-bezier(0.2,0.6,0.2,1); }
        .mp-mounted .mp-breakdown-seg { width: var(--seg, 0%); }
        .mp-breakdown-legend { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 10px; font-size: 0.78rem; color: var(--mp-muted); }
        .mp-breakdown-legend span { display: inline-flex; align-items: center; gap: 6px; }
        .mp-legend-dot { width: 8px; height: 8px; border-radius: 50%; }

        .mp-field { display: flex; flex-direction: column; gap: 5px; }
        .mp-field label { font-size: 0.83rem; color: var(--mp-muted); }
        .mp-field textarea, .mp-field input[type="date"] {
          font-family: inherit; font-size: 0.9rem; padding: 10px 12px;
          border-radius: 8px; border: 1px solid #cedcd3; background: #fff; color: var(--mp-text);
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .mp-field textarea:focus, .mp-field input:focus { outline: none; border-color: var(--mp-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--mp-accent) 15%, transparent); }

        .mp-submit {
          padding: 10px 22px; border-radius: 8px; border: none;
          background: var(--mp-accent); color: #fff; font-weight: 600; font-size: 0.9rem;
          cursor: pointer; transition: opacity 0.15s ease, transform 0.15s ease;
        }
        .mp-submit:disabled { opacity: 0.5; cursor: not-allowed; }
        .mp-submit:not(:disabled):hover { opacity: 0.92; transform: translateY(-1px); }

        .mp-action-card { padding: 16px 18px; border-radius: 10px; border-left: 3px solid #e5ede8; background: #fafcfb; border-top: 1px solid #e5ede8; border-right: 1px solid #e5ede8; border-bottom: 1px solid #e5ede8; transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .mp-action-card:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(20,40,30,0.05); }
        .mp-action-card + .mp-action-card { margin-top: 10px; }
        .mp-action-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
        .mp-action-author { color: var(--mp-text); font-size: 0.94rem; font-weight: 600; }
        .mp-action-team { color: var(--mp-muted); font-size: 0.83rem; margin-left: 8px; }
        .mp-action-rationale { margin: 8px 0 0; color: var(--mp-text); font-size: 0.9rem; line-height: 1.5; }
        .mp-action-meta { display: flex; justify-content: space-between; color: var(--mp-muted); font-size: 0.78rem; margin-top: 8px; }
        .mp-action-meta .mp-overdue { color: #b3261e; font-weight: 600; }

        .mp-empty { color: var(--mp-muted); font-size: 0.9rem; padding: 6px 0; }

        @media (max-width: 640px) {
          .mp-panel { padding: 18px; }
          .mp-metric-card { flex-direction: column; align-items: flex-start; }
          .mp-health-row { grid-template-columns: 90px 1fr 40px; }
        }
      `}</style>

      <div className="mp-head">
        <div className="mp-head-row">
          <h1 className="mp-serif">Manager workspace</h1>
          <span className="mp-role-badge">Manager role</span>
        </div>
        <p>
          Assigned-team aggregate releases and view-only direct report publications. No employee ranking, no
          individual surveillance, and no access to unshared private workspaces.
        </p>
      </div>

      <div className="mp-stats">
        <div className="mp-stat">
          <div className="mp-stat-label">Assigned teams</div>
          <div className="mp-stat-value"><CountUp value={teamAggregates.length} /></div>
        </div>
        <div className="mp-stat">
          <div className="mp-stat-label">Disclosed releases</div>
          <div className={`mp-stat-value${teamAggregates.length > 0 && disclosedCount === 0 ? " mp-stat-bad" : ""}`}>
            <CountUp value={disclosedCount} />
          </div>
        </div>
        <div className="mp-stat">
          <div className="mp-stat-label">Active publications</div>
          <div className="mp-stat-value"><CountUp value={publications.length} /></div>
        </div>
        <div className="mp-stat">
          <div className="mp-stat-label">Open decisions</div>
          <div className={`mp-stat-value${overdueCount > 0 ? " mp-stat-bad" : openActionCount === 0 ? " mp-stat-good" : ""}`}>
            <CountUp value={openActionCount} />
          </div>
          {overdueCount > 0 && (
            <div className="mp-stat-flag">
              <span className="mp-pulse-dot" />
              {overdueCount} overdue
            </div>
          )}
        </div>
      </div>

      <div className="mp-notice">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="#7a4100" strokeWidth="1.6" />
          <path d="M12 11v5.5" stroke="#7a4100" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="12" cy="7.6" r="1" fill="#7a4100" />
        </svg>
        <div>
          <strong>Privacy boundary enforced.</strong> Manager Lambda functions are strictly IAM-denied from reading
          employee <code>PRIVATE#</code> partitions. Team aggregates require ≥5 consenting contributors; publications
          require explicit user confirmation.
        </div>
      </div>

      <div className="mp-tabs">
        <button className={`mp-tab${activeTab === "aggregates" ? " mp-tab--active" : ""}`} onClick={() => setActiveTab("aggregates")}>
          Team aggregates <span className="mp-tab-count">{teamAggregates.length}</span>
        </button>
        <button className={`mp-tab${activeTab === "shares" ? " mp-tab--active" : ""}`} onClick={() => setActiveTab("shares")}>
          Shared publications <span className="mp-tab-count">{publications.length}</span>
        </button>
        <button className={`mp-tab${activeTab === "actions" ? " mp-tab--active" : ""}`} onClick={() => setActiveTab("actions")}>
          Human decisions <span className="mp-tab-count">{actions.length}</span>
        </button>
      </div>

      {/* Team Aggregates Tab */}
      {activeTab === "aggregates" && (
        <section key="aggregates" className="mp-fade-in">
          {aggregatesLoading && <p className="mp-empty">Loading team aggregates…</p>}

          {!aggregatesLoading && teamAggregates.length === 0 && (
            <div className="mp-suppressed-box">
              No assigned teams found for your account. Contact an administrator to assign you to a team.
            </div>
          )}

          {!aggregatesLoading && teamAggregates.length > 0 && (
            <>
              {teamHealthRows.length > 1 && (
                <div className="mp-panel" style={{ marginBottom: 16 }}>
                  <div className="mp-panel-head" style={{ marginBottom: 14 }}>
                    <div>
                      <p className="mp-panel-title">Team health at a glance</p>
                      <span className="mp-panel-sub">Mean manageability across disclosed teams, lowest first</span>
                    </div>
                  </div>
                  <div className="mp-health-list">
                    {teamHealthRows.map(({ team, manageability }) => {
                      const h = manageabilityHealth(manageability);
                      return (
                        <div className="mp-health-row" key={team.teamId} onClick={() => setSelectedTeamId(team.teamId)}>
                          <span className="mp-health-name">{team.teamName}</span>
                          <span className="mp-health-track">
                            <span className="mp-health-fill" style={{ background: h.fg, "--fill": `${(manageability / 5) * 100}%` } as CSSVars} />
                          </span>
                          <span className="mp-health-value" style={{ color: h.fg }}>{manageability.toFixed(1)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mp-team-chips">
                <span className="mp-team-chips-label">Team</span>
                {teamAggregates.map((t) => {
                  const m = t.metrics?.find((mm) => mm.key === "meanManageability")?.value;
                  const dotColor = t.state !== "available" ? "#c8d0cb" : m !== undefined ? manageabilityHealth(m).fg : "#c8d0cb";
                  return (
                    <button
                      key={t.teamId}
                      className={`mp-team-chip${selectedTeamId === t.teamId ? " mp-team-chip--active" : ""}`}
                      onClick={() => setSelectedTeamId(t.teamId)}
                    >
                      <span className="mp-chip-dot" style={{ background: selectedTeamId === t.teamId ? "#fff" : dotColor }} />
                      {t.teamName}
                    </button>
                  );
                })}
              </div>

              <div className="mp-panel">
                <div className="mp-panel-head">
                  <div>
                    <p className="mp-panel-title">{selectedTeam.teamName} — weekly aggregate release</p>
                    <span className="mp-panel-sub">
                      Window: {selectedTeam.range.startDate} to {selectedTeam.range.endDate} · Evidence: {selectedTeam.evidenceStrength}
                    </span>
                  </div>
                  <span className={`mp-pill mp-pill--${selectedTeam.state === "available" ? "available" : "suppressed"}`}>
                    {selectedTeam.state === "available" ? "Disclosed · ≥5 contributors" : "Suppressed · <5 contributors"}
                  </span>
                </div>

                {selectedTeam.state === "available" && selectedTeam.metrics && (
                  <div className="mp-metric-grid">
                    {effortMetric && (
                      <div className="mp-metric-card" style={{ background: "#f9fbfa" }}>
                        <div style={{ flex: 1 }}>
                          <div className="mp-metric-text-label">Mean weekly effort</div>
                          <div className="mp-metric-value mp-serif">{effortMetric.value} hrs</div>
                          <div className="mp-metric-bar-track">
                            <div className="mp-metric-bar-fill" style={{ "--fill": `${effortPct * 100}%` } as CSSVars} />
                          </div>
                          <div className="mp-metric-band">Relative to peak across your teams · Cohort: <b>{effortMetric.contributorCountBand}</b></div>
                        </div>
                      </div>
                    )}
                    {manageabilityMetric && health && (
                      <div className="mp-metric-card" style={{ background: health.bg }}>
                        <svg width="72" height="72" viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
                          <circle className="mp-ring-bg" cx="50" cy="50" r="42" />
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
                          <text x="50" y="55" textAnchor="middle" fontSize="18" fontWeight={600} fill={health.fg}>
                            {manageabilityMetric.value}
                          </text>
                        </svg>
                        <div>
                          <div className="mp-metric-text-label">Mean manageability</div>
                          <div className="mp-metric-value mp-serif" style={{ color: health.fg }}>
                            {manageabilityMetric.value} / 5 · {health.key === "good" ? "Healthy" : health.key === "warn" ? "Watch" : "At risk"}
                          </div>
                          <div className="mp-metric-band">Cohort: <b>{manageabilityMetric.contributorCountBand} members</b></div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {selectedTeam.state !== "available" && (
                  <div className="mp-suppressed-box">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ marginTop: 2, flexShrink: 0 }}>
                      <rect x="5" y="10" width="14" height="10" rx="2" stroke="#7a4100" strokeWidth="1.6" />
                      <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="#7a4100" strokeWidth="1.6" />
                    </svg>
                    <div><strong>Protected release suppressed.</strong> {selectedTeam.reason}</div>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {/* Shared Publications Tab */}
      {activeTab === "shares" && (
        <section key="shares" className="mp-fade-in">
          <div className="mp-panel">
            <div className="mp-panel-head">
              <p className="mp-panel-title">Active direct report publications ({publications.length})</p>
            </div>

            {shareError && <div role="alert" className="mp-pill mp-pill--error" style={{ marginBottom: 14 }}>{shareError}</div>}
            {!shareError && publications.length === 0 && (
              <p className="mp-empty">No member has explicitly published a workload snapshot to you.</p>
            )}

            {publications.map((pub) => (
              <div key={pub.grantId} className="mp-pub-card">
                <div className="mp-pub-header">
                  <div className="mp-pub-owner">
                    <span className="mp-avatar">{initialsFor(pub.ownerDisplayName)}</span>
                    <div>
                      <strong className="mp-pub-owner-name">{pub.ownerDisplayName}</strong>
                      <span className="mp-pub-owner-sub">
                        Grant {pub.grantId} · {pub.range.from} to {pub.range.to}
                      </span>
                    </div>
                  </div>
                  <span className="mp-pill mp-pill--active">Active · expires {pub.expiresAt}</span>
                </div>

                <div className="mp-item-list-label">User-approved workload items</div>
                <div>
                  {pub.items.map((item, idx) => {
                    const meta = STATUS_META[item.status] ?? { fg: "#5f6368", bg: "#eef0ef" };
                    return (
                      <div className="mp-item-row" key={idx}>
                        <div>
                          <span className="mp-item-title">{item.title}</span>
                          <span className="mp-item-date">{item.date}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <span className="mp-item-effort">{item.effort}</span>
                          <span style={{ fontSize: "0.83rem", color: meta.fg, fontWeight: 600 }}>
                            <span className="mp-status-dot" style={{ background: meta.fg }} />
                            {item.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Human Actions Tab */}
      {activeTab === "actions" && (
        <section key="actions" className="mp-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {actions.length > 0 && (
            <div className="mp-panel">
              <p className="mp-panel-title">Decision status breakdown</p>
              <span className="mp-panel-sub" style={{ display: "block", marginBottom: 14 }}>
                {actions.length} recorded decision{actions.length === 1 ? "" : "s"} for this team
              </span>
              <div className="mp-breakdown-bar">
                {resolvedCount > 0 && <span className="mp-breakdown-seg" style={{ background: HEALTH.good.fg, "--seg": `${(resolvedCount / actionTotal) * 100}%` } as CSSVars} />}
                {inProgressCount > 0 && <span className="mp-breakdown-seg" style={{ background: "#1a73e8", "--seg": `${(inProgressCount / actionTotal) * 100}%` } as CSSVars} />}
                {openActionCount - overdueCount > 0 && <span className="mp-breakdown-seg" style={{ background: HEALTH.warn.fg, "--seg": `${((openActionCount - overdueCount) / actionTotal) * 100}%` } as CSSVars} />}
                {overdueCount > 0 && <span className="mp-breakdown-seg" style={{ background: HEALTH.bad.fg, "--seg": `${(overdueCount / actionTotal) * 100}%` } as CSSVars} />}
              </div>
              <div className="mp-breakdown-legend">
                <span><span className="mp-legend-dot" style={{ background: HEALTH.good.fg }} />Resolved · {resolvedCount}</span>
                <span><span className="mp-legend-dot" style={{ background: "#1a73e8" }} />In progress · {inProgressCount}</span>
                <span><span className="mp-legend-dot" style={{ background: HEALTH.warn.fg }} />Open · {openActionCount - overdueCount}</span>
                {overdueCount > 0 && <span><span className="mp-legend-dot" style={{ background: HEALTH.bad.fg }} />Overdue · {overdueCount}</span>}
              </div>
            </div>
          )}

          <div className="mp-panel">
            <p className="mp-panel-title">Record team workload decision</p>
            <p className="mp-panel-sub" style={{ marginBottom: 16, display: "block" }}>
              Document manager actions and follow-up plans. Action records reference authorized releases without
              copying private text or shared field values.
            </p>

            <form onSubmit={(event) => void recordAction(event)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="mp-field">
                <label>Human rationale &amp; action plan</label>
                <textarea
                  rows={3}
                  value={newActionRationale}
                  onChange={(e) => setNewActionRationale(e.target.value)}
                  placeholder="Explain the workload context and agreed adjustments (e.g. reprioritizing roadmap tasks, adjusting sprint velocity, schedule recovery)..."
                  required
                />
              </div>

              <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div className="mp-field" style={{ width: 180 }}>
                  <label>Follow-up date (optional)</label>
                  <input type="date" value={newActionFollowUp} onChange={(e) => setNewActionFollowUp(e.target.value)} />
                </div>
                <button type="submit" className="mp-submit" disabled={!selectedTeamId}>
                  Record action
                </button>
              </div>
            </form>
          </div>

          <div className="mp-panel">
            <p className="mp-panel-title">Decision history ({actions.length})</p>
            {actions.length === 0 && <p className="mp-empty">No decisions recorded yet.</p>}
            {actions.map((act) => {
              const overdue = isOverdue(act);
              const meta = overdue ? HEALTH.bad : (STATUS_META[act.status] ?? { fg: "#5f6368", bg: "#eef0ef" });
              return (
                <div className="mp-action-card" style={{ borderLeftColor: meta.fg }} key={act.id}>
                  <div className="mp-action-head">
                    <div>
                      <span className="mp-action-author">{act.authorName}</span>
                      <span className="mp-action-team">Team: {act.teamId ?? "All"}</span>
                    </div>
                    <span style={{ fontSize: "0.83rem", color: meta.fg, display: "flex", alignItems: "center", fontWeight: 600 }}>
                      <span className="mp-status-dot" style={{ background: meta.fg }} />
                      {overdue ? "Overdue" : act.status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="mp-action-rationale">{act.rationale}</p>
                  <div className="mp-action-meta">
                    <span>Recorded: {new Date(act.createdAt).toLocaleDateString()}</span>
                    {act.followUpAt && <span className={overdue ? "mp-overdue" : ""}>Follow-up: {act.followUpAt}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};