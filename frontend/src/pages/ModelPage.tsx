import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Database,
  FlaskConical,
  GitBranch,
  RefreshCw,
  Scale,
  Sparkles,
  Target,
} from "lucide-react";
import { api, messageFromError } from "../services/api";
import { useModelEvaluation, useModelFeatures } from "../hooks/queries";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import {
  Badge,
  Button,
  Callout,
  ErrorState,
  Field,
  LoadingPanel,
  Modal,
  PageHeader,
  Panel,
  SectionHeading,
  SelectInput,
  StatCard,
} from "../components/ui";
import type { ModelEvaluation } from "../types/api";
import { formatDateTime, formatNumber, formatPercent, titleCase } from "../lib/utils";

export default function ModelPage() {
  const { me } = useAuth();
  const evaluation = useModelEvaluation();
  const features = useModelFeatures();
  const isAdmin = me?.role === "SECURITY_ADMIN";

  if (evaluation.isError) {
    return (
      <>
        <PageHeader eyebrow="Explainable anomaly detection" title="Model evaluation" />
        <ErrorState message={evaluation.error.message} onRetry={() => void evaluation.refetch()} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Explainable anomaly detection"
        title="Model evaluation"
        description="Isolation Forest behavioral anomaly detection with deterministic synthetic data, a disjoint held-out split, and transparent limitations."
        meta={
          <>
            <Badge tone="accent">Unsupervised scoring</Badge>
            <Badge tone="violet">Synthetic benchmark</Badge>
            <span className="text-[10px] text-faint">Policy, not the model, authorizes access</span>
          </>
        }
        actions={
          evaluation.data ? (
            <div className="rounded-lg border border-line/60 bg-raised/50 px-3 py-1.5 text-right">
              <p className="text-[8px] uppercase tracking-wider text-faint">Production model</p>
              <p className="font-mono text-[10px] text-ink">{evaluation.data.model_version}</p>
            </div>
          ) : undefined
        }
      />

      {evaluation.isLoading || !evaluation.data ? (
        <LoadingPanel rows={8} label="Loading model evaluation" />
      ) : (
        <ModelContent evaluation={evaluation.data} isAdmin={isAdmin} />
      )}

      <Panel className="mt-4 overflow-hidden">
        <div className="border-b border-line/60 p-4 sm:p-5">
          <SectionHeading
            eyebrow="Feature dictionary"
            title="Behavioral signal inputs"
            description="Ten normalized features form the model vector. Values outside population baselines contribute to the anomaly score."
          />
        </div>
        {features.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="skeleton h-10" />
            ))}
          </div>
        ) : features.isError ? (
          <ErrorState message={features.error.message} onRetry={() => void features.refetch()} />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Key</th>
                  <th>Type</th>
                  <th>Range</th>
                  <th className="hidden md:table-cell">Description</th>
                </tr>
              </thead>
              <tbody>
                {features.data?.map((feature) => (
                  <tr key={feature.name}>
                    <td className="text-xs font-medium text-ink">{feature.label}</td>
                    <td className="font-mono text-[10px] text-accent">{feature.name}</td>
                    <td><Badge>{titleCase(feature.type)}</Badge></td>
                    <td className="font-mono text-[10px] text-muted">
                      {formatNumber(feature.min, 0)} – {formatNumber(feature.max, 0)}
                      {feature.unit ? ` ${feature.unit}` : ""}
                    </td>
                    <td className="hidden max-w-[420px] text-[11px] leading-5 text-muted md:table-cell">
                      {feature.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

function ModelContent({ evaluation, isAdmin }: { evaluation: ModelEvaluation; isAdmin: boolean }) {
  const metrics = evaluation.metrics;
  const matrix = evaluation.confusion_matrix;
  const total = matrix.true_negative + matrix.false_positive + matrix.false_negative + matrix.true_positive;
  const positive = matrix.true_positive + matrix.false_negative;
  const negative = matrix.true_negative + matrix.false_positive;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Precision" value={`${(metrics.precision * 100).toFixed(1)}%`} detail="Of flagged anomalies" tone="accent" />
        <StatCard label="Recall" value={`${(metrics.recall * 100).toFixed(1)}%`} detail="Of injected anomalies" tone="low" />
        <StatCard label="F1 score" value={metrics.f1.toFixed(4)} detail="Harmonic balance" tone="violet" />
        <StatCard
          label="False positive rate"
          value={`${(metrics.false_positive_rate * 100).toFixed(1)}%`}
          detail="Normal traffic flagged"
          tone={metrics.false_positive_rate > 0.1 ? "high" : "low"}
        />
        <StatCard
          label="ROC AUC"
          value={metrics.roc_auc !== null ? metrics.roc_auc.toFixed(4) : "N/A"}
          detail="Ranking quality"
          tone="accent"
        />
        <StatCard label="Threshold" value={metrics.threshold.toFixed(4)} detail="Score boundary" tone="neutral" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Panel className="p-4 sm:p-5">
          <SectionHeading eyebrow="Model card" title={evaluation.model_type} description="Deterministic training and evaluation metadata." />
          <div className="mt-4 grid grid-cols-2 gap-4 text-[11px]">
            <Meta label="Model version" value={evaluation.model_version} mono />
            <Meta label="Artifact available" value={evaluation.artifact_available ? "Yes" : "No"} />
            <Meta label="Seed" value={String(evaluation.seed)} mono />
            <Meta label="Features" value={`${evaluation.feature_names.length} inputs`} />
            <Meta label="Train rows" value={formatNumber(evaluation.train_rows, 0)} />
            <Meta label="Holdout rows" value={formatNumber(evaluation.test_rows, 0)} />
            <Meta label="Trained" value={formatDateTime(evaluation.trained_at)} />
            <Meta label="Evaluated" value={formatDateTime(evaluation.evaluated_at)} />
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {evaluation.feature_names.map((name) => (
              <span key={name} className="rounded border border-line/70 bg-raised/50 px-1.5 py-0.5 font-mono text-[9px] text-muted">
                {name}
              </span>
            ))}
          </div>
        </Panel>

        <Panel className="p-4 sm:p-5">
          <SectionHeading eyebrow="Held-out performance" title="Confusion matrix" description={`${formatNumber(total, 0)} disjoint test observations.`} />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <MatrixCell label="True negative" value={matrix.true_negative} tone="low" hint={`${((matrix.true_negative / Math.max(1, negative)) * 100).toFixed(1)}% of normals`} />
            <MatrixCell label="False positive" value={matrix.false_positive} tone="high" hint={`${((matrix.false_positive / Math.max(1, negative)) * 100).toFixed(1)}% of normals`} />
            <MatrixCell label="False negative" value={matrix.false_negative} tone="medium" hint={`${((matrix.false_negative / Math.max(1, positive)) * 100).toFixed(1)}% of anomalies`} />
            <MatrixCell label="True positive" value={matrix.true_positive} tone="accent" hint={`${((matrix.true_positive / Math.max(1, positive)) * 100).toFixed(1)}% of anomalies`} />
          </div>
          <div className="mt-4 rounded-lg border border-line/60 bg-raised/30 p-3">
            <p className="text-[9px] uppercase tracking-wider text-faint">Label distribution</p>
            <div className="mt-1.5 flex flex-wrap gap-3">
              {Object.entries(evaluation.label_distribution).map(([label, count]) => (
                <span key={label} className="text-[10px] text-muted">
                  {titleCase(label)}: <span className="font-mono text-ink">{formatNumber(count, 0)}</span>
                </span>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      <Panel className="p-4 sm:p-5">
        <SectionHeading eyebrow="Scientific hygiene" title="Dataset and interpretation" description="What the benchmark measures, and what it does not." />
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="rounded-lg border border-line/60 bg-raised/30 p-3">
              <div className="flex items-center gap-2">
                <Database size={14} className="text-accent" />
                <p className="text-[11px] font-semibold text-ink">Dataset</p>
              </div>
              <p className="mt-1.5 text-[11px] leading-5 text-muted">{evaluation.dataset_description}</p>
            </div>
            <div className="rounded-lg border border-accent/25 bg-accent/[0.05] p-3">
              <div className="flex items-center gap-2">
                <BrainCircuit size={14} className="text-accent" />
                <p className="text-[11px] font-semibold text-accent">Score interpretation</p>
              </div>
              <p className="mt-1.5 text-[11px] leading-5 text-muted">{evaluation.score_interpretation}</p>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-medium" />
              <p className="text-[11px] font-semibold text-ink">Known limitations</p>
            </div>
            <ul className="mt-2 space-y-2">
              {evaluation.limitations.map((limitation) => (
                <li key={limitation} className="flex items-start gap-2 text-[11px] leading-5 text-muted">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-medium" />
                  {limitation}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <Callout tone="warning" title="Anomaly ranking, not attack probability">
          The risk index orders unusual behavior for human review. It is not a calibrated probability of compromise,
          and it can never grant access or override mandatory policy denials.
        </Callout>
        <RetrainPanel evaluation={evaluation} isAdmin={isAdmin} />
      </div>
    </div>
  );
}

function RetrainPanel({ evaluation, isAdmin }: { evaluation: ModelEvaluation; isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [seed, setSeed] = useState(evaluation.seed);
  const [rows, setRows] = useState(evaluation.train_rows);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    setSeed(evaluation.seed);
    setRows(evaluation.train_rows);
  }, [evaluation.seed, evaluation.train_rows]);

  const retrain = useMutation({
    mutationFn: () => api.retrainModel(seed, rows),
    onSuccess: (data) => {
      setConfirmOpen(false);
      queryClient.setQueryData(["model-evaluation"], data);
      void queryClient.invalidateQueries({ queryKey: ["model-evaluation"] });
      void queryClient.invalidateQueries({ queryKey: ["health-detailed"] });
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Model retrained", `${data.model_version} is now the production artifact.`);
    },
    onError: (error) => toast.error("Retrain failed", messageFromError(error)),
  });

  return (
    <Panel className="p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <RefreshCw size={15} className="text-accent" />
        <p className="text-xs font-semibold text-ink">Retrain deterministic model</p>
        <Badge tone={isAdmin ? "accent" : "neutral"}>{isAdmin ? "Admin" : "Read-only"}</Badge>
      </div>
      <p className="mt-1 text-[11px] leading-5 text-muted">
        Rebuilds the synthetic dataset, retrains Isolation Forest, evaluates on a fresh disjoint split, and activates
        the new artifact. The operation is audited.
      </p>
      {isAdmin ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Random seed" hint="1 – 100,000">
              <input
                type="number"
                className="input"
                min={1}
                max={100000}
                value={seed}
                onChange={(event) => setSeed(Number(event.target.value))}
              />
            </Field>
            <Field label="Training rows" hint="1,000 – 50,000">
              <SelectInput
                value={rows}
                onChange={(event) => setRows(Number(event.target.value))}
              >
                {[1000, 2500, 5000, 10000, 25000, 50000].map((value) => (
                  <option key={value} value={value}>{value.toLocaleString()}</option>
                ))}
              </SelectInput>
            </Field>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[10px] text-faint">
              <GitBranch size={11} /> Current code {evaluation.model_version}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={seed < 1 || seed > 100000 || rows < 1000 || rows > 50000}
              onClick={() => setConfirmOpen(true)}
            >
              <FlaskConical size={12} /> Retrain
            </Button>
          </div>
        </>
      ) : (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-line/60 bg-raised/30 p-3 text-[11px] text-muted">
          <Scale size={14} className="text-faint" />
          Only security admins can retrain the production model.
        </div>
      )}

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Retrain production model?"
        description="This replaces the active artifact used for future access evaluations."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="solid" loading={retrain.isPending} onClick={() => retrain.mutate()}>
              Retrain and activate
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Callout tone="warning" title="Model replacement">
            The new model will be evaluated on a fresh holdout split. Existing decisions and evidence remain unchanged.
          </Callout>
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-line/65 bg-raised/30 p-3 text-[11px]">
            <div>
              <p className="text-[9px] uppercase tracking-wider text-faint">Seed</p>
              <p className="font-mono text-ink">{seed}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider text-faint">Rows</p>
              <p className="font-mono text-ink">{rows.toLocaleString()}</p>
            </div>
          </div>
          <p className="flex items-center gap-1.5 text-[10px] text-faint">
            <Target size={11} /> Training uses synthetic behavioral data only.
          </p>
        </div>
      </Modal>
    </Panel>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-faint">{label}</p>
      <p className={`mt-1 break-words text-ink ${mono ? "font-mono text-[10px]" : "text-[11px]"}`}>{value}</p>
    </div>
  );
}

function MatrixCell({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone: "low" | "high" | "medium" | "accent";
  hint: string;
}) {
  const styles = {
    low: "border-low/30 bg-low/[0.07] text-low",
    high: "border-high/30 bg-high/[0.07] text-high",
    medium: "border-medium/30 bg-medium/[0.07] text-medium",
    accent: "border-accent/30 bg-accent/[0.07] text-accent",
  };
  return (
    <div className={`rounded-lg border p-3 ${styles[tone]}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[9px] font-semibold uppercase tracking-wider">{label}</p>
        {tone === "accent" && <CheckCircle2 size={12} />}
      </div>
      <p className="mt-1 font-display text-xl font-semibold">{formatNumber(value, 0)}</p>
      <p className="mt-0.5 text-[9px] opacity-80">{hint}</p>
    </div>
  );
}
