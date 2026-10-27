import { RiskHistoryChart } from "../../../components/charts";
import { Panel, SectionHeading } from "../../../components/ui";
import { formatDateTime } from "../../../lib/utils";
import type { IdentityDetail } from "../../../types/api";

export function RiskExplanation({ detail }: { detail: IdentityDetail }) {
  const factors = detail.behavioral_signals[0]?.top_factors ?? [];

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.15fr]">
      <Panel className="p-4 sm:p-5">
        <SectionHeading
          eyebrow="Explainability"
          title="Why this risk index"
          description={factors.length ? "Top feature deviations from the latest scored event." : undefined}
        />
        {factors.length === 0 ? (
          <p className="mt-4 rounded-lg border border-line/60 bg-raised/30 p-3 text-[11px] text-muted">
            No behavioral factors currently explain your risk. This is normal.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {factors.map((factor) => (
              <div key={factor.feature} className="rounded-lg border border-line/60 bg-raised/30 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-medium text-ink">{factor.label}</p>
                  <span className="rounded bg-line/50 px-1.5 py-0.5 font-mono text-[9px] text-muted">
                    {factor.deviation.toFixed(1)}Σ
                  </span>
                </div>
                <p className="mt-1 text-[10px] leading-4 text-faint">{factor.message}</p>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel className="p-4 sm:p-5">
        <SectionHeading
          eyebrow="Trajectory"
          title="Risk history"
          description="Scored access events over the retained window."
        />
        <div className="mt-3">
          <RiskHistoryChart data={detail.risk_history} />
        </div>
        {detail.alerts.length > 0 && (
          <div className="mt-3 rounded-lg border border-critical/25 bg-critical/[0.05] p-3">
            <p className="text-[10px] font-semibold text-critical">Security alerts involving your identity</p>
            {detail.alerts.slice(0, 3).map((alert) => (
              <p key={alert.id} className="mt-1 text-[10px] leading-4 text-muted">
                {alert.summary} {"\uFFFD"} {formatDateTime(alert.timestamp)}
              </p>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
