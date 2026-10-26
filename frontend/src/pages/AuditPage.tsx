import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CheckCircle2,
  Download,
  FileCheck2,
  Fingerprint,
  Link2,
  RefreshCw,
  ShieldAlert,
  SlidersHorizontal,
  XCircle,
} from "lucide-react";
import { api, messageFromError } from "../services/api";
import { useAuditEntries } from "../hooks/queries";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useToast } from "../hooks/useToast";
import {
  Badge,
  Button,
  Callout,
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
  Spinner,
} from "../components/ui";
import type { AuditEntry } from "../types/api";
import { cn, formatDateTime, formatNumber, rangeStartIso, titleCase } from "../lib/utils";

const PAGE_SIZE = 25;

const AUDIT_ACTIONS = [
  "ACCESS_DECISION",
  "LOGIN_SUCCESS",
  "LOGIN_FAILED",
  "LOGOUT",
  "POLICY_VERSION_CREATED",
  "DEVICE_ENROLLED",
  "DEVICE_STATE_CHANGED",
  "DEVICE_REVOKED",
  "INCIDENT_CREATED",
  "INCIDENT_ESCALATED",
  "INCIDENT_UPDATED",
  "INCIDENT_NOTE_ADDED",
  "SESSION_REVOKED",
  "DEMO_SCENARIO_RUN",
  "DEMO_RESET",
  "MODEL_RETRAINED",
  "EXPORT_ACCESS_REQUESTS",
  "EXPORT_AUDIT_LOG",
  "DEMO_DATA_SEEDED",
];

const TARGET_TYPES = [
  "identity",
  "session",
  "access_request",
  "access_requests",
  "access_policy",
  "device",
  "incident",
  "model",
  "demo",
  "environment",
  "audit_log",
];

