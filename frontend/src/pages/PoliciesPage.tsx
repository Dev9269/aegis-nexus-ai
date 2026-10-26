import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  BookLock,
  Check,
  Eye,
  History,
  Info,
  PencilRuler,
  Play,
  ShieldQuestion,
  TriangleAlert,
} from "lucide-react";
import { api, messageFromError } from "../services/api";
import { usePolicyHistory, useResources } from "../hooks/queries";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import {
  Badge,
  Button,
  Callout,
  DecisionBadge,
  EmptyState,
  ErrorState,
  Field,
  LoadingPanel,
  Modal,
  PageHeader,
  Panel,
  SearchInput,
  SelectInput,
  SimulatedTag,
  Tabs,
  TextArea,
  Toggle,
} from "../components/ui";
import type {
  DeviceState,
  Policy,
  PolicyDraft,
  PolicyPreview,
  PolicyPreviewCase,
  ResourcePolicy,
  Role,
} from "../types/api";
import {
  cn,
  formatDateTime,
  ROLE_LABELS,
  titleCase,
} from "../lib/utils";

const ROLES: Role[] = ["SECURITY_ADMIN", "SECURITY_ANALYST", "EMPLOYEE", "AUDITOR"];
const DEVICE_STATES: DeviceState[] = ["TRUSTED", "UNVERIFIED", "RESTRICTED", "REVOKED"];

function draftFromPolicy(resource: ResourcePolicy): PolicyDraft {
  const policy = resource.policy;
  return {
    allowed_roles: policy ? [...policy.allowed_roles] : [...ROLES],
    allowed_device_states: policy ? [...policy.allowed_device_states] : ["TRUSTED", "UNVERIFIED"],
    challenge_threshold: policy?.challenge_threshold ?? 40,
    deny_threshold: policy?.deny_threshold ?? 70,
    require_additional_verification: policy?.require_additional_verification ?? true,
    session_max_minutes: policy?.session_max_minutes ?? 480,
    reason: "",
    is_active: true,
  };
}

