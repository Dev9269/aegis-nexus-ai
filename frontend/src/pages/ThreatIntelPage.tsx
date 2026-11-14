import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Globe, Shield, XCircle } from "lucide-react";
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

const SEVERITY_TONE: Record<string, "critical" | "high" | "medium" | "low"> = {
  CRITICAL: "critical",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
};

export default function ThreatIntelPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [severityFilter, setSeverityFilter] = useState<string>("");

  const summary = useQuery({
    queryKey: ["threat-intel-summary"],
    queryFn: () => api.threatIntelSummary(),
  });
  const findings = useQuery({
    queryKey: ["threat-intel-findings", statusFilter, severityFilter],
    queryFn: () => api.threatIntelFindings({ status: statusFilter || undefined, severity: severityFilter || undefined }),
  });

  const simulate = useMutation({
    mutationFn: () => api.simulateLeak(),
    onSuccess: (r) => {
      toast.info(r.message, "New leak finding");
      void qc.invalidateQueries({ queryKey: ["threat-intel"] });
    },
    onError: (e: Error) => toast.error(e.message, "Simulate failed"),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.updateLeakFinding(id, status),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["threat-intel"] }),
  });

  return (
    <>
      <PageHeader
        eyebrow="Threat intelligence"
        title="Dark-web leak & exposure monitor"
        description="Monitors paste sites, credential dumps, and dark-web forums for leaked credentials tied to your identities. Simulated data source for demo."
        actions={
          <Button variant="solid" size="sm" onClick={() => simulate.mutate()} disabled={simulate.isPending}>
            {simulate.isPending ? "Simulating..." : "Simulate new leak"}
          </Button>
        }
      />

      {summary.data && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-6">
          {[
            { label: "Total", value: summary.data.total },
            { label: "New", value: summary.data.new },
            { label: "Triaged", value: summary.data.triaged },
            { label: "Resolved", value: summary.data.resolved },
            { label: "Critical", value: summary.data.critical },
            { label: "High", value: summary.data.high },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-line/60 p-3 text-center">
              <p className="font-display text-xl font-bold text-ink">{s.value}</p>
              <p className="text-[10px] text-faint">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <select
          className="rounded-md border border-line bg-surface px-2 py-1 text-xs"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="NEW">NEW</option>
          <option value="TRIAGED">TRIAGED</option>
          <option value="RESOLVED">RESOLVED</option>
          <option value="FALSE_POSITIVE">FALSE_POSITIVE</option>
        </select>
        <select
          className="rounded-md border border-line bg-surface px-2 py-1 text-xs"
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
        >
          <option value="">All severities</option>
          <option value="CRITICAL">CRITICAL</option>
          <option value="HIGH">HIGH</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="LOW">LOW</option>
        </select>
      </div>

      {findings.isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : findings.isError ? (
        <ErrorState message={findings.error.message} onRetry={() => void findings.refetch()} />
      ) : findings.data && findings.data.length > 0 ? (
        <div className="space-y-2">
          {findings.data.map((f) => (
            <div key={f.id} className="rounded-xl border border-line/65 bg-raised/30 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={16} className="mt-0.5 text-critical" />
                  <div>
                    <p className="text-xs font-semibold text-ink">
                      {f.source_name} - {f.matched_field}
                    </p>
                    <p className="mt-1 text-[10px] text-faint">
                      {f.identity_name ?? "Unknown identity"} - leaked value: <code className="text-ink">{f.leaked_value_masked}</code>
                    </p>
                    <p className="mt-1 text-[10px] leading-4 text-faint">{f.remediation}</p>
                    <p className="mt-1 text-[9px] text-faint/70">First seen {new Date(f.first_seen).toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge tone={SEVERITY_TONE[f.severity] ?? "low"}>{f.severity}</Badge>
                  <Badge tone={f.status === "RESOLVED" ? "low" : "medium"}>{f.status}</Badge>
                  {f.status !== "RESOLVED" && (
                    <Button size="sm" variant="secondary" onClick={() => updateStatus.mutate({ id: f.id, status: "RESOLVED" })}>
                      Resolve
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={<Globe size={18} />} title="No leak findings" description="No exposures detected. Simulate a new leak to test." />
      )}
    </>
  );
}