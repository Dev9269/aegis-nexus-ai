import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { Activity, Cpu, Database, Server } from "lucide-react";
import { Badge, ErrorState, Panel, SectionHeading } from "../../../components/ui";
import { cn, formatDateTime, titleCase } from "../../../lib/utils";
import type { HealthStatus } from "../../../types/api";

export function ServiceHealthPanel({ health }: { health: UseQueryResult<HealthStatus, Error> }) {
  return (
    <Panel className="p-4 sm:p-5">
      <SectionHeading eyebrow="Runtime" title="Service health" description="Live dependency and streaming status." />
      {health.isError ? (
        <div className="mt-4">
          <ErrorState message={health.error.message} onRetry={() => void health.refetch()} />
        </div>
      ) : health.isLoading || !health.data ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="skeleton h-8" />
          ))}
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <HealthRow icon={<Server size={13} />} label="API" value={health.data.api} />
          <HealthRow icon={<Database size={13} />} label="Database" value={health.data.database} />
          <HealthRow
            icon={<Cpu size={13} />}
            label="Model"
            value={health.data.model}
            detail={health.data.model_version ?? undefined}
          />
          <HealthRow
            icon={<Activity size={13} />}
            label="Event stream"
            value={health.data.event_stream}
            detail={`${health.data.stream_clients} client(s)`}
          />
          <p className="pt-2 text-right text-[9px] text-faint">
            Checked {formatDateTime(health.data.checked_at)}
          </p>
        </div>
      )}
    </Panel>
  );
}

function HealthRow({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail?: string;
}) {
  const healthy = ["ok", "healthy", "operational", "connected", "available"].includes(value.toLowerCase());
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-line/55 bg-raised/30 px-3 py-2">
      <span className={cn("shrink-0", healthy ? "text-low" : "text-medium")}>{icon}</span>
      <span className="flex-1 text-[11px] text-muted">{label}</span>
      {detail && <span className="max-w-[110px] truncate font-mono text-[9px] text-faint">{detail}</span>}
      <Badge tone={healthy ? "low" : "medium"}>{titleCase(value)}</Badge>
    </div>
  );
}
