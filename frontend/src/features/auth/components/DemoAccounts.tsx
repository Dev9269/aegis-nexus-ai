import { useState } from "react";
import { Sparkles } from "lucide-react";

export const DEMO_ENABLED =
  import.meta.env.VITE_DEMO_MODE === "true" ||
  (import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE !== "false");
export const DEMO_PASSWORD =
  import.meta.env.VITE_DEMO_PASSWORD ??
  (import.meta.env.DEV && DEMO_ENABLED ? "ChangeMe-Demo!2026" : "");

export const DEMO_ACCOUNTS = [
  { email: "admin@aegisnexus.ai", label: "Avery Cole", role: "Security admin" },
  { email: "analyst@aegisnexus.ai", label: "Jordan Reyes", role: "Security analyst" },
  { email: "auditor@aegisnexus.ai", label: "Priya Nair", role: "Auditor \uFFFD read only" },
  { email: "maya.chen@aegisnexus.ai", label: "Maya Chen", role: "Employee \uFFFD Finance" },
];

export function DemoAccounts({ onChoose }: { onChoose: (email: string) => void }) {
  const [showAccounts, setShowAccounts] = useState(false);

  return (
    <div className="mt-5 rounded-xl border border-line/65 bg-raised/40 p-3">
      <button
        type="button"
        onClick={() => setShowAccounts((open) => !open)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-2 text-[11px] font-medium text-muted">
          <Sparkles size={13} className="text-accent-2" />
          Seeded demo accounts
        </span>
        <span className="text-[10px] text-accent">{showAccounts ? "Hide" : "Choose"}</span>
      </button>
      {showAccounts ? (
        <div className="mt-2.5 grid gap-1.5">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => {
                onChoose(account.email);
                setShowAccounts(false);
              }}
              className="flex items-center justify-between gap-2 rounded-md border border-transparent px-2 py-1.5 text-left transition hover:border-line hover:bg-surface"
            >
              <span>
                <span className="block text-[11px] font-medium text-ink">{account.label}</span>
                <span className="block font-mono text-[9px] text-faint">{account.email}</span>
              </span>
              <span className="text-[9px] uppercase tracking-wider text-muted">{account.role}</span>
            </button>
          ))}
          {DEMO_PASSWORD && (
            <p className="px-2 pt-1 text-[9px] leading-4 text-faint">
              Demo password: <span className="font-mono text-muted">{DEMO_PASSWORD}</span>
            </p>
          )}
        </div>
      ) : (
        <p className="mt-1.5 text-[10px] leading-4 text-faint">
          Quickly load admin, analyst, auditor, or employee credentials.
        </p>
      )}
    </div>
  );
}
