import { Link } from "react-router-dom";
import { ArrowUpRight, Laptop } from "lucide-react";
import { Badge, DecisionBadge, Panel, RiskBadge, SectionHeading } from "../../../components/ui";
import { formatRelativeTime, titleCase } from "../../../lib/utils";
import type { IdentityDetail } from "../../../types/api";
import { DEVICE_STATE_TONES } from "../model";

export function AccessAndDevices({ detail }: { detail: IdentityDetail }) {
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <Panel className="p-4 sm:p-5">
        <SectionHeading
          eyebrow="Recent activity"
          title="Your access decisions"
          action={
            <Link to="/access" className="btn-ghost btn-sm">
              View all <ArrowUpRight size={11} />
            </Link>
          }
        />
        {detail.recent_access.length === 0 ? (
          <p className="mt-4 rounded-lg border border-line/60 bg-raised/30 p-3 text-[11px] text-muted">
            No access decisions recorded yet.
          </p>
        ) : (
          <div className="mt-3 divide-y divide-line/45">
            {detail.recent_access.slice(0, 6).map((request) => (
              <Link
                key={request.id}
                to={`/access?request=${request.id}`}
                className="group flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium text-ink group-hover:text-accent">
                    {request.resource_name}
                  </p>
                  <p className="text-[9px] text-faint">
                    {request.requested_action} {"\uFFFD"} {formatRelativeTime(request.created_at)}
                  </p>
                </div>
                <RiskBadge score={request.risk_score} showScore={false} />
                <DecisionBadge decision={request.decision} />
              </Link>
            ))}
          </div>
        )}
      </Panel>

      <Panel className="p-4 sm:p-5">
        <SectionHeading eyebrow="Enrolled devices" title="Device trust" />
        {detail.devices.length === 0 ? (
          <p className="mt-4 rounded-lg border border-line/60 bg-raised/30 p-3 text-[11px] text-muted">
            No devices enrolled. Contact IT to provision a trusted device.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {detail.devices.map((device) => (
              <div
                key={device.id}
                className="flex items-center gap-2.5 rounded-lg border border-line/60 bg-raised/30 p-2.5"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-md border border-line/65 bg-surface text-muted">
                  <Laptop size={13} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium text-ink">{device.name}</p>
                  <p className="text-[9px] text-faint">{device.operating_system}</p>
                </div>
                <Badge tone={DEVICE_STATE_TONES[device.state] ?? "neutral"}>{titleCase(device.state)}</Badge>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
