import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CheckCircle2,
  Download,
  Gauge,
  KeyRound,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  XCircle,
} from "lucide-react";
import { api, messageFromError } from "../services/api";
import { useAccessRequest, useAccessRequests, useDevices, useIdentities, useIdentity, useResources } from "../hooks/queries";
import { useAuth } from "../hooks/useAuth";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useToast } from "../hooks/useToast";
import {
  Avatar,
  Badge,
  Button,
  Callout,
  CopyInline,
  DecisionBadge,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  KeyValue,
  Modal,
  PageHeader,
  Pagination,
  Panel,
  RiskBadge,
  RiskGauge,
  SearchInput,
  SelectInput,
  SimulatedTag,
  Spinner,
  Toggle,
} from "../components/ui";
import {
  ANOMALOUS_FEATURES,
  DECISION_ORDER,
  ELEVATED_FEATURES,
  FEATURE_PRESETS,
  NORMAL_FEATURES,
  RISK_ORDER,
  REASON_EXPLANATIONS,
} from "../lib/constants";
import { FEATURE_FIELDS } from "../lib/features";
import {
  cn,
  compactNumber,
  formatDateTime,
  formatNumber,
  rangeStartIso,
  riskTone,
  ROLE_LABELS,
  titleCase,
} from "../lib/utils";
import type {
  Action,
  BehaviorFeatures,
  Decision,
  DecisionResult,
  EvaluateAccessPayload,
  RiskCategory,
} from "../types/api";

const PAGE_SIZE = 20;

const ACTIONS: Action[] = ["READ", "WRITE", "DELETE", "ADMIN"];

