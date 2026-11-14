import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ClipboardCheck, Shield, XCircle } from "lucide-react";
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
    </>
  );
}
