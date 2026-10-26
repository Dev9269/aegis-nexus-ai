import {
  useEffect,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Inbox,
  Loader2,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import {
  cn,
  DECISION_STYLES,
  INCIDENT_STATUS_LABELS,
  RISK_STYLES,
  SEVERITY_STYLES,
  initials,
  riskTone,
} from "../../lib/utils";
import type { Decision, IncidentStatus, RiskCategory, Severity } from "../../types/api";

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

export function Button({
  variant = "secondary",
  size = "md",
  loading,
  children,
  className,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "solid" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  loading?: boolean;
}) {
  return (
    <button
      className={cn(
        variant === "primary" && "btn-primary",
        variant === "solid" && "btn-solid",
        variant === "secondary" && "btn-secondary",
        variant === "ghost" && "btn-ghost",
        variant === "danger" && "btn-danger",
        size === "sm" && "btn-sm",
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

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

export function Progress({
  value,
  tone = "accent",
  className,
  label,
}: {
  value: number;
  tone?: "accent" | "low" | "medium" | "high" | "critical" | "violet";
  className?: string;
  label?: string;
}) {
  const tones = {
    accent: "bg-accent",
    low: "bg-low",
    medium: "bg-medium",
    high: "bg-high",
    critical: "bg-critical",
    violet: "bg-accent-2",
  };
  return (
    <div className={cn("w-full", className)} aria-label={label}>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-line/60">
        <div
          className={cn("h-full rounded-full transition-all duration-500", tones[tone])}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

export function RiskGauge({
  score,
  size = 132,
  label = "Risk index",
}: {
  score: number;
  size?: number;
  label?: string;
}) {
  const category = riskTone(score);
  const color = `rgb(var(--${category.toLowerCase()}))`;
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.max(0, Math.min(100, score)) / 100) * circumference;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" className="-rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="rgb(var(--line) / 0.55)" strokeWidth="8" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-semibold text-ink">{score.toFixed(0)}</span>
        <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-faint">{label}</span>
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton h-4 w-full", className)} />;
}

export function LoadingPanel({ rows = 4, label = "Loading secure data" }: { rows?: number; label?: string }) {
  return (
    <div className="panel p-5" role="status" aria-label={label}>
      <div className="mb-4 flex items-center gap-2 text-xs text-muted">
        <Loader2 size={14} className="animate-spin text-accent" />
        {label}
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className={cn("h-10", index === 0 && "h-14")} />
        ))}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-line bg-raised/70 text-faint">
        {icon ?? <Inbox size={18} />}
      </div>
      <p className="font-display text-sm font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs leading-5 text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Unable to load this view",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="panel flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-critical/30 bg-critical/10 text-critical">
        <AlertTriangle size={18} />
      </div>
      <p className="font-display text-sm font-semibold text-ink">{title}</p>
      {message && <p className="mt-1 max-w-md text-xs leading-5 text-muted">{message}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          <RefreshCw size={13} />
          Retry
        </Button>
      )}
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-[11px] text-critical">{error}</p>
      ) : (
        hint && <p className="mt-1 text-[11px] leading-4 text-faint">{hint}</p>
      )}
    </div>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("input", className)} {...props} />;
}

export function SearchInput({
  className,
  value,
  onChange,
  placeholder = "Search",
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
      <input
        className="input pl-9"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        {...props}
      />
    </div>
  );
}

export function SelectInput({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select className={cn("select", className)} {...props}>
      {children}
    </select>
  );
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("textarea", className)} {...props} />;
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border border-line/70 bg-raised/40 p-3 transition hover:border-line",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition",
          checked ? "border-accent/60 bg-accent/30" : "border-line bg-canvas",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all",
            checked ? "left-[18px] bg-accent" : "left-0.5 bg-faint",
          )}
        />
      </button>
      <span>
        <span className="block text-xs font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-[11px] leading-4 text-muted">{description}</span>}
      </span>
    </label>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: Array<{ id: T; label: string; count?: number }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-1 overflow-x-auto rounded-lg border border-line/60 bg-raised/40 p-1", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
            value === tab.id ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="rounded bg-line/50 px-1 text-[9px] text-muted">{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: "max-w-md", md: "max-w-2xl", lg: "max-w-4xl", xl: "max-w-6xl" };
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 animate-fade-in bg-black/65 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative flex max-h-[92vh] w-full animate-fade-up flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl",
          widths[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line/65 px-5 py-4">
          <div>
            <h2 id={titleId} className="font-display text-base font-semibold text-ink">
              {title}
            </h2>
            {description && <p className="mt-1 text-xs leading-5 text-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-faint transition hover:bg-raised hover:text-ink"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-line/65 bg-raised/35 px-5 py-3.5">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  width = "wide",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: "normal" | "wide";
}) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[65]">
      <button
        type="button"
        aria-label="Close panel"
        className="absolute inset-0 animate-fade-in bg-black/55 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "absolute inset-y-0 right-0 flex w-full animate-fade-in flex-col border-l border-line bg-surface shadow-2xl",
          width === "wide" ? "max-w-2xl" : "max-w-lg",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line/65 px-5 py-4">
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
            <h2 id={titleId} className="truncate font-display text-base font-semibold text-ink">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-faint transition hover:bg-raised hover:text-ink"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-line/65 bg-raised/35 px-5 py-3.5">{footer}</div>}
      </aside>
    </div>,
    document.body,
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/55 px-3 py-2.5 text-xs text-muted">
      <span>
        {start}–{end} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="px-2 text-[11px] text-muted">
          {page} / {pageCount}
        </span>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => onPage(page + 1)}
          disabled={page >= pageCount}
          aria-label="Next page"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

export function KeyValue({
  label,
  value,
  mono,
  className,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">{label}</dt>
      <dd className={cn("mt-1 break-words text-xs leading-5 text-ink", mono && "font-mono text-[11px]")}>
        {value || "—"}
      </dd>
    </div>
  );
}

export function CopyInline({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="group inline-flex max-w-full items-center gap-1.5 rounded-md font-mono text-[11px] text-muted transition hover:text-ink"
      title="Copy value"
    >
      <span className="truncate">{label ?? value}</span>
      {copied ? (
        <Check size={12} className="shrink-0 text-low" />
      ) : (
        <Copy size={12} className="shrink-0 text-faint transition group-hover:text-accent" />
      )}
    </button>
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

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={cn("animate-spin text-accent", className)} />;
}

export function ForbiddenState({ message }: { message?: string }) {
  return (
    <div className="panel mx-auto mt-10 max-w-lg p-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-critical/30 bg-critical/10 text-critical">
        <AlertTriangle size={20} />
      </div>
      <h1 className="font-display text-lg font-semibold">Access boundary enforced</h1>
      <p className="mt-2 text-sm leading-6 text-muted">
        {message ?? "Your role does not have permission to view this area. This is AEGIS enforcing least privilege."}
      </p>
    </div>
  );
}
