import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  BrainCircuit,
  Fingerprint,
  KeyRound,
  Laptop,
  MonitorSmartphone,
  ScrollText,
  ShieldAlert,
} from "lucide-react";
import { useIdentity } from "../hooks/queries";
import { useAuth } from "../hooks/useAuth";
import { RiskHistoryChart } from "../components/charts";
import {
  Avatar,
  Badge,
  DecisionBadge,
  EmptyState,
  ErrorState,
  KeyValue,
  LoadingPanel,
  PageHeader,
  Panel,
  RiskBadge,
  RiskGauge,
  SectionHeading,
  SimulatedTag,
  Tabs,
} from "../components/ui";
import {
  cn,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  riskTone,
  ROLE_LABELS,
  titleCase,
} from "../lib/utils";

type DetailTab = "behavior" | "access" | "devices" | "sessions" | "alerts" | "audit";

const DEVICE_STATE_TONES = {
  TRUSTED: "low",
  UNVERIFIED: "medium",
  RESTRICTED: "high",
  REVOKED: "critical",
} as const;

export default function IdentityDetailPage() {
  const { identityId } = useParams<{ identityId: string }>();
  const { me, isStaff } = useAuth();
  const identity = useIdentity(identityId);
  const [tab, setTab] = useState<DetailTab>("behavior");

  if (identity.isError) {
    return (
      <>
        <PageHeader eyebrow="Identity dossier" title="Identity unavailable" />
        <ErrorState message={identity.error.message} onRetry={() => void identity.refetch()} />
      </>
    );
  }

  if (identity.isLoading || !identity.data) {
    return (
      <>
        <PageHeader eyebrow="Identity dossier" title="Loading identity" />
        <LoadingPanel rows={6} label="Reconstructing identity context" />
      </>
    );
  }

  const person = identity.data;
  const isSelf = me?.id === person.id;
  const canEvaluate = isStaff && me?.role !== "AUDITOR";
  const tabs: Array<{ id: DetailTab; label: string; count?: number }> = [
    { id: "behavior", label: "Behavioral", count: person.behavioral_signals.length },
    { id: "access", label: "Access", count: person.recent_access.length },
    { id: "devices", label: "Devices", count: person.devices.length },
    { id: "sessions", label: "Sessions", count: person.sessions.length },
    { id: "alerts", label: "Alerts", count: person.alerts.length },
    { id: "audit", label: "Audit", count: person.audit_events.length },
  ];

  return (
    <>
      <div className="mb-3 flex items-center gap-2 text-[10px] text-faint">
        <Link to={isStaff ? "/identities" : "/me"} className="inline-flex items-center gap-1 hover:text-ink">
          <ArrowLeft size={12} /> {isStaff ? "Identities" : "My security"}
        </Link>
        <span>/</span>
        <span className="text-muted">{person.display_name}</span>
      </div>

      <PageHeader
        eyebrow={isSelf ? "Your identity dossier" : "Identity dossier"}
        title={person.display_name}
        description={`${person.title} · ${person.department} · ${person.email}`}
        meta={
          <>
            <Badge tone={person.status === "ACTIVE" ? "low" : "critical"} dot>
              {titleCase(person.status)}
            </Badge>
            <Badge tone={person.role === "SECURITY_ADMIN" ? "violet" : "neutral"}>{ROLE_LABELS[person.role]}</Badge>
            <SimulatedTag value={person.is_simulated} />
            <span className="text-[10px] text-faint">Created {formatDate(person.created_at)}</span>
          </>
        }
        actions={
          <>
            {me?.role !== "AUDITOR" && (
              <Link to={`/access?identity=${person.id}`} className="btn-secondary">
                <KeyRound size={14} /> Access history
              </Link>
            )}
            {canEvaluate && (
              <Link to={`/access?evaluate=1&identity=${person.id}`} className="btn-primary">
                <ShieldAlert size={14} /> Evaluate access
              </Link>
            )}
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <Panel className="p-4">
            <div className="flex flex-col items-center text-center">
              <Avatar name={person.display_name} size="lg" className="h-16 w-16 text-lg" />
              <p className="mt-3 font-display text-base font-semibold text-ink">{person.display_name}</p>
              <p className="mt-0.5 text-[11px] text-muted">{person.email}</p>
              <div className="mt-3">
                <RiskBadge score={person.current_risk} />
              </div>
              <RiskGauge score={person.current_risk} size={124} />
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-3 border-t border-line/55 pt-4">
              <KeyValue label="Role" value={ROLE_LABELS[person.role]} />
              <KeyValue label="Status" value={titleCase(person.status)} />
              <KeyValue label="Department" value={person.department} />
              <KeyValue label="Last active" value={formatRelativeTime(person.last_activity_at)} />
            </dl>
          </Panel>

          <div className="grid grid-cols-3 gap-2">
            <MetricMini label="Sessions" value={person.active_sessions} />
            <MetricMini label="Devices" value={person.devices.length} />
            <MetricMini label="Signals" value={person.behavioral_signals.length} />
          </div>

          <Panel className="p-4">
            <p className="eyebrow mb-2">Interpretation</p>
            <p className="text-[11px] leading-5 text-muted">
              Risk {person.current_risk.toFixed(0)} is a behavioral anomaly ranking. Policy controls
              still decide access, and high risk never grants privilege.
            </p>
          </Panel>
        </div>

        <div className="min-w-0">
          <Tabs tabs={tabs} value={tab} onChange={setTab} className="mb-4" />

          {tab === "behavior" && (
            <div className="space-y-4">
              <Panel className="p-4 sm:p-5">
                <SectionHeading
                  eyebrow="Risk trajectory"
                  title="Behavioral history"
                  description="Every scored access attempt contributes a point to this timeline."
                  action={<Badge tone={riskTone(person.current_risk).toLowerCase() as "low" | "medium" | "high" | "critical"}>{riskTone(person.current_risk)}</Badge>}
                />
                <div className="mt-3">
                  <RiskHistoryChart data={person.risk_history} />
                </div>
              </Panel>

              <Panel className="overflow-hidden">
                <div className="p-4 sm:p-5">
                  <SectionHeading
                    eyebrow="Explainability"
                    title="Behavioral signals"
                    description="Top contributing features from recent Isolation Forest scores. Descriptive, not causal."
                  />
                </div>
                {person.behavioral_signals.length === 0 ? (
                  <EmptyState
                    icon={<BrainCircuit size={18} />}
                    title="No behavioral signals"
                    description="Anomaly signals appear after access evaluations that include behavioral features."
                  />
                ) : (
                  <div className="divide-y divide-line/50">
                    {person.behavioral_signals.map((signal) => (
                      <div key={signal.id} className="px-4 py-4 sm:px-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <RiskBadge score={signal.risk_score} />
                            <span className="text-[10px] text-faint">{formatDateTime(signal.detected_at)}</span>
                            <SimulatedTag value={signal.is_simulated} />
                          </div>
                          <span className="font-mono text-[9px] text-faint">{signal.model_version}</span>
                        </div>
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          {signal.top_factors.length === 0 ? (
                            <p className="text-[11px] text-muted">No feature crossed the explanation threshold.</p>
                          ) : (
                            signal.top_factors.map((factor) => (
                              <div key={factor.feature} className="rounded-lg border border-line/60 bg-raised/35 p-2.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[11px] font-medium text-ink">{factor.label}</span>
                                  <span className="rounded bg-line/50 px-1.5 py-0.5 font-mono text-[9px] text-muted">
                                    {factor.deviation.toFixed(1)}σ
                                  </span>
                                </div>
                                <p className="mt-1 text-[10px] leading-4 text-faint">{factor.message}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </div>
          )}

          {tab === "access" && (
            <Panel className="overflow-hidden">
              <div className="p-4 sm:p-5">
                <SectionHeading
                  eyebrow="Decision trail"
                  title="Recent access requests"
                  description="Latest ten evaluations for this identity."
                  action={<Link to={`/access?identity=${person.id}`} className="text-[10px] text-accent hover:underline">Full history</Link>}
                />
              </div>
              {person.recent_access.length === 0 ? (
                <EmptyState icon={<KeyRound size={18} />} title="No access requests" description="This identity has no recorded policy evaluations." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Resource</th>
                        <th>Action</th>
                        <th>Decision</th>
                        <th>Risk</th>
                        <th className="hidden md:table-cell">When</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {person.recent_access.map((request) => (
                        <tr key={request.id} className="group">
                          <td>
                            <p className="text-xs font-medium text-ink">{request.resource_name}</p>
                            <p className="font-mono text-[9px] text-faint">{request.policy_version}</p>
                          </td>
                          <td><Badge>{request.requested_action}</Badge></td>
                          <td><DecisionBadge decision={request.decision} /></td>
                          <td><RiskBadge score={request.risk_score} /></td>
                          <td className="hidden text-[11px] text-muted md:table-cell">{formatRelativeTime(request.created_at)}</td>
                          <td>
                            <Link to={`/access?request=${request.id}`} className="text-faint transition group-hover:text-accent" aria-label="Open decision">
                              <ArrowUpRight size={14} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          )}

          {tab === "devices" && (
            <Panel className="overflow-hidden">
              <div className="p-4 sm:p-5">
                <SectionHeading eyebrow="Device trust" title="Enrolled devices" description="Declared device posture used by policy evaluation." />
              </div>
              {person.devices.length === 0 ? (
                <EmptyState icon={<Laptop size={18} />} title="No devices" description="No device has been enrolled for this identity." />
              ) : (
                <div className="divide-y divide-line/50">
                  {person.devices.map((device) => (
                    <div key={device.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-raised text-muted">
                        {device.device_type === "Mobile" || device.device_type === "Tablet" ? <MonitorSmartphone size={15} /> : <Laptop size={15} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-ink">{device.name}</p>
                        <p className="text-[10px] text-faint">{device.device_type} · {device.operating_system} · seen {formatRelativeTime(device.last_observed_at)}</p>
                      </div>
                      <Badge tone={DEVICE_STATE_TONES[device.state]} dot>{device.state}</Badge>
                      <SimulatedTag value={device.is_simulated} />
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          )}

          {tab === "sessions" && (
            <Panel className="overflow-hidden">
              <div className="p-4 sm:p-5">
                <SectionHeading eyebrow="Session boundary" title="Authentication sessions" description="Most recent sessions; only active sessions can authorize requests." />
              </div>
              {person.sessions.length === 0 ? (
                <EmptyState icon={<Fingerprint size={18} />} title="No sessions" description="This identity has not authenticated." />
              ) : (
                <div className="divide-y divide-line/50">
                  {person.sessions.map((session) => (
                    <div key={session.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_auto] sm:px-5">
                      <div>
                        <p className="font-mono text-[10px] text-muted">{session.id}</p>
                        <p className="mt-1 text-[10px] text-faint">
                          IP {session.ip_address ?? "unknown"} · {session.user_agent ?? "unknown client"}
                        </p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-[10px] text-muted">Expires {formatDateTime(session.expires_at)}</p>
                        <p className="text-[9px] text-faint">Created {formatRelativeTime(session.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          )}

          {tab === "alerts" && (
            <Panel className="overflow-hidden">
              <div className="p-4 sm:p-5">
                <SectionHeading eyebrow="Attention" title="High-severity alerts" description="Security events linked to this identity." />
              </div>
              {person.alerts.length === 0 ? (
                <EmptyState icon={<ShieldAlert size={18} />} title="No alerts" description="No high or critical events are linked to this identity." />
              ) : (
                <div className="divide-y divide-line/50">
                  {person.alerts.map((event) => (
                    <Link key={event.id} to={`/events?event=${event.id}`} className="flex items-start gap-3 px-4 py-3 transition hover:bg-raised/45 sm:px-5">
                      <span className={cn("mt-1 h-2 w-2 rounded-full", event.severity === "CRITICAL" ? "bg-critical" : "bg-high")} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-ink">{event.summary}</p>
                        <p className="mt-1 text-[10px] text-faint">{event.event_type} · {formatDateTime(event.timestamp)}</p>
                      </div>
                      <Badge tone={event.severity.toLowerCase() as "high" | "critical"}>{event.severity}</Badge>
                    </Link>
                  ))}
                </div>
              )}
            </Panel>
          )}

          {tab === "audit" && (
            <Panel className="overflow-hidden">
              <div className="p-4 sm:p-5">
                <SectionHeading
                  eyebrow="Evidence chain"
                  title="Audit references"
                  description="Append-only audit records involving this identity."
                  action={isStaff ? <Link to="/audit" className="text-[10px] text-accent hover:underline">Open ledger</Link> : undefined}
                />
              </div>
              {person.audit_events.length === 0 ? (
                <EmptyState icon={<ScrollText size={18} />} title="No audit references" description="No audit entries currently reference this identity." />
              ) : (
                <div className="divide-y divide-line/50">
                  {person.audit_events.map((entry) => (
                    <div key={entry.id} className="px-4 py-3 sm:px-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="accent">#{entry.sequence}</Badge>
                        <span className="text-xs font-medium text-ink">{entry.action}</span>
                        <Badge tone={entry.result === "SUCCESS" ? "low" : "critical"}>{entry.result}</Badge>
                        <span className="ml-auto text-[9px] text-faint">{formatDateTime(entry.timestamp)}</span>
                      </div>
                      <p className="mt-1 text-[10px] text-muted">
                        {entry.actor_label} · {entry.target_type} · {entry.correlation_id}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}

function MetricMini({ label, value }: { label: string; value: number }) {
  return (
    <div className="panel-quiet px-2 py-2.5 text-center">
      <p className="font-display text-lg font-semibold text-ink">{value}</p>
      <p className="text-[9px] uppercase tracking-wider text-faint">{label}</p>
    </div>
  );
}
