import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bug, CheckCircle2, Shield, XCircle } from "lucide-react";
import { api } from "../services/api";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  Panel,
  Spinner,
} from "../components/ui";
import { useToast } from "../hooks/useToast";

export default function RedTeamPage() {
  const toast = useToast();
  const [selectedScenario, setSelectedScenario] = useState<string | undefined>(undefined);

  const scenarios = useQuery({
    queryKey: ["red-team-scenarios"],
    queryFn: () => api.redTeamScenarios(),
  });

  const run = useMutation({
    mutationFn: (scenario?: string) => api.runRedTeam(scenario),
    onError: (e: Error) => toast.error(e.message, "Red team run failed"),
  });

  return (
    <>
      <PageHeader
        eyebrow="Adversarial testing"
        title="Red-team attack simulator"
        description="Runs six realistic attack scenarios against the live policy + ML engine and reports whether each was blocked. Policy is the final authority."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => run.mutate(undefined)} disabled={run.isPending}>
              {run.isPending ? "Running..." : "Run all attacks"}
            </Button>
          </div>
        }
      />

      {scenarios.isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : scenarios.isError ? (
        <ErrorState message={scenarios.error.message} onRetry={() => void scenarios.refetch()} />
      ) : (
        <div className="space-y-4">
          {scenarios.data && scenarios.data.length > 0 && (
            <Panel>
              <p className="mb-3 text-sm font-semibold text-ink">Available scenarios</p>
              <div className="flex flex-wrap gap-2">
                {scenarios.data.map((s) => (
                  <Button
                    key={s.id}
                    variant={selectedScenario === s.id ? "solid" : "secondary"}
                    size="sm"
                    onClick={() => setSelectedScenario(s.id)}
                  >
                    {s.name}
                  </Button>
                ))}
                <Button variant="ghost" size="sm" onClick={() => setSelectedScenario(undefined)}>
                  All
                </Button>
              </div>
              {selectedScenario && (
                <div className="mt-3">
                  <Button
                    variant="solid"
                    size="sm"
                    onClick={() => run.mutate(selectedScenario)}
                    disabled={run.isPending}
                  >
                    Run selected
                  </Button>
                </div>
              )}
            </Panel>
          )}

          {run.data && (
            <Panel>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink">Run result</p>
                  <p className="text-[10px] text-faint">
                    {run.data.blocked_attacks}/{run.data.total_attacks} attacks blocked
                  </p>
                </div>
                <Badge tone={run.data.overall === "DEFENDED" ? "low" : "critical"}>{run.data.overall}</Badge>
              </div>
            </Panel>
          )}

          {run.data && run.data.results.map((r) => (
            <div key={r.scenario.id} className="rounded-xl border border-line/65 bg-raised/30 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {r.defended ? (
                    <CheckCircle2 size={16} className="mt-0.5 text-accent" />
                  ) : (
                    <XCircle size={16} className="mt-0.5 text-critical" />
                  )}
                  <div>
                    <p className="text-xs font-semibold text-ink">{r.scenario.name}</p>
                    <p className="mt-1 text-[10px] text-faint">{r.scenario.description}</p>
                  </div>
                </div>
                <Badge tone={r.defended ? "low" : "critical"}>
                  {r.blocked_count}/{r.total_count}
                </Badge>
              </div>
              <div className="mt-3 space-y-2">
                {r.attacks.map((a, i) => (
                  <div key={i} className="rounded-lg border border-line/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-medium text-ink">{a.name}</p>
                      <Badge tone={a.blocked ? "low" : "critical"}>{a.decision}</Badge>
                    </div>
                    <p className="mt-1 text-[10px] text-faint">
                      {a.identity_email} - {a.resource_name} ({a.requested_action}) - risk {a.risk_score.toFixed(1)} ({a.risk_category})
                    </p>
                    <p className="mt-1 text-[10px] leading-4 text-faint">{a.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {!run.data && !run.isPending && (
            <EmptyState icon={<Bug size={18} />} title="No run yet" description="Run all attacks or select a scenario." />
          )}
        </div>
      )}
    </>
  );
}