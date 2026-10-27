import type { ReactNode } from "react";
import { AlertTriangle, Inbox, Loader2, RefreshCw } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./forms";

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
