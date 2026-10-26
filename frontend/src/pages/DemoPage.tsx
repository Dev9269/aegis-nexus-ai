import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CheckCircle2,
  FlaskConical,
  Play,
  RotateCcw,
  ShieldQuestion,
  Sparkles,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { api, messageFromError } from "../services/api";
import { useDemoScenarios, useSettingsInfo } from "../hooks/queries";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import {
  Badge,
  Button,
  Callout,
  DecisionBadge,
  EmptyState,
  ErrorState,
  KeyValue,
  LoadingPanel,
  Modal,
  PageHeader,
  Panel,
  RiskBadge,
  SectionHeading,
  SimulatedTag,
} from "../components/ui";
import type { DemoRun, DemoScenarioResult, ScenarioId } from "../types/api";
import { cn, formatDateTime } from "../lib/utils";

export default function DemoPage() {
  const { me } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const settings = useSettingsInfo();
  const demoMode = settings.data?.demo_mode ?? me?.demo_mode ?? true;
  const scenarios = useDemoScenarios(demoMode);
  const [result, setResult] = useState<DemoRun | null>(null);
  const [running, setRunning] = useState<ScenarioId | "ALL" | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  const canRun = me?.role === "SECURITY_ADMIN" || me?.role === "SECURITY_ANALYST";
  const isAdmin = me?.role === "SECURITY_ADMIN";

  const invalidate = () => {
    const keys = [
      "overview",
      "identities",
      "identity",
      "devices",
      "access",
      "access-detail",
      "incidents",
      "incident",
      "events",
      "notifications",
      "audit",
      "audit-verify",
      "health-detailed",
    ];
    for (const key of keys) void queryClient.invalidateQueries({ queryKey: [key] });
  };

  const runOne = useMutation({
    mutationFn: (scenario: ScenarioId) => api.runDemoScenario(scenario),
    onMutate: (scenario) => setRunning(scenario),
    onSuccess: (data) => {
      setResult(data);
      invalidate();
      toast.success(
        `Scenario ${data.results[0]?.scenario ?? ""} executed`,
        data.results[0]?.passed ? "Expected outcome matched." : "Outcome differs from expectation.",
      );
    },
    onError: (error) => toast.error("Scenario failed", messageFromError(error)),
    onSettled: () => setRunning(null),
  });

  const runAll = useMutation({
    mutationFn: api.runAllDemos,
    onMutate: () => setRunning("ALL"),
    onSuccess: (data) => {
      setResult(data);
      invalidate();
      const passed = data.results.filter((item) => item.passed).length;
      toast.success("Demo run complete", `${passed} of ${data.results.length} scenarios matched expectations.`);
    },
    onError: (error) => toast.error("Demo run failed", messageFromError(error)),
    onSettled: () => setRunning(null),
  });

  const reset = useMutation({
    mutationFn: api.resetDemo,
    onSuccess: (data) => {
      setResetOpen(false);
      setResult(null);
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ["demo-scenarios"] });
      toast.success(
        "Demo environment reset",
        `${data.identities} identities, ${data.devices} devices, ${data.access_requests} decisions, ${data.incidents} incidents restored.`,
      );
    },
    onError: (error) => toast.error("Reset failed", messageFromError(error)),
  });

  return (
    <>
      <PageHeader
        eyebrow="Guided demonstration"
        title="Demo lab"
        description="Six deterministic scenarios demonstrate allow, challenge, role deny, disabled account, containment, and exfiltration-like denial outcomes. All demo data is labeled simulated."
        meta={
          <>
            <Badge tone={demoMode ? "violet" : "critical"}>
              {demoMode ? "Demo mode enabled" : "Demo mode disabled"}
            </Badge>
            <span className="text-[10px] text-faint">Reset restores demo data without erasing the audit ledger</span>
          </>
        }
        actions={
          <>
            {isAdmin && (
              <Button variant="ghost" onClick={() => setResetOpen(true)} loading={reset.isPending}>
                <RotateCcw size={14} /> Reset demo
              </Button>
            )}
            {canRun && (
              <Button variant="solid" onClick={() => runAll.mutate()} loading={running === "ALL"} disabled={running !== null}>
                <Play size={14} /> Run all scenarios
              </Button>
            )}
          </>
        }
      />

      {!demoMode ? (
        <Callout tone="warning" icon={<TriangleAlert size={15} />} title="Demo mode is disabled">
          Set <span className="font-mono text-[10px]">AEGIS_DEMO_MODE=true</span> in the backend environment and restart the
          server to enable demo scenarios.
        </Callout>
      ) : scenarios.isError ? (
        <ErrorState message={scenarios.error.message} onRetry={() => void scenarios.refetch()} />
      ) : scenarios.isLoading ? (
        <LoadingPanel rows={6} label="Loading demo scenarios" />
      ) : !scenarios.data?.length ? (
        <EmptyState icon={<FlaskConical size={18} />} title="No demo scenarios" description="The backend returned an empty scenario catalog." />
      ) : (
        <div className="space-y-4">
          <Panel className="p-4 sm:p-5">
            <SectionHeading
              eyebrow="How this works"
              title="A deterministic story for every decision path"
              description="Each run evaluates real policy code against seeded identities and resources, then persists access evidence, events, incidents, and audit entries."
              action={
                canRun ? (
                  <span className="text-[10px] text-faint">Scenarios execute sequentially</span>
                ) : (
                  <Badge tone="neutral">Read-only role</Badge>
                )
              }
            />
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {[
                { step: "01", title: "Identity + device context", detail: "Seeded subjects, devices, and resource policies" },
                { step: "02", title: "ML risk + policy", detail: "Isolation Forest scores; policy makes the decision" },
                { step: "03", title: "Evidence persisted", detail: "Access records, incidents, events, audit chain" },
              ].map((item) => (
                <div key={item.step} className="rounded-lg border border-line/60 bg-raised/30 p-3">
                  <p className="font-mono text-[9px] text-accent">{item.step}</p>
                  <p className="mt-1 text-[11px] font-medium text-ink">{item.title}</p>
                  <p className="mt-0.5 text-[10px] leading-4 text-faint">{item.detail}</p>
                </div>
              ))}
            </div>
          </Panel>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {scenarios.data.map((scenario) => {
              const busy = running === scenario.scenario;
              return (
                <Panel key={scenario.scenario} className="flex flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-accent/25 bg-accent/10 font-mono text-xs font-semibold text-accent">
                        {scenario.scenario}
                      </span>
                      <Badge tone="violet">Simulated</Badge>
                    </div>
                    <FlaskConical size={15} className="text-faint" />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-ink">{scenario.title}</h3>
                  <p className="mt-1 flex-1 text-[11px] leading-5 text-muted">{scenario.description}</p>
                  <div className="mt-3 space-y-1 border-t border-line/50 pt-2 text-[10px]">
                    <p className="flex items-center gap-1.5 text-faint">
                      <span className="w-[54px] shrink-0 uppercase tracking-wider">Subject</span>
                      <span className="truncate text-ink">{scenario.subject}</span>
                    </p>
                    <p className="flex items-center gap-1.5 text-faint">
                      <span className="w-[54px] shrink-0 uppercase tracking-wider">Resource</span>
                      <span className="truncate text-ink">{scenario.resource}</span>
                    </p>
                    <p className="flex items-center gap-1.5 text-faint">
                      <span className="w-[54px] shrink-0 uppercase tracking-wider">Device</span>
                      <span className="truncate text-ink">{scenario.device ?? "None"}</span>
                    </p>
                  </div>
                  <div className="mt-3 rounded-lg border border-accent/20 bg-accent/[0.04] p-2">
                    <p className="text-[8px] uppercase tracking-wider text-accent">Expected outcome</p>
                    <p className="mt-0.5 text-[10px] leading-4 text-muted">{scenario.expected_outcome}</p>
                  </div>
                  <div className="mt-3">
                    {canRun ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        loading={busy}
                        disabled={running !== null}
                        onClick={() => runOne.mutate(scenario.scenario)}
                      >
                        <Play size={12} /> Run scenario {scenario.scenario}
                      </Button>
                    ) : (
                      <div className="flex items-center justify-center gap-1.5 rounded-md border border-line/60 bg-raised/30 py-2 text-[10px] text-faint">
                        <ShieldQuestion size={12} /> Auditor cannot execute demos
                      </div>
                    )}
                  </div>
                </Panel>
              );
            })}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Callout tone="info" icon={<Sparkles size={15} />} title="What the demo proves">
              The model scores behavior, mandatory controls enforce boundaries, risky requests are escalated, and every
              outcome survives in the access and audit records for review.
            </Callout>
            <Callout tone="warning" icon={<TriangleAlert size={15} />} title="What it does not prove">
              This is synthetic data in a self-contained prototype. It is not evidence of production detection accuracy
              or a substitute for identity governance, SSO, MFA, and external threat intelligence.
            </Callout>
          </div>
        </div>
      )}

      <Modal
        open={Boolean(result)}
        onClose={() => setResult(null)}
        title={result?.scenario ? `Scenario ${result.scenario} result` : "Demo run results"}
        description={result ? `Executed ${formatDateTime(result.executed_at)} · all records labeled simulated` : undefined}
        size="lg"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setResult(null)}>Close</Button>
            {result?.results[0]?.request_id && (
              <Link to={`/access?request=${result.results[0].request_id}`} className="btn-primary">
                Open latest decision <ArrowUpRight size={12} />
              </Link>
            )}
          </div>
        }
      >
        {result && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={result.results.every((item) => item.passed) ? "low" : "high"}>
                {result.results.filter((item) => item.passed).length} / {result.results.length} passed
              </Badge>
              <SimulatedTag value={result.is_simulated} />
              <span className="text-[10px] text-faint">{result.demo_mode ? "Demo mode" : "Demo mode disabled"}</span>
            </div>
            {result.results.map((item) => (
              <ResultCard key={item.scenario} item={item} />
            ))}
          </div>
        )}
      </Modal>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset demo environment?"
        description="This restores seeded identities, devices, policies, and removes demo access/incident data."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button variant="danger" loading={reset.isPending} onClick={() => reset.mutate()}>
              <RotateCcw size={13} /> Reset demo data
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Callout tone="warning" title="Audit history is preserved">
            The reset itself is audited. This is intentional: evidence must survive demo housekeeping.
          </Callout>
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-line/65 bg-raised/30 p-3 text-[11px] text-muted">
            <KeyValue label="Affected scope" value="Demo identities, devices, requests, incidents" />
            <KeyValue label="Preserved" value="Audit ledger, model artifact, real data" />
          </div>
        </div>
      </Modal>
    </>
  );
}

