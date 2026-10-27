import { BrainCircuit, KeyRound, ShieldAlert, Users } from "lucide-react";
import { Badge, StatCard } from "../../../components/ui";
import { formatNumber, formatPercent } from "../../../lib/utils";
import type { Overview } from "../../../types/api";

export function MetricGrid({ data, blocked }: { data: Overview; blocked: number }) {
  const metrics = data.metrics;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Access requests"
        value={formatNumber(metrics.access_requests)}
        detail={`${data.range_label.toLowerCase()} \uFFFD ${formatNumber(metrics.model_analyzed_events)} model scored`}
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
        detail={`${formatNumber(metrics.denied_requests)} denied \uFFFD ${formatNumber(metrics.challenged_requests)} step-up`}
        icon={<ShieldAlert size={17} />}
        tone={blocked > 0 ? "high" : "low"}
      />
      <StatCard
        label="High-risk requests"
        value={formatNumber(metrics.high_risk_requests)}
        detail={`${formatPercent(metrics.model_anomaly_rate)} of scored behavior flagged \u2265 70`}
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
  );
}
