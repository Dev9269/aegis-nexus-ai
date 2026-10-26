import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  BrainCircuit,
  FileCheck2,
  FlaskConical,
  KeyRound,
  Laptop,
  LogIn,
  Radio,
  Scale,
  Siren,
  SlidersHorizontal,
  Timer,
} from "lucide-react";
import { useEvents } from "../hooks/queries";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import {
  Badge,
  CopyInline,
  Drawer,
  EmptyState,
  ErrorState,
  KeyValue,
  PageHeader,
  Pagination,
  Panel,
  SearchInput,
  SelectInput,
  SeverityBadge,
  SimulatedTag,
} from "../components/ui";
import type { SecurityEvent, Severity } from "../types/api";
import { EVENT_CATEGORIES, SEVERITY_ORDER } from "../lib/constants";
import { cn, formatDateTime, formatRelativeTime, rangeStartIso } from "../lib/utils";

const PAGE_SIZE = 30;

const CATEGORY_ICONS: Record<string, typeof Activity> = {
  Authentication: LogIn,
  Access: KeyRound,
  Behavior: Activity,
  Device: Laptop,
  Incident: Siren,
  Policy: Scale,
  Session: Timer,
  Model: BrainCircuit,
  Audit: FileCheck2,
  Demo: FlaskConical,
};

export default function TimelinePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState<Severity | "">("");
  const [range, setRange] = useState(24);
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search);
  const eventId = searchParams.get("event") ?? undefined;

  useEffect(() => {
    setPage(1);
  }, [debounced, category, severity, range]);

  const fromTime = useMemo(() => rangeStartIso(range), [range]);
  const params = {
    q: debounced || undefined,
    category: category || undefined,
    severity: severity || undefined,
    from_time: fromTime,
    page,
    page_size: PAGE_SIZE,
  };
  const events = useEvents(params);
  const rows = events.data?.items ?? [];
  const selected = rows.find((event) => event.id === eventId);
  const categories = new Set(rows.map((event) => event.category)).size;

  const setEventParam = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set("event", id);
    else next.delete("event");
    setSearchParams(next, { replace: true });
  };

  return (
    <>
      <PageHeader
        eyebrow="Security telemetry"
        title="Event timeline"
        description="A live, append-only stream of authentication, access, behavioral, device, policy, incident, and demo activity."
        meta={
          <>
            <Badge tone="low" dot>Live stream</Badge>
            <Badge tone="accent">{events.data ? `${events.data.total} events` : "—"}</Badge>
            <span className="text-[10px] text-faint">{categories} categories in view</span>
          </>
        }
        actions={
          <Link to="/audit" className="btn-secondary">
            <FileCheck2 size={14} /> Audit ledger
          </Link>
        }
      />

      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line/60 p-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search summaries, event types, categories…"
            className="min-w-[230px] flex-1 sm:max-w-sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            <SlidersHorizontal size={13} className="hidden text-faint sm:block" />
            <SelectInput className="h-9 w-[140px] text-xs" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">All categories</option>
              {EVENT_CATEGORIES.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </SelectInput>
            <SelectInput
              className="h-9 w-[120px] text-xs"
              value={severity}
              onChange={(event) => setSeverity(event.target.value as Severity | "")}
            >
              <option value="">All severity</option>
              {[...SEVERITY_ORDER].reverse().map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </SelectInput>
            <SelectInput className="h-9 w-[115px] text-xs" value={range} onChange={(event) => setRange(Number(event.target.value))}>
              <option value={1}>Last hour</option>
              <option value={6}>Last 6h</option>
              <option value={24}>Last 24h</option>
              <option value={72}>Last 3d</option>
              <option value={168}>Last 7d</option>
            </SelectInput>
          </div>
        </div>

        {events.isError ? (
          <ErrorState message={events.error.message} onRetry={() => void events.refetch()} />
        ) : events.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="skeleton h-16" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Radio size={18} />}
            title="No events in this window"
            description="Broaden the time range, clear filters, or run a demo scenario to generate telemetry."
            action={<Link to="/demo" className="btn-secondary btn-sm">Open demo lab</Link>}
          />
        ) : (
          <>
            <div className="relative">
              <span className="absolute bottom-0 left-[54px] top-0 hidden w-px bg-line/55 sm:block" />
              {rows.map((event) => {
                const Icon = CATEGORY_ICONS[event.category] ?? Activity;
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => setEventParam(event.id)}
                    className="group flex w-full gap-3 border-b border-line/40 px-3 py-3 text-left transition last:border-0 hover:bg-raised/35 sm:gap-4 sm:px-4"
                  >
                    <span className="hidden w-[76px] shrink-0 pt-0.5 text-right sm:block">
                      <span className="block font-mono text-[9px] text-faint">
                        {new Date(event.timestamp).toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                      <span className="mt-0.5 block text-[9px] text-faint">
                        {formatRelativeTime(event.timestamp)}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-surface",
                        event.severity === "CRITICAL" && "border-critical/40 text-critical",
                        event.severity === "HIGH" && "border-high/40 text-high",
                        event.severity === "MEDIUM" && "border-medium/40 text-medium",
                        event.severity === "LOW" && "border-low/40 text-low",
                      )}
                    >
                      <Icon size={13} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-ink group-hover:text-accent">{event.summary}</span>
                        <SeverityBadge severity={event.severity} />
                        <SimulatedTag value={event.is_simulated} />
                      </span>
                      <span className="mt-0.5 block text-[10px] text-faint">
                        {event.category} · {event.event_type}
                        {event.policy_version ? ` · ${event.policy_version}` : ""}
                      </span>
                      {Boolean(event.details?.message) && (
                        <span className="mt-1 block truncate text-[11px] text-muted">{String(event.details.message)}</span>
                      )}
                    </span>
                    <ArrowUpRight size={13} className="mt-1 shrink-0 text-faint transition group-hover:text-accent" />
                  </button>
                );
              })}
            </div>
            <Pagination
              page={events.data?.page ?? 1}
              pageSize={events.data?.page_size ?? PAGE_SIZE}
              total={events.data?.total ?? 0}
              onPage={setPage}
            />
          </>
        )}
      </div>

      <Drawer
        open={Boolean(eventId)}
        onClose={() => setEventParam(null)}
        title="Event evidence"
        eyebrow="Security telemetry"
      >
        {selected ? (
          <EventEvidence event={selected} />
        ) : (
          <EmptyState
            icon={<Radio size={18} />}
            title="Event not in this window"
            description="The linked event is outside the current page or filters. Adjust filters to locate it."
          />
        )}
      </Drawer>
    </>
  );
}

