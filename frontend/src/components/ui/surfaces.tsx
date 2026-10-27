import type { HTMLAttributes, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "../../lib/utils";

export function Panel({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={cn("panel", className)} {...props}>
      {children}
    </div>
  );
}

export function Card({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={cn("panel-quiet", className)} {...props}>
      {children}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink">{title}</h2>
        {description && <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 animate-fade-up">
      <div className="min-w-0">
        <p className="eyebrow mb-2 flex items-center gap-2">
          <span className="inline-block h-1 w-1 rounded-full bg-accent" />
          {eyebrow}
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted text-pretty">{description}</p>
        )}
        {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function StatCard({
  label,
  value,
  detail,
  icon,
  tone = "neutral",
  trend,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  tone?: "neutral" | "accent" | "low" | "medium" | "high" | "critical" | "violet";
  trend?: ReactNode;
}) {
  const accents = {
    neutral: "text-muted",
    accent: "text-accent",
    low: "text-low",
    medium: "text-medium",
    high: "text-high",
    critical: "text-critical",
    violet: "text-accent-2",
  };
  return (
    <div className="panel group relative overflow-hidden p-4 transition duration-300 hover:border-accent/25">
      <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-accent/5 blur-2xl transition group-hover:bg-accent/10" />
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">{label}</p>
        {icon && <span className={cn("opacity-80", accents[tone])}>{icon}</span>}
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <p className="font-display text-[28px] font-semibold leading-none tracking-tight text-ink">
          {value}
        </p>
        {trend}
      </div>
      {detail && <div className="mt-2.5 text-xs leading-5 text-muted">{detail}</div>}
    </div>
  );
}

export function Callout({
  tone = "info",
  title,
  children,
  icon,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  title?: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  const styles = {
    info: "border-accent/25 bg-accent/[0.06] text-accent",
    warning: "border-medium/30 bg-medium/[0.07] text-medium",
    danger: "border-critical/30 bg-critical/[0.07] text-critical",
    success: "border-low/30 bg-low/[0.07] text-low",
  };
  return (
    <div className={cn("rounded-xl border p-3.5", styles[tone])}>
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 shrink-0">{icon ?? <AlertTriangle size={15} />}</div>
        <div className="min-w-0">
          {title && <p className="text-xs font-semibold">{title}</p>}
          <div className={cn("text-xs leading-5", title && "mt-0.5", "text-muted")}>{children}</div>
        </div>
      </div>
    </div>
  );
}
