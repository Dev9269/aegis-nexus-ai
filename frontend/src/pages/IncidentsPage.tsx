import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, CheckCircle2, ClipboardList, FileText, MessageSquare, Siren, UserCheck } from "lucide-react";
import { api, messageFromError } from "../services/api";
import { useIncident, useIncidents, useStaffCandidates } from "../hooks/queries";
import { useAuth } from "../hooks/useAuth";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useToast } from "../hooks/useToast";
import {
  Avatar,
  Badge,
  Button,
  Callout,
  CopyInline,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  IncidentStatusBadge,
  KeyValue,
  PageHeader,
  Pagination,
  Panel,
  SearchInput,
  SelectInput,
  SeverityBadge,
  SimulatedTag,
  Tabs,
  TextArea,
} from "../components/ui";
import type { Incident, IncidentStatus, IncidentUpdate, Severity } from "../types/api";
import {
  cn,
  formatDateTime,
  formatRelativeTime,
  INCIDENT_STATUS_LABELS,
  titleCase,
} from "../lib/utils";

const PAGE_SIZE = 20;
const STATUS_OPTIONS: IncidentStatus[] = ["OPEN", "INVESTIGATING", "CONTAINED", "RESOLVED", "FALSE_POSITIVE"];
const SEVERITY_OPTIONS: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export default function IncidentsPage() {
  const { me, isStaff } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<IncidentStatus | "">("");
  const [severity, setSeverity] = useState<Severity | "">("");
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search);
  const incidentId = searchParams.get("incident") ?? undefined;

  useEffect(() => {
    setPage(1);
  }, [debounced, status, severity]);

  const params = {
    q: debounced || undefined,
    status: status || undefined,
    severity: severity || undefined,
    page,
    page_size: PAGE_SIZE,
  };
  const incidents = useIncidents(params);
  const openIncidents = useIncidents({ status: "OPEN", page: 1, page_size: 1 });
  const rows = incidents.data?.items ?? [];
  const openCount = openIncidents.data?.total ?? rows.filter((row) => row.status === "OPEN").length;

  const setIncidentParam = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set("incident", id);
    else next.delete("incident");
    setSearchParams(next, { replace: true });
  };

  return (
    <>
      <PageHeader
        eyebrow="Incident response"
        title="Incidents"
        description="Investigate high-risk behavior, preserve evidence, assign ownership, and drive incidents to a defensible resolution."
        meta={
          <>
            <Badge tone={openCount ? "critical" : "low"}>{openCount} open</Badge>
            <span className="text-[10px] text-faint">
              Auto-created for critical risk or policy containment
            </span>
          </>
        }
        actions={
          <Link to="/timeline" className="btn-secondary">
            <Siren size={14} /> Live timeline
          </Link>
        }
      />

      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line/60 p-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search incident, identity, or summary…"
            className="min-w-[230px] flex-1 sm:max-w-sm"
          />
          <SelectInput
            className="h-9 w-[160px] text-xs"
            value={status}
            onChange={(event) => setStatus(event.target.value as IncidentStatus | "")}
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>{INCIDENT_STATUS_LABELS[value]}</option>
            ))}
          </SelectInput>
          <SelectInput
            className="h-9 w-[130px] text-xs"
            value={severity}
            onChange={(event) => setSeverity(event.target.value as Severity | "")}
          >
            <option value="">All severity</option>
            {SEVERITY_OPTIONS.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </SelectInput>
          {isStaff && (
            <Link to="/access" className="btn-ghost btn-sm ml-auto">
              Evaluate access <ArrowUpRight size={12} />
            </Link>
          )}
        </div>

        {incidents.isError ? (
          <ErrorState message={incidents.error.message} onRetry={() => void incidents.refetch()} />
        ) : incidents.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="skeleton h-14" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 size={18} />}
            title="No incidents match"
            description="The queue is clear. Generate a high-risk demo scenario or broaden the filters."
            action={<Link to="/demo" className="btn-secondary btn-sm">Run a demo scenario</Link>}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Incident</th>
                    <th>Identity</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th className="hidden lg:table-cell">Assignee</th>
                    <th className="hidden md:table-cell">Updated</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((incident) => (
                    <tr key={incident.id} className="group cursor-pointer" onClick={() => setIncidentParam(incident.id)}>
                      <td className="max-w-[320px]">
                        <p className="truncate text-xs font-medium text-ink group-hover:text-accent">{incident.title}</p>
                        <p className="truncate text-[10px] text-faint">{incident.summary}</p>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Avatar name={incident.identity_name ?? "System"} size="sm" />
                          <span className="truncate text-[11px] text-muted">{incident.identity_name ?? "System"}</span>
                        </div>
                      </td>
                      <td><SeverityBadge severity={incident.severity} /></td>
                      <td><IncidentStatusBadge status={incident.status} /></td>
                      <td className="hidden text-[11px] text-muted lg:table-cell">
                        {incident.assigned_to ? "Assigned" : "Unassigned"}
                      </td>
                      <td className="hidden text-[11px] text-muted md:table-cell">
                        {formatRelativeTime(incident.updated_at)}
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <SimulatedTag value={incident.is_simulated} />
                          <ArrowUpRight size={13} className="text-faint transition group-hover:text-accent" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={incidents.data?.page ?? 1}
              pageSize={incidents.data?.page_size ?? PAGE_SIZE}
              total={incidents.data?.total ?? 0}
              onPage={setPage}
            />
          </>
        )}
      </div>

      <Drawer
        open={Boolean(incidentId)}
        onClose={() => setIncidentParam(null)}
        title="Incident investigation"
        eyebrow="Case file"
        width="wide"
      >
        {incidentId && (
          <IncidentPanel
            incidentId={incidentId}
            canWrite={me?.role === "SECURITY_ADMIN" || me?.role === "SECURITY_ANALYST"}
            onOpenAccess={(id) => {
              setIncidentParam(null);
              navigate(`/access?request=${id}`);
            }}
          />
        )}
      </Drawer>
    </>
  );
}

