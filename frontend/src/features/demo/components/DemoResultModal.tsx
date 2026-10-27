import { Link } from "react-router-dom";
import { ArrowUpRight, CheckCircle2, XCircle } from "lucide-react";
import { Badge, Button, DecisionBadge, Modal, RiskBadge, SimulatedTag } from "../../../components/ui";
import { cn, formatDateTime } from "../../../lib/utils";
import type { DemoRun, DemoScenarioResult } from "../../../types/api";

export function DemoResultModal({
  result,
  onClose,
}: {
  result: DemoRun | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={Boolean(result)}
      onClose={onClose}
      title={result?.scenario ? `Scenario ${result.scenario} result` : "Demo run results"}
      description={
        result ? `Executed ${formatDateTime(result.executed_at)} \uFFFD all records labeled simulated` : undefined
      }
      size="lg"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
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
              {item.passed ? (
                <>
                  <CheckCircle2 size={10} /> Pass
                </>
              ) : (
                <>
                  <XCircle size={10} /> Mismatch
                </>
              )}
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
