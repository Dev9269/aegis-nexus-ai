import { Link } from "react-router-dom";
import { ArrowLeft, Compass } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

export default function NotFoundPage() {
  const { isStaff } = useAuth();
  const home = isStaff ? "/" : "/me";

  return (
    <div className="panel mx-auto mt-12 max-w-xl p-8 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-accent/30 bg-accent/10 text-accent">
        <Compass size={24} />
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-accent">404 · Route not found</p>
      <h1 className="mt-2 font-display text-xl font-semibold text-ink">This console path does not exist</h1>
      <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-muted">
        The page may have moved, or the link was mistyped. Use the navigation to return to an authorized area.
      </p>
      <Link to={home} className="btn-primary mt-5">
        <ArrowLeft size={14} /> Back to {isStaff ? "overview" : "my security"}
      </Link>
    </div>
  );
}
