import { Cookie, Lock, ShieldCheck, Timer } from "lucide-react";
import { Callout, Panel } from "../../../components/ui";

export function TrustBoundaries({ limitations }: { limitations: string[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel className="p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Lock size={15} className="text-accent" />
          <p className="text-xs font-semibold text-ink">Limitations and trust boundaries</p>
        </div>
        <ul className="mt-3 space-y-2">
          {limitations.map((limitation) => (
            <li key={limitation} className="flex items-start gap-2 text-[11px] leading-5 text-muted">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-medium" />
              {limitation}
            </li>
          ))}
        </ul>
      </Panel>

      <div className="space-y-3">
        <Callout tone="info" icon={<Cookie size={15} />} title="Session and CSRF design">
          Session tokens live in HttpOnly cookies. Mutating requests require the CSRF cookie value to be echoed in the{" "}
          <span className="font-mono text-[10px]">X-CSRF-Token</span> header.
        </Callout>
        <Callout tone="success" icon={<ShieldCheck size={15} />} title="Fail-closed policy engine">
          Mandatory identity, account, role, device, session, and resource checks are evaluated before risk thresholds.
          The anomaly model can escalate controls but never grant access.
        </Callout>
        <Callout tone="warning" icon={<Timer size={15} />} title="Prototype boundaries">
          This is a self-contained hackathon prototype using synthetic data. It is not a production identity provider
          and has no external SSO, MFA, or threat-intel integration.
        </Callout>
      </div>
    </div>
  );
}
