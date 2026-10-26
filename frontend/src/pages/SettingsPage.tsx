import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  Braces,
  Check,
  Cookie,
  Cpu,
  Database,
  FlaskConical,
  Globe2,
  Lock,
  LogOut,
  RefreshCw,
  Server,
  ShieldCheck,
  Timer,
  X,
} from "lucide-react";
import { useDetailedHealth, useSettingsInfo } from "../hooks/queries";
import { useAuth } from "../hooks/useAuth";
import {
  Avatar,
  Badge,
  Button,
  Callout,
  ErrorState,
  KeyValue,
  LoadingPanel,
  PageHeader,
  Panel,
  SectionHeading,
  SimulatedTag,
} from "../components/ui";
import { cn, formatDateTime, ROLE_LABELS, titleCase } from "../lib/utils";
import type { Role } from "../types/api";

const CAPABILITIES: Array<{
  label: string;
  roles: Record<Role, boolean>;
}> = [
  { label: "View security overview", roles: { SECURITY_ADMIN: true, SECURITY_ANALYST: true, EMPLOYEE: false, AUDITOR: true } },
  { label: "Evaluate access", roles: { SECURITY_ADMIN: true, SECURITY_ANALYST: true, EMPLOYEE: false, AUDITOR: false } },
  { label: "Preview policies", roles: { SECURITY_ADMIN: true, SECURITY_ANALYST: true, EMPLOYEE: false, AUDITOR: false } },
  { label: "Publish policies", roles: { SECURITY_ADMIN: true, SECURITY_ANALYST: false, EMPLOYEE: false, AUDITOR: false } },
  { label: "Change device posture", roles: { SECURITY_ADMIN: true, SECURITY_ANALYST: false, EMPLOYEE: false, AUDITOR: false } },
  { label: "Update incidents", roles: { SECURITY_ADMIN: true, SECURITY_ANALYST: true, EMPLOYEE: false, AUDITOR: false } },
  { label: "Retrain model", roles: { SECURITY_ADMIN: true, SECURITY_ANALYST: false, EMPLOYEE: false, AUDITOR: false } },
  { label: "View audit ledger", roles: { SECURITY_ADMIN: true, SECURITY_ANALYST: true, EMPLOYEE: false, AUDITOR: true } },
  { label: "Export audit ledger", roles: { SECURITY_ADMIN: true, SECURITY_ANALYST: true, EMPLOYEE: false, AUDITOR: true } },
  { label: "Run demo scenarios", roles: { SECURITY_ADMIN: true, SECURITY_ANALYST: true, EMPLOYEE: false, AUDITOR: false } },
  { label: "Reset demo environment", roles: { SECURITY_ADMIN: true, SECURITY_ANALYST: false, EMPLOYEE: false, AUDITOR: false } },
  { label: "Request own access", roles: { SECURITY_ADMIN: true, SECURITY_ANALYST: true, EMPLOYEE: true, AUDITOR: false } },
];