function EventEvidence({ event }: { event: SecurityEvent }) {
  const links = [
    event.identity_id && { to: `/identities/${event.identity_id}`, label: "Identity dossier" },
    event.access_request_id && { to: `/access?request=${event.access_request_id}`, label: "Access decision" },
    event.incident_id && { to: `/incidents?incident=${event.incident_id}`, label: "Incident case" },
  ].filter(Boolean) as Array<{ to: string; label: string }>;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={event.severity} />
          <Badge tone="accent">{event.category}</Badge>
          <SimulatedTag value={event.is_simulated} />
        </div>
        <h2 className="mt-2 font-display text-base font-semibold leading-6 text-ink">{event.summary}</h2>
        <p className="mt-1 font-mono text-[10px] text-faint">{event.event_type}</p>
        <p className="mt-1 text-[10px] text-faint">{formatDateTime(event.timestamp)}</p>
      </div>

      {links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {links.map((link) => (
            <Link key={link.to} to={link.to} className="btn-secondary btn-sm">
              {link.label} <ArrowUpRight size={12} />
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <KeyValue label="Event ID" value={<CopyInline value={event.id} />} />
        <KeyValue label="Correlation" value={<CopyInline value={event.correlation_id} />} />
        <KeyValue label="Policy version" value={event.policy_version ?? "—"} mono />
        <KeyValue label="Actor" value={event.actor_id ?? "System"} mono />
        <KeyValue label="Identity" value={event.identity_id ?? "—"} mono />
        <KeyValue label="Device" value={event.device_id ?? "—"} mono />
      </div>

      <section>
        <h3 className="eyebrow mb-2">Structured details</h3>
        <div className="rounded-lg border border-line/60 bg-canvas/40 p-3">
          {Object.keys(event.details ?? {}).length === 0 ? (
            <p className="text-[11px] text-muted">No structured details.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(event.details).map(([key, value]) => (
                <div key={key} className="grid grid-cols-[120px_1fr] gap-2 border-b border-line/30 pb-2 last:border-0 last:pb-0">
                  <span className="break-words font-mono text-[10px] text-faint">{key}</span>
                  <span className="break-words font-mono text-[10px] text-ink">
                    {typeof value === "object" && value !== null ? JSON.stringify(value, null, 2) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
