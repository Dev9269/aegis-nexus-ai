import type { ReactNode } from "react";
import {
  cn,
  DECISION_STYLES,
  INCIDENT_STATUS_LABELS,
  SEVERITY_STYLES,
  initials,
  riskTone,
} from "../../lib/utils";
import type { Decision, IncidentStatus, RiskCategory, Severity } from "../../types/api";

export function Badge({
  children,
  tone = "neutral",
  className,
  dot,
  title,
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "low" | "medium" | "high" | "critical" | "violet";
  className?: string;
  dot?: boolean;
  title?: string;
}) {
  const tones = {
    neutral: "border-line bg-raised/70 text-muted",
    accent: "border-accent/25 bg-accent/10 text-accent",
    low: "border-low/30 bg-low/10 text-low",
    medium: "border-medium/30 bg-medium/10 text-medium",
    high: "border-high/30 bg-high/10 text-high",
    critical: "border-critical/35 bg-critical/10 text-critical",
    violet: "border-accent-2/30 bg-accent-2/10 text-accent-2",
  };
  return (
    <span className={cn("chip", tones[tone], className)} title={title}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function RiskBadge({ score, showScore = true }: { score: number; showScore?: boolean }) {
  const category = riskTone(score);
  return (
    <Badge tone={category.toLowerCase() as Lowercase<RiskCategory>} dot>
      {showScore ? `${score.toFixed(0)} · ${category}` : category}
    </Badge>
  );
}

export function DecisionBadge({ decision }: { decision: Decision }) {
  return (
    <span className={cn("chip", DECISION_STYLES[decision])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {decision}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={cn("chip", SEVERITY_STYLES[severity])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {severity}
    </span>
  );
}

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  const tone =
    status === "OPEN"
      ? "critical"
      : status === "INVESTIGATING"
        ? "high"
        : status === "CONTAINED"
          ? "medium"
          : status === "RESOLVED"
            ? "low"
            : "neutral";
  return <Badge tone={tone}>{INCIDENT_STATUS_LABELS[status]}</Badge>;
}

export function SimulatedTag({ value = true }: { value?: boolean }) {
  if (!value) return null;
  return (
    <Badge tone="violet" title="Synthetic demo data">
      Simulated
    </Badge>
  );
}

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = { sm: "h-7 w-7 text-[10px]", md: "h-9 w-9 text-xs", lg: "h-12 w-12 text-sm" };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-accent/25 bg-gradient-to-br from-accent/20 to-accent-2/15 font-semibold tracking-wide text-accent",
        sizes[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