export default function PoliciesPage() {
  const { me } = useAuth();
  const resources = useResources();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | undefined>();

  useEffect(() => {
    if (!selectedId && resources.data?.length) {
      setSelectedId(resources.data[0].id);
    }
  }, [resources.data, selectedId]);

  const selected = resources.data?.find((resource) => resource.id === selectedId);
  const filtered = resources.data?.filter((resource) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (
      resource.name.toLowerCase().includes(query) ||
      resource.key.toLowerCase().includes(query) ||
      resource.owner_department.toLowerCase().includes(query)
    );
  });

  const isAdmin = me?.role === "SECURITY_ADMIN";
  const canPreview = isAdmin || me?.role === "SECURITY_ANALYST";

  if (resources.isError) {
    return (
      <>
        <PageHeader eyebrow="Policy studio" title="Resource policies" />
        <ErrorState message={resources.error.message} onRetry={() => void resources.refetch()} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Policy studio"
        title="Resource policies"
        description="Tune mandatory controls and risk thresholds per resource. Every publish creates an immutable version, a security event, and an audit entry."
        meta={
          <>
            <Badge tone="accent">{resources.data?.length ?? "—"} resources</Badge>
            <Badge tone="low">Versioned</Badge>
            <span className="text-[10px] text-faint">
              {isAdmin ? "Admin editing enabled" : canPreview ? "Analyst preview only" : "Auditor read-only"}
            </span>
          </>
        }
      />

      {resources.isLoading ? (
        <LoadingPanel rows={6} label="Loading resource policies" />
      ) : !resources.data?.length ? (
        <EmptyState icon={<BookLock size={18} />} title="No resources" description="Seed demo data to create resources and policies." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[300px_1fr]">
          <Panel className="h-fit overflow-hidden">
            <div className="border-b border-line/60 p-3">
              <SearchInput value={search} onChange={setSearch} placeholder="Search resources…" />
            </div>
            <div className="scrollbar-thin max-h-[720px] overflow-y-auto">
              {filtered?.length === 0 ? (
                <EmptyState title="No matches" description="Try a different resource name." />
              ) : (
                filtered?.map((resource) => {
                  const active = selectedId === resource.id;
                  return (
                    <button
                      key={resource.id}
                      type="button"
                      onClick={() => setSelectedId(resource.id)}
                      className={cn(
                        "flex w-full items-start gap-2.5 border-b border-line/45 px-4 py-3 text-left transition last:border-0",
                        active ? "bg-accent/[0.07]" : "hover:bg-raised/45",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
                          resource.policy
                            ? "border-accent/25 bg-accent/10 text-accent"
                            : "border-critical/25 bg-critical/10 text-critical",
                        )}
                      >
                        {resource.policy ? <BadgeCheck size={14} /> : <ShieldQuestion size={14} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-medium text-ink">{resource.name}</span>
                        <span className="block truncate font-mono text-[9px] text-faint">{resource.key}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-1">
                          <Badge tone={resource.sensitivity.toLowerCase() as "low" | "medium" | "high" | "critical"}>
                            {resource.sensitivity}
                          </Badge>
                          <span className="text-[9px] text-faint">v{resource.version_count}</span>
                          {!resource.policy && <span className="text-[9px] text-critical">No active policy</span>}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </Panel>

          {selected ? (
            <PolicyEditor
              key={selected.id}
              resource={selected}
              isAdmin={isAdmin}
              canPreview={canPreview}
            />
          ) : (
            <Panel>
              <EmptyState title="Select a resource" description="Choose a resource to inspect or edit its policy." />
            </Panel>
          )}
        </div>
      )}
    </>
  );
}

function PolicyEditor({
  resource,
  isAdmin,
  canPreview,
}: {
  resource: ResourcePolicy;
  isAdmin: boolean;
  canPreview: boolean;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const history = usePolicyHistory(resource.id);
  const [tab, setTab] = useState<"editor" | "history">("editor");
  const [draft, setDraft] = useState<PolicyDraft>(() => draftFromPolicy(resource));
  const [preview, setPreview] = useState<PolicyPreview | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    setDraft(draftFromPolicy(resource));
    setPreview(null);
  }, [resource]);

  const validation = useMemo(() => {
    const issues: string[] = [];
    if (draft.allowed_roles.length === 0) issues.push("At least one role must be allowed.");
    if (draft.allowed_device_states.length === 0) issues.push("At least one device state must be allowed.");
    if (draft.challenge_threshold > draft.deny_threshold) issues.push("Challenge threshold cannot exceed deny threshold.");
    if (draft.reason.trim().length < 5) issues.push("A change reason of at least 5 characters is required.");
    return issues;
  }, [draft]);

  const update = useMutation({
    mutationFn: () => api.updatePolicy(resource.id, { ...draft, reason: draft.reason.trim() }),
    onSuccess: (policy) => {
      setConfirmOpen(false);
      setPreview(null);
      setDraft((current) => ({ ...current, reason: "" }));
      void queryClient.invalidateQueries({ queryKey: ["resources"] });
      void queryClient.invalidateQueries({ queryKey: ["policy-history", resource.id] });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
      void queryClient.invalidateQueries({ queryKey: ["events"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success(
        `Published ${resource.key}:v${policy.version}`,
        "The previous version was retired and the new policy is now active.",
      );
    },
    onError: (error) => toast.error("Publish failed", messageFromError(error)),
  });

  const previewMutation = useMutation({
    mutationFn: () => api.previewPolicy(draft, buildPreviewCases(draft)),
    onSuccess: (data) => {
      setPreview(data);
      toast.success("Dry run complete", "Draft previews are not persisted.");
    },
    onError: (error) => toast.error("Preview failed", messageFromError(error)),
  });

  const toggleRole = (role: Role) => {
    setDraft((current) => ({
      ...current,
      allowed_roles: current.allowed_roles.includes(role)
        ? current.allowed_roles.filter((value) => value !== role)
        : [...current.allowed_roles, role],
    }));
  };

  const toggleDevice = (state: DeviceState) => {
    setDraft((current) => ({
      ...current,
      allowed_device_states: current.allowed_device_states.includes(state)
        ? current.allowed_device_states.filter((value) => value !== state)
        : [...current.allowed_device_states, state],
    }));
  };

  const activePolicy = resource.policy;

  return (
    <div className="min-w-0 space-y-4">
      <Panel className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={resource.sensitivity.toLowerCase() as "low" | "medium" | "high" | "critical"}>
                {resource.sensitivity}
              </Badge>
              <SimulatedTag value={resource.is_simulated} />
              {activePolicy ? (
                <Badge tone="low">Active v{activePolicy.version}</Badge>
              ) : (
                <Badge tone="critical">No active policy</Badge>
              )}
            </div>
            <h2 className="mt-2 font-display text-lg font-semibold text-ink">{resource.name}</h2>
            <p className="mt-0.5 font-mono text-[10px] text-faint">{resource.key}</p>
            <p className="mt-1.5 max-w-2xl text-xs leading-5 text-muted">{resource.description}</p>
            <p className="mt-1 text-[10px] text-faint">
              Owner: {resource.owner_department} · {resource.version_count} version{resource.version_count === 1 ? "" : "s"}
            </p>
          </div>
          {activePolicy && (
            <div className="rounded-lg border border-line/60 bg-raised/40 p-3 text-[10px] text-muted">
              <p className="font-semibold text-ink">Threshold posture</p>
              <p className="mt-1">Challenge ≥ {activePolicy.challenge_threshold}</p>
              <p>Deny ≥ {activePolicy.deny_threshold}</p>
              <p>Session max {activePolicy.session_max_minutes} min</p>
            </div>
          )}
        </div>
      </Panel>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "editor", label: "Policy editor" },
          { id: "history", label: "Version history", count: history.data?.length },
        ]}
      />

      {tab === "history" ? (
        <PolicyHistory history={history.data ?? []} loading={history.isLoading} error={history.error?.message} onRetry={() => void history.refetch()} />
      ) : (
        <div className="space-y-4">
          {!activePolicy && (
            <Callout tone="danger" icon={<TriangleAlert size={15} />} title="Fail-closed by default">
              Without an active policy, every access request for this resource is denied. Publish a policy to open controlled access.
            </Callout>
          )}

          <fieldset disabled={!isAdmin} className={cn("space-y-4", !isAdmin && "opacity-90")}>
            <Panel className="p-4 sm:p-5">
              <div className="mb-3 flex items-center gap-2">
                <PencilRuler size={15} className="text-accent" />
                <p className="text-xs font-semibold text-ink">Eligibility controls</p>
              </div>
              <p className="label">Allowed roles</p>
              <div className="mt-1 grid gap-2 sm:grid-cols-2">
                {ROLES.map((role) => (
                  <label
                    key={role}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 transition",
                      draft.allowed_roles.includes(role)
                        ? "border-accent/30 bg-accent/[0.06]"
                        : "border-line/65 bg-raised/30 hover:border-line",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded border",
                        draft.allowed_roles.includes(role)
                          ? "border-accent bg-accent text-canvas"
                          : "border-line bg-canvas",
                      )}
                    >
                      {draft.allowed_roles.includes(role) && <Check size={11} />}
                    </span>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={draft.allowed_roles.includes(role)}
                      onChange={() => toggleRole(role)}
                    />
                    <span className="min-w-0">
                      <span className="block text-[11px] font-medium text-ink">{ROLE_LABELS[role]}</span>
                      <span className="block font-mono text-[9px] text-faint">{role}</span>
                    </span>
                  </label>
                ))}
              </div>

              <p className="label mt-4">Allowed device states</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {DEVICE_STATES.map((state) => (
                  <label
                    key={state}
                    className={cn(
                      "flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] transition",
                      draft.allowed_device_states.includes(state)
                        ? "border-accent/30 bg-accent/[0.06] text-ink"
                        : "border-line/65 bg-raised/30 text-muted hover:border-line",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={draft.allowed_device_states.includes(state)}
                      onChange={() => toggleDevice(state)}
                    />
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        draft.allowed_device_states.includes(state) ? "bg-accent" : "bg-faint",
                      )}
                    />
                    {titleCase(state)}
                  </label>
                ))}
              </div>
            </Panel>

            <Panel className="p-4 sm:p-5">
              <div className="mb-3 flex items-center gap-2">
                <Eye size={15} className="text-accent" />
                <p className="text-xs font-semibold text-ink">Risk thresholds</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Challenge at risk ≥" hint="Step-up verification is required at or above this index.">
                  <SelectInput
                    value={draft.challenge_threshold}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, challenge_threshold: Number(event.target.value) }))
                    }
                  >
                    {Array.from({ length: 21 }, (_, index) => index * 5).map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Deny at risk ≥" hint="A hard deny is enforced at or above this index.">
                  <SelectInput
                    value={draft.deny_threshold}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, deny_threshold: Number(event.target.value) }))
                    }
                  >
                    {Array.from({ length: 21 }, (_, index) => index * 5).map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </SelectInput>
                </Field>
              </div>
              <div className="mt-4">
                <div className="relative h-2.5 overflow-hidden rounded-full bg-gradient-to-r from-low/60 via-medium/60 to-critical/60">
                  <span
                    className="absolute top-0 h-full w-0.5 bg-ink/80"
                    style={{ left: `${draft.challenge_threshold}%` }}
                    title={`Challenge ${draft.challenge_threshold}`}
                  />
                  <span
                    className="absolute top-0 h-full w-0.5 bg-ink/80"
                    style={{ left: `${draft.deny_threshold}%` }}
                    title={`Deny ${draft.deny_threshold}`}
                  />
                </div>
                <div className="mt-1 flex justify-between text-[9px] text-faint">
                  <span>Allow</span>
                  <span>Challenge {draft.challenge_threshold}</span>
                  <span>Deny {draft.deny_threshold}</span>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Session max (minutes)" hint="Applies when require-additional-verification is lowest precedence.">
                  <SelectInput
                    value={draft.session_max_minutes}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, session_max_minutes: Number(event.target.value) }))
                    }
                  >
                    {[30, 60, 120, 240, 480].map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </SelectInput>
                </Field>
                <div className="flex items-end">
                  <Toggle
                    checked={draft.require_additional_verification}
                    onChange={(value) =>
                      setDraft((current) => ({ ...current, require_additional_verification: value }))
                    }
                    label="Require additional verification"
                    description="Challenge sessions that exceed the max age."
                    disabled={!isAdmin}
                  />
                </div>
              </div>
            </Panel>
          </fieldset>

          <Panel className="p-4 sm:p-5">
            <Field
              label="Change reason"
              hint={isAdmin ? "Required. Stored with the new version and audit record." : "Only admins can publish changes."}
            >
              <TextArea
                rows={2}
                value={draft.reason}
                onChange={(event) => setDraft((current) => ({ ...current, reason: event.target.value }))}
                placeholder="Why is this policy changing? Cite the risk or business requirement."
                disabled={!isAdmin}
              />
            </Field>

            {isAdmin && validation.length > 0 && (
              <ul className="mt-2 space-y-1">
                {validation.map((issue) => (
                  <li key={issue} className="text-[10px] text-medium">• {issue}</li>
                ))}
              </ul>
            )}
            {update.isError && <p className="mt-2 text-[11px] text-critical">{messageFromError(update.error)}</p>}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[10px] text-faint">
                <Info size={11} />
                Previews use a fixed case matrix and never persist.
              </div>
              <div className="flex gap-2">
                {canPreview && (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={previewMutation.isPending}
                    onClick={() => previewMutation.mutate()}
                  >
                    <Play size={12} /> Dry run preview
                  </Button>
                )}
                {isAdmin && (
                  <Button
                    variant="solid"
                    size="sm"
                    disabled={validation.length > 0}
                    onClick={() => setConfirmOpen(true)}
                  >
                    <BadgeCheck size={13} /> Publish new version
                  </Button>
                )}
              </div>
            </div>
          </Panel>

          {preview && <PreviewResults preview={preview} cases={buildPreviewCases(draft)} />}
        </div>
      )}

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Publish policy version?"
        description={`${resource.name} · ${resource.key}`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="solid" loading={update.isPending} onClick={() => update.mutate()}>
              Publish v{resource.version_count + 1}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Callout tone="warning" title="Immediate effect">
            The current policy will be retired and this draft becomes authoritative for all future access decisions.
          </Callout>
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-line/65 bg-raised/30 p-3 text-[11px]">
            <div>
              <p className="text-[9px] uppercase tracking-wider text-faint">Challenge ≥</p>
              <p className="font-mono text-ink">{draft.challenge_threshold}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider text-faint">Deny ≥</p>
              <p className="font-mono text-ink">{draft.deny_threshold}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider text-faint">Roles</p>
              <p className="text-ink">{draft.allowed_roles.map((role) => ROLE_LABELS[role]).join(", ")}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider text-faint">Devices</p>
              <p className="text-ink">{draft.allowed_device_states.map(titleCase).join(", ")}</p>
            </div>
          </div>
          <p className="text-[11px] leading-5 text-muted">
            Reason: <span className="text-ink">{draft.reason}</span>
          </p>
        </div>
      </Modal>
    </div>
  );
}

