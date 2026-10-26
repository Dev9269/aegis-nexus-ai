# ML Methodology

## Purpose

The behavioral model ranks how unusual an access request looks relative to an established baseline. It is one signal inside a zero-trust policy engine. It does not decide whether a user is malicious, does not authenticate anyone, and cannot grant access.

**Critical interpretation:** the 0–100 risk index is a rescaled anomaly ranking, not a calibrated probability that an attack occurred. The final `ALLOW` / `CHALLENGE` / `RESTRICT` / `DENY` decision comes from deterministic policy logic.

## Features

The model uses 10 numeric features:

| Feature | Meaning | Range |
| --- | --- | --- |
| `login_hour` | Authentication hour, UTC | 0–23 |
| `day_of_week` | Day of week, UTC, Monday=0 | 0–6 |
| `failed_logins_15m` | Failed authentications in trailing 15 minutes | 0–100 |
| `requests_1h` | Access requests in trailing 60 minutes | 0–1000 |
| `distinct_resources_1h` | Unique resources requested in trailing 60 minutes | 0–100 |
| `sensitive_access_ratio` | Share of recent requests to high/critical resources | 0–1 |
| `new_device` | Device first observed for this identity in 7 days | boolean |
| `geo_novelty` | Source location is novel in simulated context | boolean |
| `session_duration_min` | Minutes since session authentication | 0–1440 |
| `activity_deviation` | Declared deviation from the identity baseline | 0–10 |

Inputs are validated by Pydantic and by runtime feature validation. Invalid or missing features fail closed with a validation error rather than being silently imputed.

## Training data

`ml/training/generate_data.py` generates deterministic synthetic behavior from a seed:

- 88% normal activity;
- 12% injected anomaly families: credential attack, lateral movement, impossible travel/device context, off-hours access, exfiltration-style behavior;
- labels exist **only** for evaluation and are never passed to `IsolationForest.fit`.

With the default `rows=5000`, `seed=42`:

- 4,400 normal rows;
- 600 injected anomaly rows;
- 75% training / 25% test split, stratified by label;
- 3,750 train rows and 1,250 disjoint test rows.

The split uses `train_test_split(..., stratify=labels, random_state=seed)`. Test rows are not used for fitting or for threshold calibration.

## Model

```text
IsolationForest(
  n_estimators=250,
  max_samples=min(256, n_train),
  contamination=0.08,
  random_state=seed,
  n_jobs=-1
)
```

Isolation Forest is unsupervised. `contamination` is an initialization assumption, not a claim about the real world. Evaluation uses a fixed threshold of `55` on the risk index.

## Risk mapping

The model's `decision_function` score is converted to a robust z-score against training-score center and spread, then mapped through a logistic curve:

```text
robust_z = (score_center - raw_score) / score_spread
risk = 100 / (1 + exp(-2.2 * (robust_z - 2.2)))
risk = clip(risk, 0, 100)
```

The score spread uses the training score IQR divided by 1.349, with a standard-deviation and epsilon fallback. This produces a stable monotonic 0–100 ranking.

Risk categories in the UI: `LOW <30`, `MEDIUM 30–54.99`, `HIGH 55–79.99`, `CRITICAL >=80`.

Policy thresholds are separate from these labels. A `HIGH` score is not automatically denied; the active resource policy decides whether it triggers `CHALLENGE` or `DENY`.

## Current evaluation

Default artifacts: `iforest-seed42-20261026T175112Z`.

| Metric | Value |
| --- | --- |
| Precision | 1.000 |
| Recall | 0.900 |
| F1 | 0.947 |
| False-positive rate | 0.000 |
| ROC-AUC | 0.99988 |
| Evaluation threshold | 55 |
| True positives | 135 |
| False positives | 0 |
| True negatives | 1,100 |
| False negatives | 15 |

These numbers describe a synthetic held-out split. They say nothing about production accuracy, and the perfect precision/FPR should be read as a property of easy synthetic separation, not as evidence of real-world perfection.

## Explainability

The model exposes up to four feature deviations. For numeric features:

```text
deviation = abs(value - training_median) / robust_scale
```

Only deviations `>= 0.75` are shown. Boolean features use training prevalence, with rare presence or very common absence treated as notable.

This is a **descriptive heuristic**, not SHAP, causal attribution, or proof that a feature caused the score. The UI labels it accordingly. Reasons from the policy engine are separate and deterministic.

## Artifacts

Written atomically to `AEGIS_MODEL_ARTIFACT_DIR` (default `backend/ml/artifacts/`):

| File | Contents |
| --- | --- |
| `model.joblib` | Fitted model, metadata, evaluation, baselines |
| `metadata.json` | Version, hyperparameters, feature metadata, medians/scales/prevalences |
| `evaluation.json` | Metrics, confusion matrix, split sizes, limitations |

Artifacts are gitignored. The runtime caches by artifact modification time. In development, a missing artifact triggers deterministic bootstrap training (`seed=42`, `rows=4000`). In non-development environments it raises an error instead. Container startup does not train a model; run the CLI or admin retrain path explicitly and persist artifacts on the mounted volume.

## Training and retraining

CLI:

```powershell
cd backend
.\.venv\Scripts\python.exe -m scripts.train_model --rows 5000 --seed 42
.\.venv\Scripts\python.exe -m scripts.evaluate_model
```

API:

```http
POST /api/model/retrain?seed=42&rows=5000
```

Retraining is `SECURITY_ADMIN` only, bounded by query validation, audited as `MODEL_RETRAINED`, and clears the runtime cache. Retraining is synchronous in the prototype; production should use a governed job queue and artifact signing.

## Monitoring and governance needs

- Compare live feature distributions to training baselines for drift.
- Track decision outcomes, challenge completion, false-positive reports, and incident confirmation.
- Version datasets and artifacts; require review before activation.
- Calibrate thresholds against real labeled investigations, not synthetic injections.
- Monitor per-identity and per-role fairness/error rates.
- Provide rollback to a prior signed artifact.

## Limitations

- Synthetic data and simulated device/location context.
- No real attack labels, user feedback loop, or production calibration.
- Anomaly ranking is not intent, compromise, or probability.
- Feature summaries are descriptive, not causal.
- No drift detection, artifact signing, or automated rollback.
- Isolation Forest assumes informative historical baselines; cold-start identities are especially weak.
- The prototype is a baseline for demonstration, not a production detection system.
