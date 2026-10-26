import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, BrainCircuit, Info, Radar, ShieldCheck } from "lucide-react";
import { useIdentities, useIdentity, useOverview } from "../hooks/queries";
import { RiskHistoryChart } from "../components/charts";
import {
  Avatar,
  Badge,
  EmptyState,
  ErrorState,
  LoadingPanel,
  PageHeader,
  Panel,
  RiskBadge,
  RiskGauge,
  SectionHeading,
  SimulatedTag,
} from "../components/ui";
import { cn, formatDateTime, formatPercent, formatRelativeTime, riskTone, ROLE_LABELS } from "../lib/utils";

export default function BehaviorPage() {
  const overview = useOverview(24);
  const identities = useIdentities({ page: 1, page_size: 50 });
  const [selectedId, setSelectedId] = useState<string | undefined>();

  useEffect(() => {
    if (!selectedId && identities.data?.items.length) {
      setSelectedId(identities.data.items[0].id);
    }
  }, [identities.data, selectedId]);

  const detail = useIdentity(selectedId);

  if (identities.isError) {
    return (
      <>
        <PageHeader eyebrow="Anomaly center" title="Behavioral risk" />
        <ErrorState message={identities.error.message} onRetry={() => void identities.refetch()} />
      </>
    );
  }

  const items = identities.data?.items ?? [];
  const signals = detail.data?.behavioral_signals ?? [];
  const topFactors = signals[0]?.top_factors ?? [];
  const highRiskCount = items.filter((item) => item.current_risk >= 70).length;
  const criticalCount = items.filter((item) => item.current_risk >= 80).length;

  return (
    <>
      <PageHeader
        eyebrow="Anomaly center"
        title="Behavioral risk"
        description="Inspect Isolation Forest risk trajectories and the top features that drove each anomaly score. This is descriptive evidence, not a verdict."
        meta={
          <>
            <Badge tone="accent">{items.length} identities</Badge>
            <Badge tone={highRiskCount ? "high" : "low"}>{highRiskCount} at risk ≥ 70</Badge>
            {criticalCount > 0 && <Badge tone="critical">{criticalCount} critical</Badge>}
          </>
        }
        actions={
          <Link to="/model" className="btn-secondary">
            <ShieldCheck size={14} /> Model evaluation
          </Link>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="panel flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-accent/25 bg-accent/10 text-accent">
            <BrainCircuit size={17} />
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-[0.16em] text-faint">Model scored events</p>
            <p className="font-display text-lg font-semibold text-ink">
              {overview.data?.metrics.model_analyzed_events ?? "—"}
            </p>
          </div>
        </div>
        <div className="panel flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-high/25 bg-high/10 text-high">
            <Radar size={17} />
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-[0.16em] text-faint">Flagged ≥ 70</p>
            <p className="font-display text-lg font-semibold text-ink">
              {overview.data ? formatPercent(overview.data.metrics.model_anomaly_rate) : "—"}
            </p>
          </div>
        </div>
        <div className="panel flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-low/25 bg-low/10 text-low">
            <ShieldCheck size={17} />
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-[0.16em] text-faint">Policy authority</p>
            <p className="text-xs font-semibold text-ink">ML escalates, never authorizes</p>
          </div>
        </div>
      </div>

      {identities.isLoading ? (
        <LoadingPanel rows={6} label="Computing behavioral posture" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Radar size={18} />}
          title="No identities to analyze"
          description="Seed the demo directory, then evaluate access to generate signals."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
          <Panel className="overflow-hidden">
            <div className="border-b border-line/60 p-4">
              <SectionHeading eyebrow="Prioritized queue" title="Identity risk ranking" description="Current risk index, highest first." />
            </div>
            <div className="scrollbar-thin max-h-[700px] overflow-y-auto">
              {items.map((identity) => {
                const active = selectedId === identity.id;
                const category = riskTone(identity.current_risk);
                return (
                  <button
                    key={identity.id}
                    type="button"
                    onClick={() => setSelectedId(identity.id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 border-b border-line/45 px-4 py-3 text-left transition last:border-0",
                      active ? "bg-accent/[0.07]" : "hover:bg-raised/45",
                    )}
                  >
                    <Avatar name={identity.display_name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="block truncate text-xs font-semibold text-ink">{identity.display_name}</span>
                        {active && <span className="h-1 w-1 rounded-full bg-accent" />}
                      </span>
                      <span className="block truncate text-[10px] text-faint">
                        {ROLE_LABELS[identity.role]} · {identity.department}
                      </span>
                      <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-line/50">
                        <span
                          className={cn(
                            "block h-full rounded-full",
                            category === "CRITICAL" && "bg-critical",
                            category === "HIGH" && "bg-high",
                            category === "MEDIUM" && "bg-medium",
                            category === "LOW" && "bg-low",
                          )}
                          style={{ width: `${identity.current_risk}%` }}
                        />
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block font-mono text-xs text-ink">{identity.current_risk.toFixed(0)}</span>
                      <span className="text-[8px] uppercase tracking-wider text-faint">{category}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Panel>

          <div className="min-w-0 space-y-4">
            {detail.isLoading || !detail.data ? (
              <LoadingPanel rows={5} label="Reconstructing behavioral evidence" />
            ) : (
              <>
                <Panel className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <Avatar name={detail.data.display_name} size="lg" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-display text-lg font-semibold text-ink">{detail.data.display_name}</h2>
                          <RiskBadge score={detail.data.current_risk} />
                          <SimulatedTag value={detail.data.is_simulated} />
                        </div>
                        <p className="mt-1 text-[11px] text-muted">
                          {detail.data.title} · {detail.data.department} · last active{" "}
                          {formatRelativeTime(detail.data.last_activity_at)}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Link to={`/identities/${detail.data.id}`} className="btn-secondary btn-sm">
                            Full dossier <ArrowUpRight size={12} />
                          </Link>
                          <Link to={`/access?identity=${detail.data.id}`} className="btn-ghost btn-sm">
                            Access decisions
                          </Link>
                        </div>
                      </div>
                    </div>
                    <RiskGauge score={detail.data.current_risk} size={112} />
                  </div>
                </Panel>

                <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
                  <Panel className="p-4 sm:p-5">
                    <SectionHeading eyebrow="Trajectory" title="Risk history" description="Scored access attempts over the retained window." />
                    <div className="mt-3">
                      <RiskHistoryChart data={detail.data.risk_history} />
                    </div>
                  </Panel>

                  <Panel className="p-4 sm:p-5">
                    <SectionHeading
                      eyebrow="Latest explanation"
                      title={signals[0] ? `Signal ${formatDateTime(signals[0].detected_at)}` : "No signal yet"}
                      description={signals[0] ? `Model ${signals[0].model_version}` : undefined}
                    />
                    <div className="mt-3 space-y-2">
                      {topFactors.length === 0 ? (
                        <p className="rounded-lg border border-line/60 bg-raised/35 p-3 text-[11px] leading-5 text-muted">
                          No feature crossed the explanation threshold on the latest evaluation.
                        </p>
                      ) : (
                        topFactors.map((factor) => (
                          <div key={factor.feature} className="rounded-lg border border-line/60 bg-raised/35 p-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[11px] font-medium text-ink">{factor.label}</p>
                              <span className="rounded bg-line/50 px-1.5 py-0.5 font-mono text-[9px] text-muted">
                                {factor.deviation.toFixed(1)}σ
                              </span>
                            </div>
                            <p className="mt-1 text-[10px] leading-4 text-faint">{factor.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="mt-3 flex items-start gap-1.5 rounded-lg border border-accent/20 bg-accent/[0.05] p-2.5 text-[10px] leading-4 text-muted">
                      <Info size={12} className="mt-0.5 shrink-0 text-accent" />
                      Feature deviations explain the score, not causality. Identity and role controls remain authoritative.
                    </div>
                  </Panel>
                </div>

                <Panel className="overflow-hidden">
                  <div className="p-4 sm:p-5">
                    <SectionHeading
                      eyebrow="Signal log"
                      title="Recent anomaly scores"
                      description="A compact view of the latest 30 scored behavior snapshots."
                    />
                  </div>
                  {signals.length === 0 ? (
                    <EmptyState title="No signals" description="Evaluate this identity's access to generate score evidence." />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Detected</th>
                            <th>Risk</th>
                            <th>Tier</th>
                            <th className="hidden md:table-cell">Top factor</th>
                            <th className="hidden lg:table-cell">Model</th>
                            <th className="hidden sm:table-cell">Source</th>
                          </tr>
                        </thead>
                        <tbody>
                          {signals.slice(0, 10).map((signal) => (
                            <tr key={signal.id}>
                              <td className="text-[11px] text-muted">{formatDateTime(signal.detected_at)}</td>
                              <td><RiskBadge score={signal.risk_score} /></td>
                              <td><Badge tone={signal.risk_category.toLowerCase() as "low" | "medium" | "high" | "critical"}>{signal.risk_category}</Badge></td>
                              <td className="hidden text-[11px] text-muted md:table-cell">{signal.top_factors[0]?.label ?? "—"}</td>
                              <td className="hidden font-mono text-[9px] text-faint lg:table-cell">{signal.model_version}</td>
                              <td className="hidden sm:table-cell"><SimulatedTag value={signal.is_simulated} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Panel>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
