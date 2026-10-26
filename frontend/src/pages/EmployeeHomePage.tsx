import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  CheckCircle2,
  KeyRound,
  Laptop,
  Lock,
  MonitorSmartphone,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useIdentity } from "../hooks/queries";
import { useAuth } from "../hooks/useAuth";
import { RiskHistoryChart } from "../components/charts";
import {
  Avatar,
  Badge,
  Callout,
  DecisionBadge,
  ErrorState,
  LoadingPanel,
  PageHeader,
  Panel,
  RiskBadge,
  RiskGauge,
  SectionHeading,
  SimulatedTag,
} from "../components/ui";
import { cn, formatDateTime, formatRelativeTime, riskTone, ROLE_LABELS, titleCase } from "../lib/utils";

const STATE_TONES: Record<string, "low" | "medium" | "high" | "critical"> = {
  TRUSTED: "low",
  UNVERIFIED: "medium",
  RESTRICTED: "high",
  REVOKED: "critical",
};

export default function EmployeeHomePage() {
  const { me } = useAuth();
  const identity = useIdentity(me?.id);

  if (identity.isError) {
    return (
      <>
        <PageHeader eyebrow="Personal console" title="My security posture" />
        <ErrorState message={identity.error.message} onRetry={() => void identity.refetch()} />
      </>
    );
  }

  if (identity.isLoading || !identity.data) {
    return (
      <>
        <PageHeader eyebrow="Personal console" title="My security posture" />
        <LoadingPanel rows={6} label="Loading your security context" />
      </>
    );
  }

  const detail = identity.data;
  const factors = detail.behavioral_signals[0]?.top_factors ?? [];
  const untrustedDevices = detail.devices.filter((device) => device.state !== "TRUSTED");
  const deniedRecent = detail.recent_access.filter((request) => request.decision === "DENY").length;
  const tone = riskTone(detail.current_risk);

  const guidance: Array<{ title: string; body: string; tone: "success" | "info" | "warning" }> = [];
  if (detail.current_risk >= 70) {
    guidance.push({
      title: "Contact security before retrying sensitive access",
      body: "Your recent behavior looks unusual to the anomaly model. Security can verify context and help you continue safely.",
      tone: "warning",
    });
  }
  if (untrustedDevices.length > 0) {
    guidance.push({
      title: "Review device trust",
      body: `${untrustedDevices.length} device${untrustedDevices.length === 1 ? "" : "s"} are unverified or restricted. Use an IT-managed device for sensitive resources.`,
      tone: "warning",
    });
  }
  if (detail.active_sessions > 2) {
    guidance.push({
      title: "Review active sessions",
      body: `You have ${detail.active_sessions} active sessions. Sign out of sessions you no longer need.`,
      tone: "info",
    });
  }
  if (guidance.length === 0) {
    guidance.push({
      title: "Your current posture is healthy",
      body: "Devices are trusted, sessions are within policy, and no high-risk anomalies are awaiting review.",
      tone: "success",
    });
  }

  return (
    <>
      <PageHeader
        eyebrow="Personal console"
        title={`Welcome, ${detail.display_name.split(" ")[0]}`}
        description="Your access posture, recent decisions, enrolled devices, and the behavioral evidence behind your current risk index."
        meta={
          <>
            <Badge tone="accent">{ROLE_LABELS[detail.role]}</Badge>
            <Badge tone={detail.status === "ACTIVE" ? "low" : "critical"}>{detail.status}</Badge>
            <SimulatedTag value={detail.is_simulated} />
          </>
        }
        actions={
          <Link to="/access" className="btn-secondary">
            <KeyRound size={14} /> My access history
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <Panel className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar name={detail.display_name} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{detail.display_name}</p>
              <p className="text-[11px] text-muted">{detail.title} · {detail.department}</p>
              <p className="mt-0.5 text-[10px] text-faint">{detail.email}</p>
              <p className="mt-1.5 text-[10px] text-faint">
                Last activity {detail.last_activity_at ? formatRelativeTime(detail.last_activity_at) : "not recorded"}
              </p>
            </div>
            <RiskGauge score={detail.current_risk} size={118} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label="Active sessions" value={String(detail.active_sessions)} icon={<MonitorSmartphone size={13} />} />
            <MiniStat label="Devices" value={String(detail.devices.length)} icon={<Laptop size={13} />} />
            <MiniStat label="Recent denials" value={String(deniedRecent)} icon={<ShieldAlert size={13} />} tone={deniedRecent ? "high" : "low"} />
            <MiniStat label="Risk tier" value={tone} icon={<ShieldCheck size={13} />} />
          </div>
        </Panel>

        <Panel className="p-4 sm:p-5">
          <SectionHeading eyebrow="Recommended actions" title="What to do next" />
          <div className="mt-3 space-y-2">
            {guidance.map((item) => (
              <div
                key={item.title}
                className={cn(
                  "rounded-lg border p-3",
                  item.tone === "success" && "border-low/25 bg-low/[0.05]",
                  item.tone === "info" && "border-accent/25 bg-accent/[0.05]",
                  item.tone === "warning" && "border-medium/30 bg-medium/[0.06]",
                )}
              >
                <div className="flex items-start gap-2">
                  {item.tone === "success" ? (
                    <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-low" />
                  ) : item.tone === "warning" ? (
                    <TriangleAlert size={14} className="mt-0.5 shrink-0 text-medium" />
                  ) : (
                    <ShieldCheck size={14} className="mt-0.5 shrink-0 text-accent" />
                  )}
                  <div>
                    <p className="text-[11px] font-semibold text-ink">{item.title}</p>
                    <p className="mt-0.5 text-[10px] leading-4 text-muted">{item.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-start gap-1.5 rounded-lg border border-line/60 bg-raised/30 p-2.5 text-[10px] leading-4 text-faint">
            <Lock size={12} className="mt-0.5 shrink-0" />
            Access decisions are enforced by server-side policy. The anomaly score flags unusual behavior but does not
            authorize access on its own.
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Panel className="p-4 sm:p-5">
          <SectionHeading
            eyebrow="Recent activity"
            title="Your access decisions"
            action={<Link to="/access" className="btn-ghost btn-sm">View all <ArrowUpRight size={11} /></Link>}
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
                      {request.requested_action} · {formatRelativeTime(request.created_at)}
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
                <div key={device.id} className="flex items-center gap-2.5 rounded-lg border border-line/60 bg-raised/30 p-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md border border-line/65 bg-surface text-muted">
                    <Laptop size={13} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium text-ink">{device.name}</p>
                    <p className="text-[9px] text-faint">{device.operating_system}</p>
                  </div>
                  <Badge tone={STATE_TONES[device.state] ?? "neutral"}>{titleCase(device.state)}</Badge>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.15fr]">
        <Panel className="p-4 sm:p-5">
          <SectionHeading
            eyebrow="Explainability"
            title="Why this risk index"
            description={factors.length ? "Top feature deviations from the latest scored event." : undefined}
          />
          {factors.length === 0 ? (
            <p className="mt-4 rounded-lg border border-line/60 bg-raised/30 p-3 text-[11px] text-muted">
              No behavioral factors currently explain your risk. This is normal.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {factors.map((factor) => (
                <div key={factor.feature} className="rounded-lg border border-line/60 bg-raised/30 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-medium text-ink">{factor.label}</p>
                    <span className="rounded bg-line/50 px-1.5 py-0.5 font-mono text-[9px] text-muted">
                      {factor.deviation.toFixed(1)}σ
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] leading-4 text-faint">{factor.message}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="p-4 sm:p-5">
          <SectionHeading eyebrow="Trajectory" title="Risk history" description="Scored access events over the retained window." />
          <div className="mt-3">
            <RiskHistoryChart data={detail.risk_history} />
          </div>
          {detail.alerts.length > 0 && (
            <div className="mt-3 rounded-lg border border-critical/25 bg-critical/[0.05] p-3">
              <p className="text-[10px] font-semibold text-critical">Security alerts involving your identity</p>
              {detail.alerts.slice(0, 3).map((alert) => (
                <p key={alert.id} className="mt-1 text-[10px] leading-4 text-muted">
                  {alert.summary} · {formatDateTime(alert.timestamp)}
                </p>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-4">
        <Callout tone="info" title="Need access to a resource?">
          Contact the security team or your manager. Access is granted through policy, not by changing the anomaly
          score. Sensitive resources may require step-up verification and a trusted device.
        </Callout>
      </div>
    </>
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
      <div className={cn("flex items-center gap-1.5 text-[9px] uppercase tracking-wider", tone === "high" ? "text-high" : tone === "low" ? "text-low" : "text-accent")}>
        {icon}
        {label}
      </div>
      <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}