export default function AccessDecisionsPage() {
  const { me, isStaff } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [decision, setDecision] = useState<Decision | "">("");
  const [risk, setRisk] = useState<RiskCategory | "">("");
  const [timeRange, setTimeRange] = useState(0);
  const [page, setPage] = useState(1);
  const [identityFilter, setIdentityFilter] = useState(searchParams.get("identity") ?? "");
  const [exporting, setExporting] = useState(false);
  const [evalOpen, setEvalOpen] = useState(searchParams.get("evaluate") === "1");
  const [evalIdentity, setEvalIdentity] = useState(searchParams.get("identity") ?? "");
  const debounced = useDebouncedValue(search);

  useEffect(() => {
    setPage(1);
  }, [debounced, decision, risk, timeRange, identityFilter]);

  const timeStart = useMemo(() => (timeRange ? rangeStartIso(timeRange) : undefined), [timeRange]);
  const params = useMemo(
    () => ({
      q: debounced || undefined,
      decision: decision || undefined,
      risk_category: risk || undefined,
      identity_id: identityFilter || undefined,
      from_time: timeStart,
      page,
      page_size: PAGE_SIZE,
    }),
    [debounced, decision, risk, identityFilter, timeStart, page],
  );

  const access = useAccessRequests(params);
  const identityContext = useIdentity(identityFilter || undefined);
  const detailId = searchParams.get("request") ?? undefined;
  const detail = useAccessRequest(detailId);

  const canEvaluate = me?.role === "SECURITY_ADMIN" || me?.role === "SECURITY_ANALYST";
  const canExport = isStaff;
  const rows = access.data?.items ?? [];

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const openDetail = (id: string) => setParam("request", id);
  const closeDetail = () => setParam("request", null);

  const clearIdentity = () => {
    setIdentityFilter("");
    setParam("identity", null);
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      await api.exportAccessRequests(params);
      toast.success("Export generated", "The CSV download also appended an audit record.");
    } catch (error) {
      toast.error("Export failed", messageFromError(error));
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Zero-trust enforcement"
        title="Access decisions"
        description="Every evaluation combines identity, device posture, policy constraints, and explainable behavioral risk. Mandatory denials cannot be overridden by lower risk."
        meta={
          <>
            <Badge tone="accent">{access.data ? compactNumber(access.data.total) : "—"} recorded decisions</Badge>
            <span className="text-[10px] text-faint">Policy engine is the final authority</span>
          </>
        }
        actions={
          <>
            {canExport && (
              <Button variant="secondary" onClick={() => void exportCsv()} loading={exporting}>
                <Download size={14} /> Export CSV
              </Button>
            )}
            {canEvaluate && (
              <Button
                variant="solid"
                onClick={() => {
                  setEvalIdentity(identityFilter || "");
                  setEvalOpen(true);
                }}
              >
                <ShieldAlert size={14} /> Evaluate access
              </Button>
            )}
          </>
        }
      />

      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line/60 p-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search identity, resource, request ID…"
            className="min-w-[230px] flex-1 sm:max-w-sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            <SlidersHorizontal size={13} className="hidden text-faint sm:block" />
            <SelectInput className="h-9 w-[130px] text-xs" value={decision} onChange={(event) => setDecision(event.target.value as Decision | "")}>
              <option value="">All decisions</option>
              {DECISION_ORDER.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </SelectInput>
            <SelectInput className="h-9 w-[125px] text-xs" value={risk} onChange={(event) => setRisk(event.target.value as RiskCategory | "")}>
              <option value="">All risk</option>
              {RISK_ORDER.map((value) => (
                <option key={value} value={value}>{titleCase(value)}</option>
              ))}
            </SelectInput>
            <SelectInput className="h-9 w-[120px] text-xs" value={timeRange} onChange={(event) => setTimeRange(Number(event.target.value))}>
              <option value={0}>All time</option>
              <option value={24}>Last 24h</option>
              <option value={168}>Last 7d</option>
            </SelectInput>
          </div>
        </div>

        {identityFilter && (
          <div className="flex flex-wrap items-center gap-2 border-b border-line/50 bg-accent/[0.045] px-3 py-2">
            <span className="text-[10px] text-muted">Filtered to identity</span>
            <Badge tone="accent">{identityContext.data?.display_name ?? identityFilter}</Badge>
            {identityContext.data && (
              <Link to={`/identities/${identityContext.data.id}`} className="text-[10px] text-accent hover:underline">
                open dossier
              </Link>
            )}
            <button type="button" onClick={clearIdentity} className="ml-auto text-[10px] text-faint hover:text-ink">
              Clear filter
            </button>
          </div>
        )}

        {access.isError ? (
          <ErrorState message={access.error.message} onRetry={() => void access.refetch()} />
        ) : access.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="skeleton h-12" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<KeyRound size={18} />}
            title="No access decisions match"
            description="Broaden the filters or run a new policy evaluation."
            action={canEvaluate ? <Button variant="secondary" size="sm" onClick={() => setEvalOpen(true)}>Evaluate access</Button> : undefined}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Identity</th>
                    <th>Resource</th>
                    <th>Action</th>
                    <th>Decision</th>
                    <th>Risk</th>
                    <th className="hidden lg:table-cell">Policy</th>
                    <th className="hidden md:table-cell">When</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((request) => (
                    <tr key={request.id} className="group cursor-pointer" onClick={() => openDetail(request.id)}>
                      <td>
                        <div className="flex items-center gap-2">
                          <Avatar name={request.identity_name} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-ink group-hover:text-accent">
                              {request.identity_name}
                            </p>
                            <p className="truncate text-[9px] text-faint">{request.identity_email}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <p className="text-xs text-ink">{request.resource_name}</p>
                        <p className="font-mono text-[9px] text-faint">{request.resource_key}</p>
                      </td>
                      <td><Badge>{request.requested_action}</Badge></td>
                      <td><DecisionBadge decision={request.decision} /></td>
                      <td><RiskBadge score={request.risk_score} /></td>
                      <td className="hidden font-mono text-[9px] text-faint lg:table-cell">{request.policy_version}</td>
                      <td className="hidden text-[11px] text-muted md:table-cell">{formatDateTime(request.created_at)}</td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <SimulatedTag value={request.is_simulated} />
                          <ArrowUpRight size={13} className="text-faint transition group-hover:text-accent" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={access.data?.page ?? 1}
              pageSize={access.data?.page_size ?? PAGE_SIZE}
              total={access.data?.total ?? 0}
              onPage={setPage}
            />
          </>
        )}
      </div>

      <Drawer
        open={Boolean(detailId)}
        onClose={closeDetail}
        title={detail.data ? `${detail.data.resource_name} decision` : "Decision evidence"}
        eyebrow="Access evidence"
      >
        {detail.isLoading ? (
          <div className="space-y-3">
            <div className="skeleton h-28" />
            <div className="skeleton h-40" />
            <div className="skeleton h-32" />
          </div>
        ) : detail.isError ? (
          <ErrorState message={detail.error.message} onRetry={() => void detail.refetch()} />
        ) : detail.data ? (
          <AccessEvidence detail={detail.data} />
        ) : null}
      </Drawer>

      {canEvaluate && (
        <EvaluationModal
          open={evalOpen}
          onClose={() => {
            setEvalOpen(false);
            setParam("evaluate", null);
          }}
          initialIdentity={evalIdentity}
          onOpenEvidence={(id) => {
            setEvalOpen(false);
            setParam("evaluate", null);
            openDetail(id);
          }}
        />
      )}
    </>
  );
}

function AccessEvidence({ detail }: { detail: NonNullable<ReturnType<typeof useAccessRequest>["data"]> }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line/65 bg-raised/40 p-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <DecisionBadge decision={detail.decision} />
            <SimulatedTag value={detail.is_simulated} />
          </div>
          <p className="mt-2 text-sm font-semibold text-ink">
            {detail.identity_name} → {detail.resource_name}
          </p>
          <p className="mt-0.5 text-[11px] text-muted">
            {detail.requested_action} · {formatDateTime(detail.created_at)}
          </p>
          <p className="mt-2 text-[11px] leading-5 text-muted">{detail.recommended_action}</p>
        </div>
        <RiskGauge score={detail.risk_score} size={112} />
      </div>

      <section>
        <h3 className="eyebrow mb-2">Decision reasons</h3>
        <div className="space-y-2">
          {detail.reasons.length === 0 ? (
            <p className="rounded-lg border border-line/60 p-3 text-xs text-muted">No reasons were recorded.</p>
          ) : (
            detail.reasons.map((reason, index) => (
              <div key={`${reason.code}-${index}`} className="rounded-lg border border-line/65 bg-raised/30 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] font-semibold text-accent">{reason.code}</span>
                  <Badge tone={reason.severity === "CRITICAL" || reason.severity === "HIGH" ? "critical" : "neutral"}>
                    {reason.severity ?? "INFO"}
                  </Badge>
                </div>
                <p className="mt-1.5 text-[11px] leading-5 text-ink">{reason.message}</p>
                {REASON_EXPLANATIONS[reason.code] && (
                  <p className="mt-1 text-[10px] leading-4 text-faint">{REASON_EXPLANATIONS[reason.code]}</p>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      <section>
        <h3 className="eyebrow mb-2">Behavioral contributors</h3>
        {detail.feature_summary.length === 0 ? (
          <p className="rounded-lg border border-line/60 p-3 text-xs text-muted">
            No feature crossed the explanation threshold.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {detail.feature_summary.map((factor) => (
              <div key={factor.feature} className="rounded-lg border border-line/65 bg-raised/30 p-3">
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
      </section>

      <section className="grid grid-cols-2 gap-3">
        <KeyValue label="Risk index" value={`${detail.risk_score.toFixed(2)} / 100`} />
        <KeyValue label="Risk tier" value={detail.risk_category} />
        <KeyValue label="Anomaly score" value={detail.anomaly_score.toFixed(5)} />
        <KeyValue label="Policy version" value={detail.policy_version} mono />
        <KeyValue label="Model version" value={detail.model_version ?? "—"} mono />
        <KeyValue label="Device" value={detail.device_name ?? "None supplied"} />
        <KeyValue label="Request ID" value={<CopyInline value={detail.id} />} />
        <KeyValue label="Correlation" value={<CopyInline value={detail.correlation_id} />} />
      </section>

      <section>
        <h3 className="eyebrow mb-2">Raw feature vector</h3>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg border border-line/60 bg-canvas/40 p-3">
          {Object.entries(detail.features).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between gap-2 text-[10px]">
              <span className="truncate font-mono text-faint">{key}</span>
              <span className="font-mono text-ink">
                {typeof value === "boolean" ? String(value) : Number(value).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function EvaluationModal({
  open,
  onClose,
  initialIdentity,
  onOpenEvidence,
}: {
  open: boolean;
  onClose: () => void;
  initialIdentity: string;
  onOpenEvidence: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [identityId, setIdentityId] = useState(initialIdentity);
  const [resourceId, setResourceId] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [action, setAction] = useState<Action>("READ");
  const [features, setFeatures] = useState<BehaviorFeatures>({ ...NORMAL_FEATURES });
  const [simulate, setSimulate] = useState(true);
  const [preset, setPreset] = useState("normal");
  const [result, setResult] = useState<DecisionResult | null>(null);

  const identities = useIdentities({ page: 1, page_size: 100 }, open);
  const resources = useResources({}, open);
  const devices = useDevices({ identity_id: identityId, page: 1, page_size: 100 }, open && Boolean(identityId));
  const selectedIdentity = identities.data?.items.find((item) => item.id === identityId);

  useEffect(() => {
    if (open) {
      setIdentityId(initialIdentity);
      setResult(null);
    }
  }, [open, initialIdentity]);

  const mutation = useMutation({
    mutationFn: api.evaluateAccess,
    onSuccess: (data) => {
      setResult(data);
      void queryClient.invalidateQueries({ queryKey: ["access"] });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
      void queryClient.invalidateQueries({ queryKey: ["incidents"] });
      void queryClient.invalidateQueries({ queryKey: ["events"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["identities"] });
      void queryClient.invalidateQueries({ queryKey: ["identity"] });
      toast.success(`Decision: ${data.decision}`, `${data.risk_score.toFixed(0)} risk · ${data.request_id}`);
    },
    onError: (error) => toast.error("Evaluation failed", messageFromError(error)),
  });

  const setFeatureNumber = (key: keyof BehaviorFeatures, raw: string) => {
    setFeatures((current) => ({ ...current, [key]: Number(raw) }));
    setPreset("custom");
  };

  const setFeatureBoolean = (key: keyof BehaviorFeatures, value: boolean) => {
    setFeatures((current) => ({ ...current, [key]: value }));
    setPreset("custom");
  };

  const submit = () => {
    if (!identityId || !resourceId) return;
    const payload: EvaluateAccessPayload = {
      identity_id: identityId,
      resource_id: resourceId,
      device_id: deviceId || null,
      requested_action: action,
      features,
      simulate,
    };
    mutation.mutate(payload);
  };

  const resetForm = () => {
    setResult(null);
    setResourceId("");
    setDeviceId("");
    setAction("READ");
    setFeatures({ ...NORMAL_FEATURES });
    setPreset("normal");
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={result ? "Access decision" : "Evaluate access"}
      description={
        result
          ? "The decision and its evidence were persisted, audited, and broadcast."
          : "Submit behavioral features with identity and resource context. The backend enforces role boundaries and policy."
      }
      size="xl"
      footer={
        result ? (
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={resetForm}>New evaluation</Button>
            <Button variant="secondary" onClick={onClose}>Close</Button>
            <Button variant="primary" onClick={() => onOpenEvidence(result.request_id)}>
              Open evidence <ArrowUpRight size={13} />
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] text-faint">Risk cannot grant access; policy remains authoritative.</span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button
                variant="solid"
                onClick={submit}
                loading={mutation.isPending}
                disabled={!identityId || !resourceId}
              >
                Evaluate decision
              </Button>
            </div>
          </div>
        )
      }
    >
      {result ? (
        <DecisionResultView result={result} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_1.15fr]">
          <div className="space-y-4">
            <div>
              <p className="eyebrow mb-2">Subject and resource</p>
              <div className="space-y-3">
                <Field label="Identity" hint={selectedIdentity ? `${selectedIdentity.email} · ${ROLE_LABELS[selectedIdentity.role]}` : "Choose the subject"}>
                  <SelectInput
                    value={identityId}
                    onChange={(event) => {
                      setIdentityId(event.target.value);
                      setDeviceId("");
                    }}
                  >
                    <option value="">Select identity…</option>
                    {identities.data?.items.map((identity) => (
                      <option key={identity.id} value={identity.id}>
                        {identity.display_name} · {ROLE_LABELS[identity.role]} {identity.status !== "ACTIVE" ? "(disabled)" : ""}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Resource">
                  <SelectInput value={resourceId} onChange={(event) => setResourceId(event.target.value)}>
                    <option value="">Select resource…</option>
                    {resources.data?.filter((resource) => resource.is_active).map((resource) => (
                      <option key={resource.id} value={resource.id}>
                        {resource.name} · {resource.sensitivity}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field
                  label="Device"
                  hint={identityId && devices.data?.items.length === 0 ? "No enrolled devices for this identity." : "Optional context; policy may deny unlisted device states."}
                >
                  <SelectInput value={deviceId} onChange={(event) => setDeviceId(event.target.value)} disabled={!identityId}>
                    <option value="">No device context</option>
                    {devices.data?.items.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.name} · {device.state}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Requested action">
                    <SelectInput value={action} onChange={(event) => setAction(event.target.value as Action)}>
                      {ACTIONS.map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </SelectInput>
                  </Field>
                  <div className="flex items-end">
                    <Toggle
                      checked={simulate}
                      onChange={setSimulate}
                      label="Simulated drill"
                      description="Marks this evaluation as demo activity."
                    />
                  </div>
                </div>
              </div>
            </div>

            <Callout tone="info" title="Backend boundaries">
              Evaluations are scoped and role-guarded server-side. Auditors cannot evaluate, and employees
              can only request access for themselves.
            </Callout>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="eyebrow">Behavioral features</p>
              <div className="flex flex-wrap gap-1">
                {FEATURE_PRESETS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setFeatures({ ...option.features });
                      setPreset(option.id);
                    }}
                    className={cn(
                      "rounded-md border px-2 py-1 text-[9px] font-medium transition",
                      preset === option.id
                        ? "border-accent/40 bg-accent/10 text-accent"
                        : "border-line bg-raised/50 text-muted hover:text-ink",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
                {preset === "custom" && <span className="rounded-md border border-medium/30 bg-medium/10 px-2 py-1 text-[9px] text-medium">Custom</span>}
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {FEATURE_FIELDS.filter((field) => field.type !== "boolean").map((field) => (
                <Field key={field.key} label={field.label} hint={field.hint}>
                  <input
                    type="number"
                    className="input"
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    value={Number(features[field.key])}
                    onChange={(event) => setFeatureNumber(field.key, event.target.value)}
                  />
                </Field>
              ))}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Toggle
                checked={features.new_device}
                onChange={(value) => setFeatureBoolean("new_device", value)}
                label="New device"
                description="First observed within seven days"
              />
              <Toggle
                checked={features.geo_novelty}
                onChange={(value) => setFeatureBoolean("geo_novelty", value)}
                label="Novel geography"
                description="Simulated location novelty"
              />
            </div>
            {mutation.isError && (
              <div className="mt-3 rounded-lg border border-critical/30 bg-critical/10 p-3 text-[11px] text-critical">
                {messageFromError(mutation.error)}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function DecisionResultView({ result }: { result: DecisionResult }) {
  const category = riskTone(result.risk_score);
  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-5 rounded-xl border border-line/70 bg-raised/40 p-5 text-center sm:flex-row sm:text-left">
        <RiskGauge score={result.risk_score} size={138} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <DecisionBadge decision={result.decision} />
            <Badge tone={category.toLowerCase() as "low" | "medium" | "high" | "critical"}>{category}</Badge>
            <SimulatedTag value={result.is_simulated} />
          </div>
          <p className="mt-3 font-display text-xl font-semibold text-ink">
            {result.decision === "ALLOW" && "Access allowed by policy"}
            {result.decision === "CHALLENGE" && "Step-up verification required"}
            {result.decision === "RESTRICT" && "Identity restricted and sessions contained"}
            {result.decision === "DENY" && "Access denied by policy"}
          </p>
          <p className="mt-1.5 text-xs leading-5 text-muted">{result.recommended_next_step}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-3 text-[10px] text-faint sm:justify-start">
            <span>Anomaly {result.anomaly_score.toFixed(5)}</span>
            <span>·</span>
            <span className="font-mono">{result.policy_version}</span>
            <span>·</span>
            <span>{formatDateTime(result.timestamp)}</span>
          </div>
        </div>
      </div>

      <div>
        <p className="eyebrow mb-2">Policy reasons</p>
        <div className="space-y-2">
          {result.reasons.map((reason, index) => (
            <div key={`${reason.code}-${index}`} className="rounded-lg border border-line/65 bg-raised/30 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] font-semibold text-accent">{reason.code}</span>
                <Badge tone={reason.severity === "CRITICAL" || reason.severity === "HIGH" ? "critical" : "neutral"}>
                  {reason.severity ?? "INFO"}
                </Badge>
              </div>
              <p className="mt-1 text-[11px] leading-5 text-ink">{reason.message}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-xl border border-line/60 bg-canvas/35 p-4">
        <KeyValue label="Request ID" value={<CopyInline value={result.request_id} />} />
        <KeyValue label="Correlation" value={<CopyInline value={result.correlation_id} />} />
        <KeyValue label="Policy" value={result.policy_version} mono />
        <KeyValue label="Risk" value={`${result.risk_score.toFixed(2)} · ${result.risk_category}`} />
      </div>

      <Callout tone={result.decision === "ALLOW" ? "success" : "warning"} icon={result.decision === "ALLOW" ? <CheckCircle2 size={15} /> : <XCircle size={15} />}>
        The anomaly model only influenced risk. Mandatory controls and policy thresholds determined the final outcome.
      </Callout>
    </div>
  );
}
