import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Badge, Button, ErrorState, LoadingPanel, PageHeader } from "../../../components/ui";
import { RANGE_OPTIONS } from "../../../lib/constants";
import { cn, formatRelativeTime } from "../../../lib/utils";
import { useAuth } from "../../auth/useAuth";
import { MetricGrid } from "../components/MetricGrid";
import { OverviewCharts } from "../components/OverviewCharts";
import { OverviewQueues } from "../components/OverviewQueues";
import { TrustMesh } from "../components/TrustMesh";
import { greetingFor, overviewTotals } from "../model";
import { useOverview } from "../queries";

export default function OverviewPage() {
  const { me } = useAuth();
  const [range, setRange] = useState(24);
  const queryClient = useQueryClient();
  const overview = useOverview(range);

  if (overview.isError) {
    return (
      <>
        <PageHeader eyebrow="Command center" title="Security overview" />
        <ErrorState message={overview.error.message} onRetry={() => void overview.refetch()} />
      </>
    );
  }

  if (overview.isLoading || !overview.data) {
    return (
      <>
        <PageHeader eyebrow="Command center" title="Security overview" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <LoadingPanel key={index} rows={2} label="Reading posture" />
          ))}
        </div>
      </>
    );
  }

  const data = overview.data;
  const health = data.health;
  const { riskTotal, blocked } = overviewTotals(data);

  return (
    <>
      <PageHeader
        eyebrow="Command center"
        title={greetingFor(me?.display_name.split(" ")[0])}
        description="A live operating picture of identities, behavioral risk, and zero-trust enforcement. All figures originate from backend state."
        meta={
          <>
            <Badge tone="low" dot>
              {health.api === "operational" ? "API operational" : health.api}
            </Badge>
            <Badge tone={health.model === "available" ? "accent" : "high"} dot>
              Model {health.model === "available" ? "loaded" : health.model}
            </Badge>
            <span className="text-[10px] text-faint">Generated {formatRelativeTime(data.generated_at)}</span>
          </>
        }
        actions={
          <>
            <div className="flex rounded-lg border border-line/70 bg-surface/70 p-0.5">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRange(option.value)}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-[11px] font-medium transition",
                    range === option.value ? "bg-accent/15 text-accent" : "text-faint hover:text-ink",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void overview.refetch();
                void queryClient.invalidateQueries({ queryKey: ["notifications"] });
              }}
              loading={overview.isFetching}
            >
              <RefreshCw size={13} />
              Refresh
            </Button>
          </>
        }
      />

      {health.model !== "available" && (
        <div className="mb-4 rounded-xl border border-high/30 bg-high/[0.07] px-4 py-3 text-xs text-high">
          The anomaly model artifact is not available. Access evaluations requiring ML scoring will return a safe error
          until an administrator trains the model.
        </div>
      )}

      <MetricGrid data={data} blocked={blocked} />
      <OverviewCharts data={data} riskTotal={riskTotal} />
      <OverviewQueues data={data} />
      <TrustMesh data={data} />
    </>
  );
}
