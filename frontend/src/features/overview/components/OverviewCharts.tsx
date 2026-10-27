import { ActivityTimelineChart, DecisionBars, RiskDonut } from "../../../components/charts";
import { Badge, Panel, SectionHeading } from "../../../components/ui";
import { cn, formatPercent, titleCase } from "../../../lib/utils";
import type { Overview } from "../../../types/api";

export function OverviewCharts({ data, riskTotal }: { data: Overview; riskTotal: number }) {
  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-[1.65fr_1fr]">
      <Panel className="p-4 sm:p-5">
        <SectionHeading
          eyebrow="Activity telemetry"
          title="Request and event volume"
          description={`Bucketed ${data.range_label.toLowerCase()}. Dashed line isolates high-risk access.`}
          action={<Badge tone="accent">{data.range_label}</Badge>}
        />
        <div className="mt-4">
          <ActivityTimelineChart data={data.timeline} />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-faint">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Access requests
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-2" /> Security events
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-high" /> High-risk access
          </span>
        </div>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
        <Panel className="p-4">
          <SectionHeading eyebrow="Risk distribution" title="Behavioral tiers" />
          <RiskDonut data={data.risk_distribution} />
          <div className="mt-1 grid grid-cols-2 gap-2">
            {data.risk_distribution.map((item) => (
              <div key={item.name} className="flex items-center justify-between rounded-md bg-raised/40 px-2 py-1.5">
                <span className="flex items-center gap-1.5 text-[10px] text-muted">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      item.name === "LOW" && "bg-low",
                      item.name === "MEDIUM" && "bg-medium",
                      item.name === "HIGH" && "bg-high",
                      item.name === "CRITICAL" && "bg-critical",
                    )}
                  />
                  {titleCase(item.name)}
                </span>
                <span className="font-mono text-[10px] text-ink">
                  {riskTotal ? formatPercent((item.value / riskTotal) * 100, 0) : "0%"}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-4">
          <SectionHeading eyebrow="Decision mix" title="Policy outcomes" />
          <DecisionBars data={data.decision_breakdown} />
        </Panel>
      </div>
    </div>
  );
}