function ResultCard({ item }: { item: DemoScenarioResult }) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3.5",
        item.passed ? "border-low/30 bg-low/[0.04]" : "border-high/30 bg-high/[0.05]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] font-semibold text-accent">{item.scenario}</span>
            <span className="text-xs font-semibold text-ink">{item.title}</span>
            <Badge tone={item.passed ? "low" : "high"}>
              {item.passed ? <><CheckCircle2 size={10} /> Pass</> : <><XCircle size={10} /> Mismatch</>}
            </Badge>
          </div>
          <p className="mt-1 text-[10px] text-faint">Expected: {item.expected_outcome}</p>
          <p className="mt-0.5 text-[11px] text-muted">Actual: {item.actual_outcome}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {item.decision && <DecisionBadge decision={item.decision} />}
          {item.risk_score !== null && <RiskBadge score={item.risk_score} />}
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {item.request_id && (
          <Link to={`/access?request=${item.request_id}`} className="btn-ghost btn-sm">
            Access evidence <ArrowUpRight size={11} />
          </Link>
        )}
        {item.incident_id && (
          <Link to={`/incidents?incident=${item.incident_id}`} className="btn-ghost btn-sm">
            Incident <ArrowUpRight size={11} />
          </Link>
        )}
      </div>
    </div>
  );
}
