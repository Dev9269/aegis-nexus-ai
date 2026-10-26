import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpRight,
  BadgeCheck,
  BrainCircuit,
  Database,
  KeyRound,
  Radio,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useOverview } from "../hooks/queries";
import { ActivityTimelineChart, DecisionBars, RiskDonut } from "../components/charts";
import {
  Badge,
  Button,
  DecisionBadge,
  EmptyState,
  ErrorState,
  LoadingPanel,
  PageHeader,
  Panel,
  RiskBadge,
  SectionHeading,
  SimulatedTag,
  StatCard,
} from "../components/ui";
import { RANGE_OPTIONS, RISK_ORDER } from "../lib/constants";
import {
  cn,
  compactNumber,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  ROLE_LABELS,
  titleCase,
} from "../lib/utils";

export default function OverviewPage() {
  const { me } = useAuth();
  const [range, setRange] = useState(24);
  const queryClient = useQueryClient();
  const overview = useOverview(range);

  if (overview.isError) {
    return (
      <>
        <PageHeader eyebrow="Command center" title="Security overview" />
        <ErrorState message={overview.error.message} onRetry={() => void overview.refetch()} />
      </>
    );
  }

  if (overview.isLoading || !overview.data) {
    return (
      <>
        <PageHeader eyebrow="Command center" title="Security overview" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <LoadingPanel key={index} rows={2} label="Reading posture" />
          ))}
        </div>
      </>
    );
  }

  const data = overview.data;
  const metrics = data.metrics;
  const health = data.health;
  const riskTotal = data.risk_distribution.reduce((sum, item) => sum + item.value, 0);
  const blocked = metrics.denied_requests + metrics.challenged_requests;

  return (
    <>
      <PageHeader
        eyebrow="Command center"
        title={`Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, ${me?.display_name.split(" ")[0] ?? "operator"}`}
        description="A live operating picture of identities, behavioral risk, and zero-trust enforcement. All figures originate from backend state."
        meta={
          <>
            <Badge tone="low" dot>
              {health.api === "operational" ? "API operational" : health.api}
            </Badge>
            <Badge tone={health.model === "available" ? "accent" : "high"} dot>
              Model {health.model === "available" ? "loaded" : health.model}
            </Badge>
            <span className="text-[10px] text-faint">Generated {formatRelativeTime(data.generated_at)}</span>
          </>
        }
        actions={
          <>
            <div className="flex rounded-lg border border-line/70 bg-surface/70 p-0.5">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRange(option.value)}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-[11px] font-medium transition",
                    range === option.value ? "bg-accent/15 text-accent" : "text-faint hover:text-ink",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void overview.refetch();
                void queryClient.invalidateQueries({ queryKey: ["notifications"] });
              }}
              loading={overview.isFetching}
            >
              <RefreshCw size={13} />
              Refresh
            </Button>
          </>
        }
      />

      {health.model !== "available" && (
        <div className="mb-4 rounded-xl border border-high/30 bg-high/[0.07] px-4 py-3 text-xs text-high">
          The anomaly model artifact is not available. Access evaluations requiring ML scoring will
          return a safe error until an administrator trains the model.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Access requests"
          value={formatNumber(metrics.access_requests)}
          detail={`${data.range_label.toLowerCase()} · ${formatNumber(metrics.model_analyzed_events)} model scored`}
          icon={<KeyRound size={17} />}
          tone="accent"
          trend={
            <Badge tone={blocked > 0 ? "high" : "low"} className="mb-0.5">
              {blocked} controlled
            </Badge>
          }
        />
        <StatCard
          label="Denied or challenged"
          value={formatNumber(blocked)}
          detail={`${formatNumber(metrics.denied_requests)} denied · ${formatNumber(metrics.challenged_requests)} step-up`}
          icon={<ShieldAlert size={17} />}
          tone={blocked > 0 ? "high" : "low"}
        />
        <StatCard
          label="High-risk requests"
          value={formatNumber(metrics.high_risk_requests)}
          detail={`${formatPercent(metrics.model_anomaly_rate)} of scored behavior flagged ≥ 70`}
          icon={<BrainCircuit size={17} />}
          tone={metrics.high_risk_requests > 0 ? "critical" : "low"}
        />
        <StatCard
          label="Active sessions"
          value={formatNumber(metrics.active_sessions)}
          detail={`${formatNumber(metrics.total_identities)} identities in directory`}
          icon={<Users size={17} />}
          tone="low"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.65fr_1fr]">
        <Panel className="p-4 sm:p-5">
          <SectionHeading
            eyebrow="Activity telemetry"
            title="Request and event volume"
            description={`Bucketed ${data.range_label.toLowerCase()}. Dashed line isolates high-risk access.`}
            action={<Badge tone="accent">{data.range_label}</Badge>}
          />
          <div className="mt-4">
            <ActivityTimelineChart data={data.timeline} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-faint">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Access requests
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-2" /> Security events
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-high" /> High-risk access
            </span>
          </div>
        </Panel>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <Panel className="p-4">
            <SectionHeading eyebrow="Risk distribution" title="Behavioral tiers" />
            <RiskDonut data={data.risk_distribution} />
            <div className="mt-1 grid grid-cols-2 gap-2">
              {data.risk_distribution.map((item) => (
                <div key={item.name} className="flex items-center justify-between rounded-md bg-raised/40 px-2 py-1.5">
                  <span className="flex items-center gap-1.5 text-[10px] text-muted">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        item.name === "LOW" && "bg-low",
                        item.name === "MEDIUM" && "bg-medium",
                        item.name === "HIGH" && "bg-high",
                        item.name === "CRITICAL" && "bg-critical",
                      )}
                    />
                    {titleCase(item.name)}
                  </span>
                  <span className="font-mono text-[10px] text-ink">
                    {riskTotal ? formatPercent((item.value / riskTotal) * 100, 0) : "0%"}
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="p-4">
            <SectionHeading eyebrow="Decision mix" title="Policy outcomes" />
            <DecisionBars data={data.decision_breakdown} />
          </Panel>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_1.35fr]">
        <Panel className="overflow-hidden">
          <div className="p-4 pb-3 sm:p-5 sm:pb-3">
            <SectionHeading
              eyebrow="Attention queue"
              title="Highest identity risk"
              description="Ranked by current risk index, not confidence of attack."
              action={
                <Link to="/identities" className="text-[10px] font-medium text-accent hover:underline">
                  All identities
                </Link>
              }
            />
          </div>
          {data.identity_leaderboard.length === 0 ? (
            <EmptyState title="No identities yet" description="Seed the demo directory to populate this queue." />
          ) : (
            <div className="divide-y divide-line/50">
              {data.identity_leaderboard.map((leader, index) => (
                <Link
                  key={leader.identity_id}
                  to={`/identities/${leader.identity_id}`}
                  className="group flex items-center gap-3 px-4 py-3 transition hover:bg-raised/45 sm:px-5"
                >
                  <span className="w-4 font-mono text-[10px] text-faint">{String(index + 1).padStart(2, "0")}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-ink group-hover:text-accent">
                      {leader.identity_name}
                    </p>
                    <p className="truncate text-[10px] text-faint">
                      {ROLE_LABELS[leader.role]} · {leader.anomaly_count} high-risk signals
                    </p>
                  </div>
                  <RiskBadge score={leader.risk_score} showScore={false} />
                  <span className="hidden w-20 sm:block">
                    <span className="block text-right font-mono text-xs text-ink">{leader.risk_score.toFixed(0)}</span>
                    <span className="mt-1 block h-1 overflow-hidden rounded-full bg-line/50">
                      <span
                        className={cn(
                          "block h-full rounded-full",
                          leader.risk_score >= 80
                            ? "bg-critical"
                            : leader.risk_score >= 55
                              ? "bg-high"
                              : leader.risk_score >= 30
                                ? "bg-medium"
                                : "bg-low",
                        )}
                        style={{ width: `${Math.min(100, leader.risk_score)}%` }}
                      />
                    </span>
                  </span>
                  <ArrowUpRight size={13} className="text-faint transition group-hover:text-accent" />
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="overflow-hidden">
          <div className="p-4 pb-3 sm:p-5 sm:pb-3">
            <SectionHeading
              eyebrow="Live confidence"
              title="Recent security events"
              description="Newest events from the append-only event store."
              action={
                <Link to="/events" className="text-[10px] font-medium text-accent hover:underline">
                  Open timeline
                </Link>
              }
            />
          </div>
          {data.recent_events.length === 0 ? (
            <EmptyState title="No events recorded" description="Authentication and access activity will appear here." />
          ) : (
            <div className="divide-y divide-line/50">
              {data.recent_events.map((event) => (
                <Link
                  key={event.id}
                  to={`/events?event=${event.id}`}
                  className="group flex items-start gap-2.5 px-4 py-3 transition hover:bg-raised/45 sm:px-5"
                >
                  <span
                    className={cn(
                      "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                      event.severity === "CRITICAL" && "bg-critical",
                      event.severity === "HIGH" && "bg-high",
                      event.severity === "MEDIUM" && "bg-medium",
                      event.severity === "LOW" && "bg-low",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium text-ink group-hover:text-accent">
                      {event.summary}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[9px] text-faint">
                      <span>{event.event_type}</span>
                      <span>·</span>
                      <span>{event.category}</span>
                      <span>·</span>
                      <span>{formatRelativeTime(event.timestamp)}</span>
                      <SimulatedTag value={event.is_simulated} />
                    </p>
                  </div>
                  <Badge tone={event.severity.toLowerCase() as "low" | "medium" | "high" | "critical"}>
                    {event.severity}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel className="mt-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="eyebrow mb-1">Trust mesh health</p>
            <p className="text-xs text-muted">
              Model <span className="font-mono text-ink">{metrics.model_version}</span> · checked{" "}
              {formatRelativeTime(health.checked_at)}
            </p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-4">
            <HealthCell icon={<Radio size={13} />} label="Event stream" value={health.event_stream} tone={health.event_stream === "connected" ? "low" : "medium"} />
            <HealthCell icon={<Database size={13} />} label="Database" value={health.database} tone={health.database === "connected" ? "low" : "critical"} />
            <HealthCell icon={<BrainCircuit size={13} />} label="Model" value={health.model} tone={health.model === "available" ? "low" : "high"} />
            <HealthCell icon={<Activity size={13} />} label="Stream clients" value={String(health.stream_clients)} tone="accent" />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line/50 pt-3 text-[9px] uppercase tracking-wider text-faint">
          <BadgeCheck size={12} className="text-accent" />
          {formatNumber(metrics.demo_events)} simulated · {formatNumber(metrics.real_events)} live-auth events in range
          <span className="text-line">|</span>
          <ShieldCheck size={12} className="text-low" /> policy engine authoritative
        </div>
      </Panel>
    </>
  );
}

function HealthCell({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: "low" | "medium" | "high" | "critical" | "accent";
}) {
  const tones = {
    low: "text-low",
    medium: "text-medium",
    high: "text-high",
    critical: "text-critical",
    accent: "text-accent",
  };
  return (
    <div className="rounded-lg border border-line/60 bg-raised/40 px-2.5 py-2">
      <p className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-faint">
        {icon}
        {label}
      </p>
      <p className={cn("mt-1 text-[11px] font-medium capitalize", tones[tone])}>{value}</p>
    </div>
  );
}
