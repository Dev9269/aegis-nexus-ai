import type { ReactNode } from "react";
import { Laptop, MonitorSmartphone, ShieldAlert, ShieldCheck } from "lucide-react";
import { Avatar, Panel, RiskGauge } from "../../../components/ui";
import { cn, formatRelativeTime, riskTone } from "../../../lib/utils";
import type { IdentityDetail } from "../../../types/api";

export function PostureSummary({ detail, deniedRecent }: { detail: IdentityDetail; deniedRecent: number }) {
  const tone = riskTone(detail.current_risk);

  return (
    <Panel className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={detail.display_name} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{detail.display_name}</p>
          <p className="text-[11px] text-muted">
            {detail.title} {"\uFFFD"} {detail.department}
          </p>
          <p className="mt-0.5 text-[10px] text-faint">{detail.email}</p>
          <p className="mt-1.5 text-[10px] text-faint">
            Last activity {detail.last_activity_at ? formatRelativeTime(detail.last_activity_at) : "not recorded"}
          </p>
        </div>
        <RiskGauge score={detail.current_risk} size={118} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat
          label="Active sessions"
          value={String(detail.active_sessions)}
          icon={<MonitorSmartphone size={13} />}
        />
        <MiniStat label="Devices" value={String(detail.devices.length)} icon={<Laptop size={13} />} />
        <MiniStat
          label="Recent denials"
          value={String(deniedRecent)}
          icon={<ShieldAlert size={13} />}
          tone={deniedRecent ? "high" : "low"}
        />
        <MiniStat label="Risk tier" value={tone} icon={<ShieldCheck size={13} />} />
      </div>
    </Panel>
  );
}

function MiniStat({
  label,
  value,
  icon,
  tone = "accent",
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: "accent" | "low" | "high";
}) {
  return (
    <div className="rounded-lg border border-line/60 bg-raised/30 p-2.5">
      <div
        className={cn(
          "flex items-center gap-1.5 text-[9px] uppercase tracking-wider",
          tone === "high" ? "text-high" : tone === "low" ? "text-low" : "text-accent",
        )}
      >
        {icon}
        {label}
      </div>
      <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}
