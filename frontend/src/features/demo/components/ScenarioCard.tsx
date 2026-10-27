import { FlaskConical, Play, ShieldQuestion } from "lucide-react";
import { Badge, Button, Panel } from "../../../components/ui";
import type { DemoScenarioInfo, ScenarioId } from "../../../types/api";

export function ScenarioCard({
  scenario,
  canRun,
  busy,
  disabled,
  onRun,
}: {
  scenario: DemoScenarioInfo;
  canRun: boolean;
  busy: boolean;
  disabled: boolean;
  onRun: (scenario: ScenarioId) => void;
}) {
  return (
    <Panel className="flex flex-col p-4">
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
            disabled={disabled}
            onClick={() => onRun(scenario.scenario)}
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
}