export default function AuditPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [targetType, setTargetType] = useState("");
  const [range, setRange] = useState(168);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditEntry | null>(null);
  const [exporting, setExporting] = useState(false);
  const debounced = useDebouncedValue(search);

  const fromTime = useMemo(() => (range ? rangeStartIso(range) : undefined), [range]);
  const params = {
    q: debounced || undefined,
    action: action || undefined,
    target_type: targetType || undefined,
    from_time: fromTime,
    page,
    page_size: PAGE_SIZE,
  };
  const audit = useAuditEntries(params);
  const verify = useQuery({
    queryKey: ["audit-verify"],
    queryFn: api.verifyAudit,
    refetchOnWindowFocus: false,
  });
  const rows = audit.data?.items ?? [];

  const setFilter = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      await api.exportAudit({
        q: debounced || undefined,
        action: action || undefined,
        target_type: targetType || undefined,
        from_time: fromTime,
      });
      toast.success("Audit export generated", "The export itself was appended to the audit chain.");
      void verify.refetch();
    } catch (error) {
      toast.error("Export failed", messageFromError(error));
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Tamper-evident evidence"
        title="Audit ledger"
        description="Every privileged action is append-only and linked by SHA-256. Verification recomputes the full chain and identifies the first broken record."
        meta={
          <>
            <Badge tone="accent">{audit.data ? `${formatNumber(audit.data.total, 0)} records` : "—"}</Badge>
            <span className="text-[10px] text-faint">Exports are audited; demo reset never erases history</span>
          </>
        }
        actions={
          <Button variant="secondary" onClick={() => void exportCsv()} loading={exporting}>
            <Download size={14} /> Export CSV
          </Button>
        }
      />

      <div className="mb-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel
          className={cn(
            "overflow-hidden border-l-2 p-4 sm:p-5",
            verify.data?.valid === false ? "border-l-critical" : verify.data?.valid ? "border-l-low" : "border-l-line",
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl border",
                  verify.data?.valid === false
                    ? "border-critical/30 bg-critical/10 text-critical"
                    : "border-low/30 bg-low/10 text-low",
                )}
              >
                {verify.isLoading ? (
                  <Spinner size={17} />
                ) : verify.data?.valid === false ? (
                  <XCircle size={18} />
                ) : (
                  <CheckCircle2 size={18} />
                )}
              </span>
              <div>
                <p className="eyebrow">Hash-chain integrity</p>
                <p className="mt-1 font-display text-lg font-semibold text-ink">
                  {verify.isLoading
                    ? "Verifying ledger…"
                    : verify.isError
                      ? "Verification unavailable"
                      : verify.data?.valid
                        ? "Chain verified"
                        : "Chain integrity violation"}
                </p>
                <p className="mt-1 max-w-xl text-[11px] leading-5 text-muted">
                  {verify.isError
                    ? messageFromError(verify.error)
                    : verify.data?.message ?? "Checking every record hash and predecessor link."}
                </p>
                {verify.data?.first_invalid_id && (
                  <p className="mt-1 font-mono text-[10px] text-critical">
                    First invalid record: {verify.data.first_invalid_id}
                  </p>
                )}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => void verify.refetch()} loading={verify.isFetching}>
              <RefreshCw size={12} /> Re-verify
            </Button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <KeyValue
              label="Records checked"
              value={verify.data ? formatNumber(verify.data.checked_records, 0) : "—"}
            />
            <KeyValue
              label="Algorithm"
              value="SHA-256 · linked predecessor"
              mono
            />
          </div>
        </Panel>

        <Callout tone={verify.data?.valid === false ? "danger" : "info"} icon={<Fingerprint size={15} />} title="What verification proves">
          The chain is self-consistent from genesis to head. It detects after-the-fact edits or deletions within the
          stored ledger; it does not replace external notarization or backup controls.
        </Callout>
      </div>

      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line/60 p-3">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Search actor, target, correlation, metadata…"
            className="min-w-[230px] flex-1 sm:max-w-sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            <SlidersHorizontal size={13} className="hidden text-faint sm:block" />
            <SelectInput className="h-9 w-[190px] text-xs" value={action} onChange={(event) => setFilter(setAction, event.target.value)}>
              <option value="">All actions</option>
              {AUDIT_ACTIONS.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </SelectInput>
            <SelectInput className="h-9 w-[150px] text-xs" value={targetType} onChange={(event) => setFilter(setTargetType, event.target.value)}>
              <option value="">All targets</option>
              {TARGET_TYPES.map((value) => (
                <option key={value} value={value}>{titleCase(value)}</option>
              ))}
            </SelectInput>
            <SelectInput
              className="h-9 w-[115px] text-xs"
              value={range}
              onChange={(event) => {
                setRange(Number(event.target.value));
                setPage(1);
              }}
            >
              <option value={24}>Last 24h</option>
              <option value={168}>Last 7d</option>
              <option value={720}>Last 30d</option>
              <option value={0}>All time</option>
            </SelectInput>
          </div>
        </div>

        {audit.isError ? (
          <ErrorState message={audit.error.message} onRetry={() => void audit.refetch()} />
        ) : audit.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 9 }).map((_, index) => (
              <div key={index} className="skeleton h-11" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<FileCheck2 size={18} />}
            title="No audit records match"
            description="Broaden the time range or filters. Audit history is preserved across demo resets."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Seq</th>
                    <th>When</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th className="hidden lg:table-cell">Target</th>
                    <th>Result</th>
                    <th className="hidden xl:table-cell">Record hash</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((entry) => (
                    <tr key={entry.id} className="group cursor-pointer" onClick={() => setSelected(entry)}>
                      <td className="font-mono text-[10px] text-faint">#{entry.sequence}</td>
                      <td className="whitespace-nowrap text-[10px] text-muted">{formatDateTime(entry.timestamp)}</td>
                      <td>
                        <p className="max-w-[160px] truncate text-[11px] text-ink">{entry.actor_label}</p>
                        <p className="max-w-[160px] truncate font-mono text-[8px] text-faint">{entry.actor_id ?? "system"}</p>
                      </td>
                      <td>
                        <p className="font-mono text-[10px] text-accent">{entry.action}</p>
                        {entry.policy_version && <p className="font-mono text-[8px] text-faint">{entry.policy_version}</p>}
                      </td>
                      <td className="hidden lg:table-cell">
                        <p className="text-[10px] text-muted">{titleCase(entry.target_type)}</p>
                        <p className="max-w-[150px] truncate font-mono text-[8px] text-faint">{entry.target_id ?? "—"}</p>
                      </td>
                      <td>
                        <Badge tone={entry.result === "SUCCESS" ? "low" : "critical"}>{entry.result}</Badge>
                      </td>
                      <td className="hidden xl:table-cell">
                        <span className="font-mono text-[9px] text-faint">{entry.record_hash.slice(0, 16)}…</span>
                      </td>
                      <td><ArrowUpRight size={13} className="text-faint transition group-hover:text-accent" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={audit.data?.page ?? 1}
              pageSize={audit.data?.page_size ?? PAGE_SIZE}
              total={audit.data?.total ?? 0}
              onPage={setPage}
            />
          </>
        )}
      </div>

      <Drawer open={Boolean(selected)} onClose={() => setSelected(null)} title="Audit record" eyebrow="Tamper-evident ledger">
        {selected && <AuditEvidence entry={selected} />}
      </Drawer>
    </>
  );
}

