import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FlaskConical, Play, RotateCcw, Sparkles, TriangleAlert } from "lucide-react";
import {
  Badge,
  Button,
  Callout,
  EmptyState,
  ErrorState,
  LoadingPanel,
  PageHeader,
  Panel,
  SectionHeading,
} from "../../../components/ui";
import type { DemoRun, ScenarioId } from "../../../types/api";
import { messageFromError } from "../../../services/api";
import { useAuth } from "../../auth/useAuth";
import { useSettingsInfo } from "../../settings/queries";
import { toast } from "../../toast/store";
import { DemoResetModal } from "../components/DemoResetModal";
import { DemoResultModal } from "../components/DemoResultModal";
import { ScenarioCard } from "../components/ScenarioCard";
import { resetDemo, runAllDemos, runDemoScenario } from "../api";
import { useDemoScenarios } from "../queries";

export default function DemoPage() {
  const { me } = useAuth();
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
    mutationFn: runDemoScenario,
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
    mutationFn: runAllDemos,
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
    mutationFn: resetDemo,
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
              <Button
                variant="solid"
                onClick={() => runAll.mutate()}
                loading={running === "ALL"}
                disabled={running !== null}
              >
                <Play size={14} /> Run all scenarios
              </Button>
            )}
          </>
        }
      />

      {!demoMode ? (
        <Callout tone="warning" icon={<TriangleAlert size={15} />} title="Demo mode is disabled">
          Set <span className="font-mono text-[10px]">AEGIS_DEMO_MODE=true</span> in the backend environment and restart
          the server to enable demo scenarios.
        </Callout>
      ) : scenarios.isError ? (
        <ErrorState message={scenarios.error.message} onRetry={() => void scenarios.refetch()} />
      ) : scenarios.isLoading ? (
        <LoadingPanel rows={6} label="Loading demo scenarios" />
      ) : !scenarios.data?.length ? (
        <EmptyState
          icon={<FlaskConical size={18} />}
          title="No demo scenarios"
          description="The backend returned an empty scenario catalog."
        />
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
                {
                  step: "01",
                  title: "Identity + device context",
                  detail: "Seeded subjects, devices, and resource policies",
                },
                {
                  step: "02",
                  title: "ML risk + policy",
                  detail: "Isolation Forest scores; policy makes the decision",
                },
                {
                  step: "03",
                  title: "Evidence persisted",
                  detail: "Access records, incidents, events, audit chain",
                },
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
            {scenarios.data.map((scenario) => (
              <ScenarioCard
                key={scenario.scenario}
                scenario={scenario}
                canRun={canRun}
                busy={running === scenario.scenario}
                disabled={running !== null}
                onRun={runOne.mutate}
              />
            ))}
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

      <DemoResultModal result={result} onClose={() => setResult(null)} />
      <DemoResetModal
        open={resetOpen}
        loading={reset.isPending}
        onClose={() => setResetOpen(false)}
        onConfirm={() => reset.mutate()}
      />
    </>
  );
}