function buildPreviewCases(draft: PolicyDraft): PolicyPreviewCase[] {
  const role = draft.allowed_roles[0] ?? "EMPLOYEE";
  return [
    {
      role,
      device_state: "TRUSTED",
      risk_score: 5,
      account_active: true,
      identity_authorized: true,
      session_active: true,
    },
    {
      role,
      device_state: "TRUSTED",
      risk_score: draft.challenge_threshold,
      account_active: true,
      identity_authorized: true,
      session_active: true,
    },
    {
      role,
      device_state: "TRUSTED",
      risk_score: draft.deny_threshold,
      account_active: true,
      identity_authorized: true,
      session_active: true,
    },
    {
      role,
      device_state: "UNVERIFIED",
      risk_score: 10,
      account_active: true,
      identity_authorized: true,
      session_active: true,
    },
    {
      role,
      device_state: "REVOKED",
      risk_score: 5,
      account_active: true,
      identity_authorized: true,
      session_active: true,
    },
    {
      role,
      device_state: "TRUSTED",
      risk_score: 5,
      account_active: false,
      identity_authorized: true,
      session_active: true,
    },
    {
      role,
      device_state: "TRUSTED",
      risk_score: 10,
      account_active: true,
      identity_authorized: true,
      session_active: true,
      repeated_anomalies: 3,
    },
  ];
}

