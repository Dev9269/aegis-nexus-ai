import { Loader2 } from "lucide-react";
import { BrandMark } from "../../components/layout/BrandMark";

export function BootSplash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="flex flex-col items-center gap-4">
        <BrandMark />
        <span className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-faint">
          <Loader2 size={12} className="animate-spin text-accent" />
          Establishing session
        </span>
      </div>
    </div>
  );
}
