import { useState, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { cn, riskTone } from "../../lib/utils";

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
