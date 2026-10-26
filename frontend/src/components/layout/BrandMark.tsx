import { ShieldCheck } from "lucide-react";
import { cn } from "../../lib/utils";

export function BrandMark({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-accent shadow-[0_0_28px_-8px_rgb(var(--accent)/0.7)]">
        <ShieldCheck size={19} />
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-surface bg-low" />
      </div>
      {!collapsed && (
        <div className="min-w-0">
          <p className="font-display text-[15px] font-semibold tracking-[0.16em] text-ink">AEGIS</p>
          <p className="text-[9px] font-medium uppercase tracking-[0.28em] text-faint">Nexus AI</p>
        </div>
      )}
    </div>
  );
}