function AuditEvidence({ entry }: { entry: AuditEntry }) {
  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={entry.result === "SUCCESS" ? "low" : "critical"}>{entry.result}</Badge>
          <Badge tone="accent">Sequence #{entry.sequence}</Badge>
          {entry.policy_version && <Badge tone="violet">{entry.policy_version}</Badge>}
        </div>
        <p className="mt-2 font-mono text-sm font-semibold text-ink">{entry.action}</p>
        <p className="mt-1 text-[11px] text-muted">
          {entry.actor_label} · {formatDateTime(entry.timestamp)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <KeyValue label="Record ID" value={<CopyInline value={entry.id} />} />
        <KeyValue label="Target type" value={titleCase(entry.target_type)} />
        <KeyValue label="Target ID" value={entry.target_id ? <CopyInline value={entry.target_id} /> : "—"} />
        <KeyValue label="Actor ID" value={entry.actor_id ? <CopyInline value={entry.actor_id} /> : "System"} />
        <KeyValue label="Correlation" value={<CopyInline value={entry.correlation_id} />} />
        <KeyValue label="Policy version" value={entry.policy_version ?? "—"} mono />
      </div>

      <section>
        <div className="mb-2 flex items-center gap-2">
          <Link2 size={14} className="text-accent" />
          <h3 className="eyebrow">Hash chain</h3>
        </div>
        <div className="space-y-3 rounded-xl border border-line/65 bg-canvas/40 p-3">
          <div>
            <p className="text-[9px] uppercase tracking-wider text-faint">Previous hash</p>
            <p className="mt-1 break-all font-mono text-[10px] text-muted">{entry.prev_hash}</p>
          </div>
          <div className="flex items-center gap-2 text-[9px] text-faint">
            <span className="h-px flex-1 bg-line" />
            SHA-256
            <span className="h-px flex-1 bg-line" />
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider text-faint">Record hash</p>
            <p className="mt-1 break-all font-mono text-[10px] text-accent">{entry.record_hash}</p>
          </div>
        </div>
      </section>

      <section>
        <h3 className="eyebrow mb-2">Metadata</h3>
        <div className="rounded-lg border border-line/60 bg-canvas/40 p-3">
          {Object.keys(entry.metadata_json ?? {}).length === 0 ? (
            <p className="text-[11px] text-muted">No metadata payload.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(entry.metadata_json).map(([key, value]) => (
                <div key={key} className="grid grid-cols-[130px_1fr] gap-2 border-b border-line/30 pb-2 last:border-0 last:pb-0">
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

      <Callout tone="info" icon={<ShieldAlert size={15} />} title="Investigation note">
        This record is immutable. To correct a mistaken action, create a new compensating action rather than editing
        history.
      </Callout>
    </div>
  );
}