const PREVIEW_LABELS = [
  "Baseline trusted request",
  "At challenge threshold",
  "At deny threshold",
  "Unverified device",
  "Revoked device",
  "Disabled account",
  "Repeated anomalies",
];

function PreviewResults({ preview, cases }: { preview: PolicyPreview; cases: PolicyPreviewCase[] }) {
  return (
    <Panel className="overflow-hidden">
      <div className="border-b border-line/60 p-4">
        <div className="flex items-center gap-2">
          <Eye size={15} className="text-accent" />
          <p className="text-xs font-semibold text-ink">Dry run preview</p>
          <Badge tone="violet">Not persisted</Badge>
        </div>
        <p className="mt-1 text-[10px] text-faint">{preview.policy_version_preview}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Case</th>
              <th>Input</th>
              <th>Decision</th>
              <th>Primary reason</th>
            </tr>
          </thead>
          <tbody>
            {preview.results.map((result) => {
              const input = cases[result.case_index];
              return (
                <tr key={result.case_index}>
                  <td className="text-[11px] text-ink">{PREVIEW_LABELS[result.case_index] ?? `Case ${result.case_index + 1}`}</td>
                  <td className="text-[10px] text-faint">
                    {input ? `${input.role} · ${input.device_state} · risk ${input.risk_score}` : "—"}
                  </td>
                  <td><DecisionBadge decision={result.decision} /></td>
                  <td className="max-w-[320px]">
                    <p className="font-mono text-[9px] text-accent">{result.reasons[0]?.code ?? "—"}</p>
                    <p className="truncate text-[10px] text-muted">{result.reasons[0]?.message ?? "No reasons"}</p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function PolicyHistory({
  history,
  loading,
  error,
  onRetry,
}: {
  history: Policy[];
  loading: boolean;
  error?: string;
  onRetry: () => void;
}) {
  if (loading) return <LoadingPanel rows={4} label="Loading version history" />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (history.length === 0) {
    return <EmptyState icon={<History size={18} />} title="No policy versions" description="Publish a policy to create the first immutable version." />;
  }
  return (
    <div className="space-y-2">
      {history.map((policy) => (
        <Panel key={policy.id} className={cn("p-4", policy.is_active && "border-accent/30")}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-semibold text-ink">v{policy.version}</span>
                <Badge tone={policy.is_active ? "low" : "neutral"}>{policy.is_active ? "Active" : "Retired"}</Badge>
                <SimulatedTag value={policy.is_simulated} />
              </div>
              <p className="mt-1.5 text-[11px] text-muted">{policy.change_reason}</p>
              <p className="mt-1 text-[9px] text-faint">{formatDateTime(policy.created_at)}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-muted">
              <span>Challenge ≥ {policy.challenge_threshold}</span>
              <span>Deny ≥ {policy.deny_threshold}</span>
              <span>Session ≤ {policy.session_max_minutes}m</span>
              <span>Verification {policy.require_additional_verification ? "on" : "off"}</span>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            {policy.allowed_roles.map((role) => (
              <span key={role} className="rounded border border-line/70 bg-raised/50 px-1.5 py-0.5 text-[9px] text-muted">
                {ROLE_LABELS[role]}
              </span>
            ))}
            {policy.allowed_device_states.map((state) => (
              <span key={state} className="rounded border border-line/70 bg-raised/50 px-1.5 py-0.5 text-[9px] text-faint">
                {titleCase(state)}
              </span>
            ))}
          </div>
        </Panel>
      ))}
    </div>
  );
}
