import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Eye,
  EyeOff,
  Fingerprint,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { BrandMark } from "../../../components/layout/BrandMark";
import { cn } from "../../../lib/utils";
import { useAuth } from "../useAuth";
import { DEMO_ACCOUNTS, DEMO_ENABLED, DEMO_PASSWORD, DemoAccounts } from "../components/DemoAccounts";

export default function LoginPage() {
  const { login, isLoggingIn, loginError, clearLoginError } = useAuth();
  const [email, setEmail] = useState(DEMO_ENABLED ? DEMO_ACCOUNTS[0].email : "");
  const [password, setPassword] = useState<string>(DEMO_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("aegis.sessionNotice") === "expired") {
        setSessionExpired(true);
        sessionStorage.removeItem("aegis.sessionNotice");
      }
    } catch {
      // Session storage is optional.
    }
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLocalError(null);
    clearLoginError();
    setSessionExpired(false);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Sign-in failed.");
    }
  };

  const chooseAccount = (accountEmail: string) => {
    setEmail(accountEmail);
    setPassword((current) => DEMO_PASSWORD || current);
    setLocalError(null);
    clearLoginError();
  };

  const error = localError ?? loginError;

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-[-14%] h-[420px] w-[420px] rounded-full bg-accent/[0.07] blur-3xl" />
        <div className="absolute -right-32 top-[20%] h-[520px] w-[520px] rounded-full bg-accent-2/[0.08] blur-3xl" />
      </div>

      <div className="relative mx-auto grid min-h-screen max-w-[1320px] items-center gap-10 px-5 py-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-10">
        <section className="hidden animate-fade-up flex-col justify-between self-stretch py-5 lg:flex">
          <BrandMark />

          <div className="my-10 max-w-xl">
            <p className="eyebrow mb-4 flex items-center gap-2">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-low" />
              Adaptive zero-trust security
            </p>
            <h1 className="font-display text-[46px] font-semibold leading-[1.03] tracking-[-0.035em] text-ink">
              Trust nothing.
              <br />
              <span className="bg-gradient-to-r from-accent via-accent to-accent-2 bg-clip-text text-transparent">
                Verify everything.
              </span>
            </h1>
            <p className="mt-5 max-w-lg text-[15px] leading-7 text-muted text-pretty">
              AEGIS NEXUS correlates identity, device trust, and behavioral anomaly signals into
              explainable access decisions — with a policy engine that holds the final authority.
            </p>

            <div className="relative mx-auto mt-10 h-[300px] max-w-md">
              <div className="absolute left-1/2 top-1/2 h-[290px] w-[290px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-line/45" />
              <div className="absolute left-1/2 top-1/2 h-[218px] w-[218px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-accent/20" />
              <div className="absolute left-1/2 top-1/2 h-[142px] w-[142px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/20 bg-accent/[0.03]" />
              <div className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 animate-pulse-ring items-center justify-center rounded-full border border-accent/40 bg-surface text-accent shadow-glow">
                <ShieldCheck size={32} />
              </div>
              {[
                { label: "Identity", icon: Fingerprint, className: "left-[3%] top-[16%]" },
                { label: "Device trust", icon: LockKeyhole, className: "right-[1%] top-[26%]" },
                { label: "Behavior", icon: BrainCircuit, className: "bottom-[12%] left-[10%]" },
                { label: "Policy", icon: CheckCircle2, className: "bottom-[8%] right-[4%]" },
              ].map((node) => {
                const Icon = node.icon;
                return (
                  <div
                    key={node.label}
                    className={cn(
                      "absolute flex items-center gap-2 rounded-lg border border-line/80 bg-surface/85 px-3 py-2 text-[10px] font-medium text-muted shadow-panel backdrop-blur",
                      node.className,
                    )}
                  >
                    <Icon size={13} className="text-accent" />
                    {node.label}
                  </div>
                );
              })}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full border border-line bg-surface/80 px-3 py-1 text-[9px] uppercase tracking-[0.16em] text-faint">
                Isolation Forest · 10 signals
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] uppercase tracking-wider text-faint">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={12} className="text-low" /> Policy-gated
            </span>
            <span className="flex items-center gap-1.5">
              <LockKeyhole size={12} className="text-accent" /> Hash-chained audit
            </span>
            <span className="flex items-center gap-1.5">
              <BrainCircuit size={12} className="text-accent-2" /> Explainable anomaly ranking
            </span>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[440px] animate-fade-up animate-delay-1">
          <div className="mb-7 flex items-center justify-between lg:hidden">
            <BrandMark />
            {DEMO_ENABLED && (
              <span className="rounded-full border border-accent-2/30 bg-accent-2/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-accent-2">
                Demo
              </span>
            )}
          </div>

          <div className="panel relative overflow-hidden p-6 sm:p-7">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
            <div className="mb-6">
              <p className="eyebrow mb-2">Secure sign-in</p>
              <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">Enter the command center</h2>
              <p className="mt-1.5 text-xs leading-5 text-muted">
                Sessions use HttpOnly cookies and CSRF double-submit protection.
              </p>
            </div>

            {sessionExpired && (
              <div className="mb-4 rounded-lg border border-medium/30 bg-medium/10 px-3 py-2 text-[11px] text-medium">
                Your session expired or was revoked. Sign in again to continue.
              </div>
            )}

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label htmlFor="email" className="label">
                  Work email
                </label>
                <div className="relative">
                  <UserRound size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    required
                    className="input pl-9"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@aegisnexus.ai"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="label">
                  Password
                </label>
                <div className="relative">
                  <LockKeyhole size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    className="input pl-9 pr-10"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-faint transition hover:text-ink"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {error && (
                <div role="alert" className="rounded-lg border border-critical/30 bg-critical/10 px-3 py-2.5 text-[11px] leading-5 text-critical">
                  {error}
                </div>
              )}

              <button type="submit" className="btn-solid h-11 w-full" disabled={isLoggingIn}>
                {isLoggingIn ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-canvas/30 border-t-canvas" />
                    Verifying identity…
                  </>
                ) : (
                  <>
                    Sign in securely <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>

            {DEMO_ENABLED && <DemoAccounts onChoose={chooseAccount} />}

            <div className="mt-5 flex items-start gap-2 border-t border-line/60 pt-4 text-[10px] leading-4 text-faint">
              <BrainCircuit size={13} className="mt-0.5 shrink-0 text-accent-2" />
              Anomaly scores are behavioral rankings, not proof of compromise. Every decision remains
              policy-controlled and auditable.
            </div>
          </div>

          <p className="mt-5 text-center text-[10px] text-faint">
            AEGIS NEXUS AI prototype · Zero-trust access governance
          </p>
        </section>
      </div>
    </div>
  );
}
