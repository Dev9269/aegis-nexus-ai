import type { ReactNode } from "react";
import { Activity, BadgeCheck, BrainCircuit, Database, Radio, ShieldCheck } from "lucide-react";
import { Badge, Panel } from "../../../components/ui";
import { cn, formatNumber, formatRelativeTime } from "../../../lib/utils";
import type { Overview } from "../../../types/api";

export function TrustMesh({ data }: { data: Overview }) {
  const metrics = data.metrics;
  const health = data.health;

  return (
    <Panel className="mt-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow mb-1">Trust mesh health</p>
          <p className="text-xs text-muted">
            Model <span className="font-mono text-ink">{metrics.model_version}</span> {"\uFFFD"} checked{" "}
            {formatRelativeTime(health.checked_at)}
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-4">
          <HealthCell
            icon={<Radio size={13} />}
            label="Event stream"
            value={health.event_stream}
            tone={health.event_stream === "connected" ? "low" : "medium"}
          />
          <HealthCell
            icon={<Database size={13} />}
            label="Database"
            value={health.database}
            tone={health.database === "connected" ? "low" : "critical"}
          />
          <HealthCell
            icon={<BrainCircuit size={13} />}
            label="Model"
            value={health.model}
            tone={health.model === "available" ? "low" : "high"}
          />
          <HealthCell
            icon={<Activity size={13} />}
            label="Stream clients"
            value={String(health.stream_clients)}
            tone="accent"
          />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line/50 pt-3 text-[9px] uppercase tracking-wider text-faint">
        <BadgeCheck size={12} className="text-accent" />
        {formatNumber(metrics.demo_events)} simulated {"\uFFFD"} {formatNumber(metrics.real_events)} live-auth events in
        range
        <span className="text-line">|</span>
        <ShieldCheck size={12} className="text-low" /> policy engine authoritative
      </div>
    </Panel>
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
