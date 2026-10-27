import { CheckCircle2, Lock, ShieldCheck, TriangleAlert } from "lucide-react";
import { Panel, SectionHeading } from "../../../components/ui";
import { cn } from "../../../lib/utils";
import type { GuidanceItem } from "../model";

export function GuidancePanel({ guidance }: { guidance: GuidanceItem[] }) {
  return (
    <Panel className="p-4 sm:p-5">
      <SectionHeading eyebrow="Recommended actions" title="What to do next" />
      <div className="mt-3 space-y-2">
        {guidance.map((item) => (
          <div
            key={item.title}
            className={cn(
              "rounded-lg border p-3",
              item.tone === "success" && "border-low/25 bg-low/[0.05]",
              item.tone === "info" && "border-accent/25 bg-accent/[0.05]",
              item.tone === "warning" && "border-medium/30 bg-medium/[0.06]",
            )}
          >
            <div className="flex items-start gap-2">
              {item.tone === "success" ? (
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-low" />
              ) : item.tone === "warning" ? (
                <TriangleAlert size={14} className="mt-0.5 shrink-0 text-medium" />
              ) : (
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-accent" />
              )}
              <div>
                <p className="text-[11px] font-semibold text-ink">{item.title}</p>
                <p className="mt-0.5 text-[10px] leading-4 text-muted">{item.body}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-start gap-1.5 rounded-lg border border-line/60 bg-raised/30 p-2.5 text-[10px] leading-4 text-faint">
        <Lock size={12} className="mt-0.5 shrink-0" />
        Access decisions are enforced by server-side policy. The anomaly score flags unusual behavior but does not
        authorize access on its own.
      </div>
    </Panel>
  );
}
