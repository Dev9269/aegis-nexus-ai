import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ClipboardCheck, Lock, Shield, XCircle } from "lucide-react";
import { api } from "../services/api";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  Panel,
  Spinner,
} from "../components/ui";
import { useToast } from "../hooks/useToast";

export default function CompliancePage() {
  const toast = useToast();
  const [framework, setFramework] = useState("SOC2");
  const report = useQuery({
    queryKey: ["compliance", framework],
    queryFn: () => api.complianceReport(framework),
  });
  const encryption = useQuery({
    queryKey: ["security", "encryption"],
    queryFn: () => api.encryptionPosture(),
  });
  const authentication = useQuery({
    queryKey: ["security", "authentication"],
    queryFn: () => api.authenticationPosture(),
  });

  return (
    <>
      <PageHeader
        eyebrow="Compliance assurance"
        title="Compliance control evidence"
        description="SOC2 / GDPR / HIPAA control mapping with automated evidence collection from the live system."
        actions={
          <div className="flex gap-2">
            {["SOC2", "GDPR", "HIPAA"].map((fw) => (
              <Button
                key={fw}
                variant={framework === fw ? "solid" : "secondary"}
                size="sm"
                onClick={() => setFramework(fw)}
              >
                {fw}
              </Button>
            ))}
          </div>
        }
      />

      {encryption.data ? (
        <Panel>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock size={16} className="text-accent" />
              <p className="text-sm font-semibold text-ink">Encryption at rest</p>
            </div>
            <Badge tone="low">{encryption.data.algorithm}</Badge>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-3">
            <div className="rounded-lg border border-line/60 p-3">
              <p className="text-[10px] text-faint">Key source</p>
              <p className="text-xs font-semibold text-ink">{encryption.data.key_source}</p>
            </div>
            <div className="rounded-lg border border-line/60 p-3">
              <p className="text-[10px] text-faint">Key version</p>
              <p className="text-xs font-semibold text-ink">{encryption.data.key_version}</p>
            </div>
            <div className="rounded-lg border border-line/60 p-3">
              <p className="text-[10px] text-faint">Encrypted records</p>
              <p className="text-xs font-semibold text-ink">{encryption.data.encrypted_record_count}</p>
            </div>
            <div className="rounded-lg border border-line/60 p-3">
              <p className="text-[10px] text-faint">Plaintext leaks</p>
              <p className={`text-xs font-semibold ${encryption.data.plaintext_leaks === 0 ? "text-accent" : "text-critical"}`}>
                {encryption.data.plaintext_leaks}
              </p>
            </div>
          </div>
          <div className="mt-3 space-y-1 text-[10px] text-faint">
            <p><span className="text-ink">In transit:</span> {encryption.data.in_transit}</p>
            <p><span className="text-ink">At rest:</span> {encryption.data.at_rest}</p>
            <p><span className="text-ink">Secrets:</span> {encryption.data.secrets}</p>
          </div>
          {encryption.data.sample ? (
            <div className="mt-3 rounded-lg border border-line/60 bg-base/40 p-3">
              <p className="text-[10px] font-semibold text-ink">
                Live proof — {encryption.data.sample.table}.{encryption.data.sample.field}
              </p>
              <div className="mt-2 space-y-1 font-mono text-[10px]">
                <p className="break-all text-faint">
                  <span className="text-critical">on disk:</span>{" "}
                  {encryption.data.sample.stored_ciphertext.slice(0, 96)}…
                </p>
                <p className="break-all text-faint">
                  <span className="text-accent">decrypted:</span>{" "}
                  {encryption.data.sample.decrypted_value}
                </p>
              </div>
            </div>
          ) : null}
          <p className="mt-3 text-[10px] text-faint">
            Encrypted fields: {encryption.data.encrypted_fields.join(", ")}
          </p>
        </Panel>
      ) : null}

      {authentication.data ? (
        <div className="mt-4">
          <Panel>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-accent" />
                <p className="text-sm font-semibold text-ink">Authentication verification</p>
              </div>
              <Badge tone={authentication.data.audit_chain.verified ? "low" : "critical"}>
                {authentication.data.audit_chain.verified ? "VERIFIED" : "FAILED"}
              </Badge>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-line/60 p-3">
                <p className="text-[10px] text-faint">Password hashing</p>
                <p className="text-xs font-semibold text-ink">
                  {authentication.data.password_hashing.algorithm} · N=
                  {authentication.data.password_hashing.parameters.N}, r=
                  {authentication.data.password_hashing.parameters.r}, p=
                  {authentication.data.password_hashing.parameters.p}
                </p>
                <p className="mt-1 text-[10px] text-faint">
                  plaintext passwords stored:{" "}
                  {authentication.data.password_hashing.plaintext_passwords_stored}
                </p>
              </div>
              <div className="rounded-lg border border-line/60 p-3">
                <p className="text-[10px] text-faint">Session tokens</p>
                <p className="text-xs font-semibold text-ink">SHA-256 hashed at rest</p>
                <p className="mt-1 text-[10px] text-faint">
                  raw tokens stored: {authentication.data.session_tokens.raw_tokens_stored} ·
                  active: {authentication.data.session_tokens.active_sessions} · revoked:{" "}
                  {authentication.data.session_tokens.revoked_sessions}
                </p>
              </div>
              <div className="rounded-lg border border-line/60 p-3">
                <p className="text-[10px] text-faint">CSRF</p>
                <p className="text-xs font-semibold text-ink">
                  {authentication.data.csrf.enabled ? "Enabled" : "Disabled"} — double-submit
                </p>
                <p className="mt-1 text-[10px] text-faint">{authentication.data.csrf.mode}</p>
              </div>
              <div className="rounded-lg border border-line/60 p-3">
                <p className="text-[10px] text-faint">Cookies</p>
                <p className="text-xs font-semibold text-ink">
                  HttpOnly: {String(authentication.data.cookies.session_cookie_httponly)} · Secure:{" "}
                  {String(authentication.data.cookies.session_cookie_secure)} · SameSite:{" "}
                  {authentication.data.cookies.samesite}
                </p>
                <p className="mt-1 text-[10px] text-faint">
                  login rate limit: {authentication.data.login_rate_limit.limit}/
                  {authentication.data.login_rate_limit.window_seconds}s
                </p>
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-line/60 bg-base/40 p-3">
              <p className="text-[10px] font-semibold text-ink">Live proof (values read from the database)</p>
              <div className="mt-2 space-y-1 font-mono text-[10px] text-faint">
                <p className="break-all">
                  <span className="text-accent">password hash:</span>{" "}
                  {authentication.data.password_hashing.sample_hash_prefix}
                </p>
                <p className="break-all">
                  <span className="text-accent">session token:</span>{" "}
                  {authentication.data.session_tokens.sample_token_hash}
                </p>
              </div>
            </div>
            <div className="mt-3 space-y-1 text-[10px] text-faint">
              <p>
                <span className="text-ink">Authorization probe:</span> no session →{" "}
                {authentication.data.authorization.probe.no_session_status}, employee role →{" "}
                {authentication.data.authorization.probe.employee_role_status}, staff role →{" "}
                {authentication.data.authorization.probe.staff_role_status}{" "}
                <span
                  className={
                    authentication.data.authorization.probe.enforced
                      ? "text-accent"
                      : "text-critical"
                  }
                >
                  (
                  {authentication.data.authorization.probe.enforced
                    ? "enforced"
                    : "not enforced"}
                  )
                </span>
              </p>
              <p>
                <span className="text-ink">Authorization:</span>{" "}
                {authentication.data.authorization.mode} —{" "}
                {authentication.data.authorization.staff_only_routes.length} staff-only routes
              </p>
              <p>
                <span className="text-ink">Audit chain:</span>{" "}
                {authentication.data.audit_chain.message} (
                {authentication.data.audit_chain.records} records)
              </p>
            </div>
          </Panel>
        </div>
      ) : null}

      <div className="mt-4">
      {report.isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : report.isError ? (
        <ErrorState message={report.error.message} onRetry={() => void report.refetch()} />
      ) : report.data ? (
        <div className="space-y-4">
          <Panel>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-ink">{report.data.framework} Compliance Report</p>
                <p className="text-[10px] text-faint">Generated {new Date(report.data.generated_at).toLocaleString()}</p>
              </div>
              <Badge tone={report.data.overall_status === "COMPLIANT" ? "low" : "critical"}>
                {report.data.overall_status}
              </Badge>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-line/60 p-3 text-center">
                <p className="font-display text-2xl font-bold text-ink">{report.data.summary.passed}</p>
                <p className="text-[10px] text-faint">Passed</p>
              </div>
              <div className="rounded-lg border border-line/60 p-3 text-center">
                <p className="font-display text-2xl font-bold text-ink">{report.data.summary.failed}</p>
                <p className="text-[10px] text-faint">Failed</p>
              </div>
              <div className="rounded-lg border border-line/60 p-3 text-center">
                <p className="font-display text-2xl font-bold text-ink">{report.data.summary.pass_rate}%</p>
                <p className="text-[10px] text-faint">Pass rate</p>
              </div>
            </div>
          </Panel>

          <div className="space-y-2">
            {report.data.controls.map((control) => (
              <div key={control.control_id} className="rounded-xl border border-line/65 bg-raised/30 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {control.status === "PASS" ? (
                      <CheckCircle2 size={16} className="mt-0.5 text-accent" />
                    ) : (
                      <XCircle size={16} className="mt-0.5 text-critical" />
                    )}
                    <div>
                      <p className="text-xs font-semibold text-ink">
                        {control.control_id} — {control.name}
                      </p>
                      <p className="mt-1 text-[10px] leading-4 text-faint">{control.evidence}</p>
                    </div>
                  </div>
                  <Badge tone={control.status === "PASS" ? "low" : "critical"}>{control.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState icon={<ClipboardCheck size={18} />} title="No report" description="Generate a compliance report." />
      )}
      </div>
    </>
  );
}