export default function SettingsPage() {
  const { me, logout } = useAuth();
  const settings = useSettingsInfo();
  const health = useDetailedHealth();

  if (settings.isError) {
    return (
      <>
        <PageHeader eyebrow="Configuration" title="Settings" />
        <ErrorState message={settings.error.message} onRetry={() => void settings.refetch()} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="Settings"
        description="Runtime posture, session and login controls, model availability, and the server-enforced role capability matrix."
        meta={
          <>
            <Badge tone={settings.data?.environment === "production" ? "low" : "medium"}>
              {settings.data ? titleCase(settings.data.environment) : "—"}
            </Badge>
            {settings.data?.demo_mode && <Badge tone="violet">Demo mode enabled</Badge>}
          </>
        }
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              void settings.refetch();
              void health.refetch();
            }}
            loading={settings.isFetching || health.isFetching}
          >
            <RefreshCw size={14} /> Refresh
          </Button>
        }
      />

      {settings.isLoading || !settings.data ? (
        <LoadingPanel rows={6} label="Loading environment settings" />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
            <Panel className="p-4 sm:p-5">
              <SectionHeading eyebrow="Session" title="Signed-in principal" description="The backend resolves this identity from an HttpOnly session cookie." />
              <div className="mt-4 flex items-center gap-3">
                <Avatar name={me?.display_name ?? "Unknown"} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{me?.display_name}</p>
                  <p className="text-[11px] text-muted">{me?.email}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge tone="accent">{me ? ROLE_LABELS[me.role] : "—"}</Badge>
                    <Badge tone={me?.status === "ACTIVE" ? "low" : "critical"}>{me?.status}</Badge>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <KeyValue label="Session TTL" value={`${settings.data.session_ttl_minutes} minutes`} />
                <KeyValue label="Login rate limit" value={`${settings.data.login_rate_limit} / ${settings.data.login_rate_window_seconds}s`} />
              </div>
              <div className="mt-4 flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => void logout()}>
                  <LogOut size={12} /> Sign out
                </Button>
              </div>
            </Panel>

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
                  <HealthRow icon={<Cpu size={13} />} label="Model" value={health.data.model} detail={health.data.model_version ?? undefined} />
                  <HealthRow icon={<Activity size={13} />} label="Event stream" value={health.data.event_stream} detail={`${health.data.stream_clients} client(s)`} />
                  <p className="pt-2 text-right text-[9px] text-faint">Checked {formatDateTime(health.data.checked_at)}</p>
                </div>
              )}
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel className="p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <Globe2 size={15} className="text-accent" />
                <p className="text-xs font-semibold text-ink">Origin controls</p>
              </div>
              <p className="mt-1 text-[11px] leading-5 text-muted">Cross-origin requests are restricted to the allowed origins below.</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {settings.data.allowed_origins.map((origin) => (
                  <span key={origin} className="rounded border border-line/70 bg-raised/50 px-2 py-1 font-mono text-[9px] text-muted">
                    {origin}
                  </span>
                ))}
              </div>
            </Panel>

            <Panel className="p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <Cpu size={15} className="text-accent" />
                <p className="text-xs font-semibold text-ink">Model artifact</p>
              </div>
              <p className="mt-1 text-[11px] leading-5 text-muted">The active Isolation Forest artifact is required for evaluations.</p>
              <div className="mt-3 flex items-center gap-2">
                <Badge tone={settings.data.model_artifact_available ? "low" : "critical"}>
                  {settings.data.model_artifact_available ? "Available" : "Unavailable"}
                </Badge>
                <span className="font-mono text-[9px] text-faint">{settings.data.model_version ?? "No version"}</span>
              </div>
              <Link to="/model" className="btn-ghost btn-sm mt-3">Open model evaluation</Link>
            </Panel>

            <Panel className="p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <FlaskConical size={15} className="text-accent" />
                <p className="text-xs font-semibold text-ink">Demo controls</p>
              </div>
              <p className="mt-1 text-[11px] leading-5 text-muted">Demo execution is gated server-side by mode and role. Reset preserves audit history.</p>
              <div className="mt-3 flex items-center gap-2">
                <Badge tone={settings.data.demo_mode ? "violet" : "neutral"}>
                  {settings.data.demo_mode ? "Demo mode on" : "Demo mode off"}
                </Badge>
              </div>
              <Link to="/demo" className="btn-ghost btn-sm mt-3">Open demo lab</Link>
            </Panel>
          </div>

          <Panel className="overflow-hidden">
            <div className="border-b border-line/60 p-4 sm:p-5">
              <SectionHeading
                eyebrow="Least privilege"
                title="Server-enforced capabilities"
                description="UI affordances mirror these boundaries, but the backend independently authorizes every request."
                action={<Badge tone="accent">{me ? ROLE_LABELS[me.role] : "—"}</Badge>}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Capability</th>
                    <th className="text-center">Admin</th>
                    <th className="text-center">Analyst</th>
                    <th className="text-center">Employee</th>
                    <th className="text-center">Auditor</th>
                  </tr>
                </thead>
                <tbody>
                  {CAPABILITIES.map((capability) => (
                    <tr key={capability.label}>
                      <td className={cn("text-[11px]", capability.roles[me?.role ?? "AUDITOR"] ? "text-ink" : "text-muted")}>
                        {capability.label}
                      </td>
                      {(["SECURITY_ADMIN", "SECURITY_ANALYST", "EMPLOYEE", "AUDITOR"] as Role[]).map((role) => (
                        <td key={role} className="text-center">
                          <span
                            className={cn(
                              "inline-flex h-5 w-5 items-center justify-center rounded-full border",
                              capability.roles[role]
                                ? "border-low/30 bg-low/10 text-low"
                                : "border-line/60 bg-raised/40 text-faint",
                            )}
                          >
                            {capability.roles[role] ? <Check size={11} /> : <X size={10} />}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel className="p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <Lock size={15} className="text-accent" />
                <p className="text-xs font-semibold text-ink">Limitations and trust boundaries</p>
              </div>
              <ul className="mt-3 space-y-2">
                {settings.data.limitations.map((limitation) => (
                  <li key={limitation} className="flex items-start gap-2 text-[11px] leading-5 text-muted">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-medium" />
                    {limitation}
                  </li>
                ))}
              </ul>
            </Panel>

            <div className="space-y-3">
              <Callout tone="info" icon={<Cookie size={15} />} title="Session and CSRF design">
                Session tokens live in HttpOnly cookies. Mutating requests require the CSRF cookie value to be echoed
                in the <span className="font-mono text-[10px]">X-CSRF-Token</span> header.
              </Callout>
              <Callout tone="success" icon={<ShieldCheck size={15} />} title="Fail-closed policy engine">
                Mandatory identity, account, role, device, session, and resource checks are evaluated before risk
                thresholds. The anomaly model can escalate controls but never grant access.
              </Callout>
              <Callout tone="warning" icon={<Timer size={15} />} title="Prototype boundaries">
                This is a self-contained hackathon prototype using synthetic data. It is not a production identity
                provider and has no external SSO, MFA, or threat-intel integration.
              </Callout>
            </div>
          </div>
        </div>
      )}
    </>
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
