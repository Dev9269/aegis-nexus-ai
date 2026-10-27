import { Check, X } from "lucide-react";
import { Badge, Panel, SectionHeading } from "../../../components/ui";
import { cn, ROLE_LABELS } from "../../../lib/utils";
import type { Role } from "../../../types/api";

const CAPABILITIES: Array<{
  label: string;
  roles: Record<Role, boolean>;
}> = [
  { label: "View security overview", roles: { SECURITY_ADMIN: true, SECURITY_ANALYST: true, EMPLOYEE: false, AUDITOR: true } },
  { label: "Evaluate access", roles: { SECURITY_ADMIN: true, SECURITY_ANALYST: true, EMPLOYEE: false, AUDITOR: false } },
  { label: "Preview policies", roles: { SECURITY_ADMIN: true, SECURITY_ANALYST: true, EMPLOYEE: false, AUDITOR: false } },
  { label: "Publish policies", roles: { SECURITY_ADMIN: true, SECURITY_ANALYST: false, EMPLOYEE: false, AUDITOR: false } },
  { label: "Change device posture", roles: { SECURITY_ADMIN: true, SECURITY_ANALYST: false, EMPLOYEE: false, AUDITOR: false } },
  { label: "Update incidents", roles: { SECURITY_ADMIN: true, SECURITY_ANALYST: true, EMPLOYEE: false, AUDITOR: false } },
  { label: "Retrain model", roles: { SECURITY_ADMIN: true, SECURITY_ANALYST: false, EMPLOYEE: false, AUDITOR: false } },
  { label: "View audit ledger", roles: { SECURITY_ADMIN: true, SECURITY_ANALYST: true, EMPLOYEE: false, AUDITOR: true } },
  { label: "Export audit ledger", roles: { SECURITY_ADMIN: true, SECURITY_ANALYST: true, EMPLOYEE: false, AUDITOR: true } },
  { label: "Run demo scenarios", roles: { SECURITY_ADMIN: true, SECURITY_ANALYST: true, EMPLOYEE: false, AUDITOR: false } },
  { label: "Reset demo environment", roles: { SECURITY_ADMIN: true, SECURITY_ANALYST: false, EMPLOYEE: false, AUDITOR: false } },
  { label: "Request own access", roles: { SECURITY_ADMIN: true, SECURITY_ANALYST: true, EMPLOYEE: true, AUDITOR: false } },
];

export function CapabilityMatrix({ role }: { role: Role | undefined }) {
  return (
    <Panel className="overflow-hidden">
      <div className="border-b border-line/60 p-4 sm:p-5">
        <SectionHeading
          eyebrow="Least privilege"
          title="Server-enforced capabilities"
          description="UI affordances mirror these boundaries, but the backend independently authorizes every request."
          action={<Badge tone="accent">{role ? ROLE_LABELS[role] : "\uFFFD"}</Badge>}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Capability</th>
              <th className="text-center">Admin</th>
              <th className="text-center">Analyst</th>
              <th className="text-center">Employee</th>
              <th className="text-center">Auditor</th>
            </tr>
          </thead>
          <tbody>
            {CAPABILITIES.map((capability) => (
              <tr key={capability.label}>
                <td className={cn("text-[11px]", capability.roles[role ?? "AUDITOR"] ? "text-ink" : "text-muted")}>
                  {capability.label}
                </td>
                {(["SECURITY_ADMIN", "SECURITY_ANALYST", "EMPLOYEE", "AUDITOR"] as Role[]).map((roleKey) => (
                  <td key={roleKey} className="text-center">
                    <span
                      className={cn(
                        "inline-flex h-5 w-5 items-center justify-center rounded-full border",
                        capability.roles[roleKey]
                          ? "border-low/30 bg-low/10 text-low"
                          : "border-line/60 bg-raised/40 text-faint",
                      )}
                    >
                      {capability.roles[roleKey] ? <Check size={11} /> : <X size={10} />}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