function IncidentPanel({
  incidentId,
  canWrite,
  onOpenAccess,
}: {
  incidentId: string;
  canWrite: boolean;
  onOpenAccess: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const detail = useIncident(incidentId);
  const staff = useStaffCandidates(canWrite);
  const [tab, setTab] = useState<"overview" | "notes" | "timeline" | "access">("overview");
  const [status, setStatus] = useState<IncidentStatus>("OPEN");
  const [severity, setSeverity] = useState<Severity>("HIGH");
  const [assignee, setAssignee] = useState("");
  const [resolution, setResolution] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!detail.data) return;
    setStatus(detail.data.status);
    setSeverity(detail.data.severity);
    setAssignee(detail.data.assigned_to ?? "");
    setResolution(detail.data.resolution ?? "");
  }, [detail.data]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["incidents"] });
    void queryClient.invalidateQueries({ queryKey: ["incident", incidentId] });
    void queryClient.invalidateQueries({ queryKey: ["overview"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    void queryClient.invalidateQueries({ queryKey: ["events"] });
  };

  const update = useMutation({
    mutationFn: (payload: IncidentUpdate) => api.updateIncident(incidentId, payload),
    onSuccess: () => {
      invalidate();
      toast.success("Incident updated", "The workflow change was audited.");
    },
    onError: (error) => toast.error("Update failed", messageFromError(error)),
  });

  const addNote = useMutation({
    mutationFn: (text: string) => api.addIncidentNote(incidentId, text),
    onSuccess: () => {
      setNote("");
      void queryClient.invalidateQueries({ queryKey: ["incident", incidentId] });
      void queryClient.invalidateQueries({ queryKey: ["incidents"] });
      toast.success("Note added", "Investigation notes are append-only.");
    },
    onError: (error) => toast.error("Note failed", messageFromError(error)),
  });

  const saveWorkflow = () => {
    const payload: IncidentUpdate = {
      status,
      severity,
      assigned_to: assignee || null,
    };
    if (resolution.trim()) payload.resolution = resolution.trim();
    update.mutate(payload);
  };

  if (detail.isLoading) {
    return (
      <div className="space-y-3">
        <div className="skeleton h-32" />
        <div className="skeleton h-24" />
        <div className="skeleton h-48" />
      </div>
    );
  }
  if (detail.isError) {
    return <ErrorState message={detail.error.message} onRetry={() => void detail.refetch()} />;
  }
  if (!detail.data) return null;

  const incident = detail.data;
  const assigneeName = staff.data?.items.find((item) => item.id === incident.assigned_to)?.display_name;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={incident.severity} />
          <IncidentStatusBadge status={incident.status} />
          <SimulatedTag value={incident.is_simulated} />
          <span className="font-mono text-[9px] text-faint">{incident.classification}</span>
        </div>
        <h2 className="mt-2 font-display text-lg font-semibold leading-6 text-ink">{incident.title}</h2>
        <p className="mt-1.5 text-xs leading-5 text-muted">{incident.summary}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {incident.identity_id && (
            <Link to={`/identities/${incident.identity_id}`} className="btn-secondary btn-sm">
              <UserCheck size={12} /> Identity dossier
            </Link>
          )}
          {incident.identity_id && (
            <Link to={`/access?identity=${incident.identity_id}`} className="btn-ghost btn-sm">
              Access history
            </Link>
          )}
        </div>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "notes", label: "Notes", count: incident.notes.length },
          { id: "timeline", label: "Timeline", count: incident.timeline.length },
          { id: "access", label: "Access", count: incident.access_requests.length },
        ]}
      />

      {tab === "overview" && (
        <div className="space-y-4">
          <Panel className="p-4">
            <div className="grid grid-cols-2 gap-4">
              <KeyValue label="Identity" value={incident.identity_name ?? "System"} />
              <KeyValue label="Assignee" value={assigneeName ?? (incident.assigned_to ? "Assigned staff" : "Unassigned")} />
              <KeyValue label="Created" value={formatDateTime(incident.created_at)} />
              <KeyValue label="Updated" value={formatDateTime(incident.updated_at)} />
              <KeyValue label="Incident ID" value={<CopyInline value={incident.id} />} />
              <KeyValue label="Related requests" value={incident.related_access_request_ids.length} />
            </div>
            {incident.resolution && (
              <div className="mt-4 rounded-lg border border-low/25 bg-low/[0.06] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-low">Resolution</p>
                <p className="mt-1 text-xs leading-5 text-muted">{incident.resolution}</p>
              </div>
            )}
          </Panel>

          {canWrite ? (
            <Panel className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <ClipboardList size={15} className="text-accent" />
                <p className="text-xs font-semibold text-ink">Response workflow</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Status">
                  <SelectInput value={status} onChange={(event) => setStatus(event.target.value as IncidentStatus)}>
                    {STATUS_OPTIONS.map((value) => (
                      <option key={value} value={value}>{INCIDENT_STATUS_LABELS[value]}</option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Severity">
                  <SelectInput value={severity} onChange={(event) => setSeverity(event.target.value as Severity)}>
                    {SEVERITY_OPTIONS.map((value) => (
                      <option key={value} value={value}>{titleCase(value)}</option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Assignee" className="sm:col-span-2">
                  <SelectInput value={assignee} onChange={(event) => setAssignee(event.target.value)}>
                    <option value="">Unassigned</option>
                    {staff.data?.items.map((identity) => (
                      <option key={identity.id} value={identity.id}>
                        {identity.display_name} · {identity.email}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field
                  label="Resolution"
                  hint="Required when closing as resolved or false positive."
                  className="sm:col-span-2"
                >
                  <TextArea
                    rows={3}
                    value={resolution}
                    onChange={(event) => setResolution(event.target.value)}
                    placeholder="What was verified, what changed, and why is this safe to close?"
                  />
                </Field>
              </div>
              {update.isError && (
                <p className="mt-2 text-[11px] text-critical">{messageFromError(update.error)}</p>
              )}
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                {incident.status !== "CONTAINED" && incident.status !== "RESOLVED" && (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={update.isPending}
                    onClick={() => update.mutate({ status: "CONTAINED", severity, assigned_to: assignee || null })}
                  >
                    Mark contained
                  </Button>
                )}
                <Button variant="solid" size="sm" loading={update.isPending} onClick={saveWorkflow}>
                  Save workflow
                </Button>
              </div>
            </Panel>
          ) : (
            <Callout tone="info" title="Read-only role">
              Auditors can inspect evidence and workflow history but cannot modify incidents.
            </Callout>
          )}
        </div>
      )}

      {tab === "notes" && (
        <div className="space-y-3">
          {canWrite && (
            <Panel className="p-4">
              <label className="label" htmlFor="incident-note">Add investigation note</label>
              <TextArea
                id="incident-note"
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Document what you checked, hypotheses, and next steps…"
              />
              <div className="mt-2 flex justify-end">
                <Button
                  variant="solid"
                  size="sm"
                  loading={addNote.isPending}
                  disabled={!note.trim()}
                  onClick={() => addNote.mutate(note.trim())}
                >
                  <MessageSquare size={12} /> Add note
                </Button>
              </div>
            </Panel>
          )}
          {incident.notes.length === 0 ? (
            <EmptyState icon={<MessageSquare size={18} />} title="No notes yet" description="Notes are append-only and audit-linked." />
          ) : (
            incident.notes.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-line/65 bg-raised/30 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-ink">{entry.author_label}</span>
                  <span className="text-[9px] text-faint">{formatDateTime(entry.created_at)}</span>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-[11px] leading-5 text-muted">{entry.note}</p>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "timeline" && (
        <div className="relative space-y-4 pl-5">
          <span className="absolute bottom-2 left-[5px] top-2 w-px bg-line/70" />
          {incident.timeline.length === 0 ? (
            <EmptyState icon={<FileText size={18} />} title="No timeline events" />
          ) : (
            incident.timeline.map((event) => (
              <div key={event.id} className="relative">
                <span
                  className={cn(
                    "absolute -left-5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface",
                    event.severity === "CRITICAL" && "bg-critical",
                    event.severity === "HIGH" && "bg-high",
                    event.severity === "MEDIUM" && "bg-medium",
                    event.severity === "LOW" && "bg-low",
                  )}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-medium text-ink">{event.summary}</span>
                  <SimulatedTag value={event.is_simulated} />
                </div>
                <p className="mt-0.5 text-[10px] text-faint">
                  {formatDateTime(event.timestamp)} · {event.event_type} · {event.category}
                </p>
                <p className="mt-1 text-[11px] leading-5 text-muted">
                  {typeof event.details?.message === "string" ? event.details.message : event.summary}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "access" && (
        <div className="space-y-2">
          {incident.access_requests.length === 0 ? (
            <EmptyState icon={<ClipboardList size={18} />} title="No linked access requests" />
          ) : (
            incident.access_requests.map((request) => (
              <button
                key={request.id}
                type="button"
                onClick={() => onOpenAccess(request.id)}
                className="flex w-full items-center gap-3 rounded-lg border border-line/65 bg-raised/30 p-3 text-left transition hover:border-accent/30"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium text-ink">{request.resource_name}</p>
                  <p className="mt-0.5 text-[10px] text-faint">
                    {request.requested_action} · {formatDateTime(request.created_at)}
                  </p>
                </div>
                <span className="chip border-line bg-raised/70 text-muted">{request.decision}</span>
                <span className="font-mono text-[10px] text-muted">{request.risk_score.toFixed(0)}</span>
                <ArrowUpRight size={12} className="text-faint" />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
