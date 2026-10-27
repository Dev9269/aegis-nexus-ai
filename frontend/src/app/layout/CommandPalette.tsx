import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Command, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { visibleNav } from "../../lib/navigation";
import { useAuth } from "../../hooks/useAuth";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import { cn } from "../../lib/utils";

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const dialogRef = useDialogFocus<HTMLDivElement>(open, onClose);

  const results = useMemo(() => {
    if (!me) return [];
    const items = visibleNav(me.role);
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) =>
      `${item.label} ${item.description} ${item.group}`.toLowerCase().includes(needle),
    );
  }, [me, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
  }, [open]);

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(0, results.length - 1)));
  }, [results.length]);

  if (!open) return null;

  const go = (to: string) => {
    navigate(to);
    onClose();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault();
      go(results[activeIndex].to);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[14vh]">
      <button
        type="button"
        aria-label="Close command palette"
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative w-full max-w-xl animate-fade-up overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-line/65 px-4">
          <Search size={17} className="shrink-0 text-faint" />
          <input
            data-autofocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Jump to a workspace..."
            className="h-12 flex-1 bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none"
            aria-label="Search pages"
          />
          <kbd className="hidden items-center gap-0.5 rounded border border-line bg-raised px-1.5 py-0.5 text-[9px] text-faint sm:flex">
            ESC
          </kbd>
        </div>
        <div className="scrollbar-thin max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-muted">No workspace matches “{query}”.</p>
          ) : (
            results.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.to}
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => go(item.to)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition",
                    activeIndex === index ? "bg-accent/10" : "hover:bg-raised/70",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                      activeIndex === index
                        ? "border-accent/30 bg-accent/10 text-accent"
                        : "border-line bg-raised text-muted",
                    )}
                  >
                    <Icon size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-ink">{item.label}</span>
                      <span className="text-[9px] uppercase tracking-wider text-faint">{item.group}</span>
                    </span>
                    <span className="block truncate text-[11px] text-muted">{item.description}</span>
                  </span>
                  {activeIndex === index && <ArrowRight size={13} className="text-accent" />}
                </button>
              );
            })
          )}
        </div>
        <div className="flex items-center justify-between border-t border-line/60 bg-raised/30 px-3 py-2 text-[10px] text-faint">
          <span className="flex items-center gap-1.5">
            <Command size={11} /> Navigation only
          </span>
          <span>↑↓ navigate · ↵ open</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
