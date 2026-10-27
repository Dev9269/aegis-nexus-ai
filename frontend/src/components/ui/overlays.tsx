import { useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { useDialogFocus } from "../../hooks/useDialogFocus";

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
  const dialogRef = useDialogFocus<HTMLDivElement>(open, onClose);

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
        ref={dialogRef}
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
  const dialogRef = useDialogFocus<HTMLElement>(open, onClose);

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
        ref={dialogRef}
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
