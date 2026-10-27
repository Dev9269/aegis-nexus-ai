import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useToastStore, type ToastTone } from "./store";
import { cn } from "../../lib/utils";

const TONE_STYLES: Record<ToastTone, string> = {
  success: "border-low/35 bg-surface text-ink",
  error: "border-critical/35 bg-surface text-ink",
  info: "border-accent/35 bg-surface text-ink",
};

const TONE_ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

export function Toaster() {
  const toasts = useToastStore((state) => state.items);
  const remove = useToastStore((state) => state.remove);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[90] flex w-[min(92vw,380px)] flex-col gap-2">
      {toasts.map((toast) => {
        const Icon = TONE_ICONS[toast.tone];
        return (
          <div
            key={toast.id}
            role="status"
            className={cn(
              "pointer-events-auto flex animate-fade-up items-start gap-3 rounded-xl border p-3.5 shadow-panel",
              TONE_STYLES[toast.tone],
            )}
          >
            <Icon
              size={17}
              className={cn(
                "mt-0.5 shrink-0",
                toast.tone === "success" && "text-low",
                toast.tone === "error" && "text-critical",
                toast.tone === "info" && "text-accent",
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-5">{toast.title}</p>
              {toast.description && (
                <p className="mt-0.5 text-xs leading-5 text-muted">{toast.description}</p>
              )}
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => remove(toast.id)}
              className="rounded p-1 text-faint transition hover:bg-raised hover:text-ink"
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
