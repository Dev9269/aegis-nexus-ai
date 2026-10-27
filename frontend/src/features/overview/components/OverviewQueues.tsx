import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { Badge, EmptyState, Panel, RiskBadge, SectionHeading, SimulatedTag } from "../../../components/ui";
import { cn, formatRelativeTime, ROLE_LABELS } from "../../../lib/utils";
import type { Overview } from "../../../types/api";

export function OverviewQueues({ data }: { data: Overview }) {
  return (
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
                    {ROLE_LABELS[leader.role]} {"\uFFFD"} {leader.anomaly_count} high-risk signals
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
                    <span>{"\uFFFD"}</span>
                    <span>{event.category}</span>
                    <span>{"\uFFFD"}</span>
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
  );
}
