export type Role = "SECURITY_ADMIN" | "SECURITY_ANALYST" | "EMPLOYEE" | "AUDITOR";
export type Decision = "ALLOW" | "CHALLENGE" | "RESTRICT" | "DENY";
export type RiskCategory = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type DeviceState = "TRUSTED" | "UNVERIFIED" | "RESTRICTED" | "REVOKED";
export type IncidentStatus = "OPEN" | "INVESTIGATING" | "CONTAINED" | "RESOLVED" | "FALSE_POSITIVE";
export type Action = "READ" | "WRITE" | "DELETE" | "ADMIN";
export type ScenarioId = "A" | "B" | "C" | "D" | "E" | "F";

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface Me {
  id: string;
  display_name: string;
  email: string;
  role: Role;
  status: string;
  department: string;
  title: string;
  current_risk: number;
  csrf_token: string;
  session_expires_at: string;
  demo_mode: boolean;
}

export interface IdentitySummary {
  id: string;
  display_name: string;
  email: string;
  role: Role;
  status: "ACTIVE" | "DISABLED";
  department: string;
  title: string;
  current_risk: number;
  last_activity_at: string | null;
  is_simulated: boolean;
}

export interface SessionInfo {
  id: string;
  created_at: string;
  expires_at: string;
  ip_address: string | null;
  user_agent: string | null;
  is_simulated: boolean;
}

export interface Device {
  id: string;
  identity_id: string;
  identity_name: string | null;
  name: string;
  device_type: string;
  operating_system: string;
  state: DeviceState;
  enrollment_status: string;
  last_observed_at: string | null;
  enrolled_at: string;
  revoked_at: string | null;
  signals: Record<string, unknown>;
  is_simulated: boolean;
}

export interface RiskPoint {
  timestamp: string;
  risk_score: number;
  risk_category: RiskCategory;
  source: string;
}

export interface FeatureFactor {
  feature: string;
  label: string;
  value: number;
  baseline: number;
  deviation: number;
  direction: "high" | "low";
  message: string;
}

export interface BehavioralSignal {
  id: string;
  detected_at: string;
  risk_score: number;
  risk_category: RiskCategory;
  model_version: string;
  top_factors: FeatureFactor[];
  is_simulated: boolean;
}

export interface AccessRequest {
  id: string;
  identity_id: string;
  identity_name: string;
  identity_email: string;
  resource_id: string;
  resource_name: string;
  resource_key: string;
  device_id: string | null;
  device_name: string | null;
  requested_action: Action;
  decision: Decision;
  risk_score: number;
  risk_category: RiskCategory;
  anomaly_score: number;
  policy_version: string;
  recommended_action: string;
  created_at: string;
  is_simulated: boolean;
}

export interface Reason {
  code: string;
  message: string;
  severity?: Severity | "INFO";
}

export interface AccessRequestDetail extends AccessRequest {
  reasons: Reason[];
  correlation_id: string;
  model_version: string | null;
  feature_summary: FeatureFactor[];
  features: Record<string, number | boolean>;
}

export interface IdentityDetail extends IdentitySummary {
  created_at: string;
  active_sessions: number;
  sessions: SessionInfo[];
  devices: Device[];
  recent_access: AccessRequest[];
  behavioral_signals: BehavioralSignal[];
  risk_history: RiskPoint[];
  alerts: SecurityEvent[];
  audit_events: AuditEntry[];
}

export interface AuditEntry {
  id: string;
  sequence: number;
  timestamp: string;
  actor_id: string | null;
  actor_label: string;
  action: string;
  target_type: string;
  target_id: string | null;
  result: string;
  policy_version: string | null;
  correlation_id: string;
  metadata_json: Record<string, unknown>;
  prev_hash: string;
  record_hash: string;
}

export interface AuditVerify {
  valid: boolean;
  checked_records: number;
  first_invalid_id: string | null;
  message: string;
}

export interface Policy {
  id: string;
  resource_id: string;
  version: number;
  allowed_roles: Role[];
  allowed_device_states: DeviceState[];
  challenge_threshold: number;
  deny_threshold: number;
  require_additional_verification: boolean;
  session_max_minutes: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  change_reason: string;
  is_simulated: boolean;
}

export interface ResourcePolicy {
  id: string;
  key: string;
  name: string;
  description: string;
  sensitivity: RiskCategory;
  owner_department: string;
  is_active: boolean;
  is_simulated: boolean;
  policy: Policy | null;
  version_count: number;
}

export interface PolicyDraft {
  allowed_roles: Role[];
  allowed_device_states: DeviceState[];
  challenge_threshold: number;
  deny_threshold: number;
  require_additional_verification: boolean;
  session_max_minutes: number;
  reason: string;
  is_active: boolean;
}

export interface PolicyPreviewCase {
  role: Role;
  device_state: DeviceState;
  risk_score: number;
  account_active?: boolean;
  identity_authorized?: boolean;
  session_active?: boolean;
  repeated_anomalies?: number;
}

export interface PolicyPreviewResult {
  case_index: number;
  decision: Decision;
  reasons: Reason[];
}

export interface PolicyPreview {
  policy_version_preview: string;
  results: PolicyPreviewResult[];
  persisted: false;
}

export interface SecurityEvent {
  id: string;
  event_type: string;
  category: string;
  severity: Severity;
  summary: string;
  identity_id: string | null;
  device_id: string | null;
  access_request_id: string | null;
  incident_id: string | null;
  actor_id: string | null;
  policy_version: string | null;
  correlation_id: string;
  details: Record<string, unknown>;
  timestamp: string;
  is_simulated: boolean;
}

export interface Notification {
  id: string;
  title: string;
  severity: Severity;
  timestamp: string;
  event_type: string;
  link: string;
}

export interface Incident {
  id: string;
  title: string;
  classification: string;
  severity: Severity;
  status: IncidentStatus;
  identity_id: string | null;
  identity_name: string | null;
  summary: string;
  assigned_to: string | null;
  related_access_request_ids: string[];
  related_device_ids: string[];
  resolution: string | null;
  created_at: string;
  updated_at: string;
  is_simulated: boolean;
}

export interface IncidentNote {
  id: string;
  author_label: string;
  note: string;
  created_at: string;
}

export interface IncidentDetail extends Incident {
  notes: IncidentNote[];
  timeline: SecurityEvent[];
  access_requests: AccessRequest[];
}

export interface IncidentUpdate {
  status?: IncidentStatus;
  severity?: Severity;
  assigned_to?: string | null;
  resolution?: string;
  note?: string;
}

export interface OverviewMetrics {
  total_identities: number;
  active_sessions: number;
  access_requests: number;
  suspicious_events: number;
  high_risk_requests: number;
  denied_requests: number;
  challenged_requests: number;
  model_analyzed_events: number;
  model_anomaly_rate: number;
  model_version: string;
  demo_events: number;
  real_events: number;
}

export interface TimelinePoint {
  bucket: string;
  access_requests: number;
  security_events: number;
  high_risk: number;
}

export interface NamedCount {
  name: string;
  value: number;
}

export interface RiskLeader {
  identity_id: string;
  identity_name: string;
  role: Role;
  risk_score: number;
  anomaly_count: number;
}

export interface HealthStatus {
  api: string;
  database: string;
  model: string;
  event_stream: string;
  model_version: string | null;
  stream_clients: number;
  checked_at: string;
}

export interface Overview {
  range_hours: number;
  range_label: string;
  generated_at: string;
  metrics: OverviewMetrics;
  timeline: TimelinePoint[];
  risk_distribution: NamedCount[];
  decision_breakdown: NamedCount[];
  identity_leaderboard: RiskLeader[];
  recent_events: SecurityEvent[];
  health: HealthStatus;
}

export interface ModelMetrics {
  precision: number;
  recall: number;
  f1: number;
  false_positive_rate: number;
  roc_auc: number | null;
  threshold: number;
}

export interface ConfusionMatrix {
  true_negative: number;
  false_positive: number;
  false_negative: number;
  true_positive: number;
}

export interface ModelEvaluation {
  model_version: string;
  model_type: string;
  trained_at: string;
  evaluated_at: string;
  seed: number;
  feature_names: string[];
  train_rows: number;
  test_rows: number;
  label_distribution: Record<string, number>;
  metrics: ModelMetrics;
  confusion_matrix: ConfusionMatrix;
  dataset_description: string;
  score_interpretation: string;
  limitations: string[];
  artifact_available: boolean;
}

export interface FeatureMetadata {
  name: string;
  label: string;
  unit: string;
  type: "integer" | "number" | "boolean";
  min: number;
  max: number;
  description: string;
}

export interface SettingsInfo {
  environment: string;
  demo_mode: boolean;
  session_ttl_minutes: number;
  login_rate_limit: number;
  login_rate_window_seconds: number;
  allowed_origins: string[];
  model_artifact_available: boolean;
  model_version: string | null;
  limitations: string[];
}

export interface DemoScenarioInfo {
  scenario: ScenarioId;
  title: string;
  description: string;
  expected_outcome: string;
  subject: string;
  resource: string;
  device: string | null;
}

export interface DemoScenarioResult {
  scenario: ScenarioId;
  title: string;
  description: string;
  expected_outcome: string;
  actual_outcome: string;
  passed: boolean;
  request_id: string | null;
  incident_id: string | null;
  decision: Decision | null;
  risk_score: number | null;
  details: Record<string, unknown>;
}

export interface DemoRun {
  scenario: ScenarioId | null;
  results: DemoScenarioResult[];
  executed_at: string;
  demo_mode: boolean;
  is_simulated: true;
}

export interface DemoReset {
  reset: boolean;
  identities: number;
  devices: number;
  access_requests: number;
  incidents: number;
  message: string;
}

export interface BehaviorFeatures {
  login_hour: number;
  day_of_week: number;
  failed_logins_15m: number;
  requests_1h: number;
  distinct_resources_1h: number;
  sensitive_access_ratio: number;
  new_device: boolean;
  geo_novelty: boolean;
  session_duration_min: number;
  activity_deviation: number;
}

export interface EvaluateAccessPayload {
  identity_id: string;
  resource_id: string;
  device_id?: string | null;
  requested_action: Action;
  features: BehaviorFeatures;
  simulate?: boolean;
}

export interface DecisionResult {
  request_id: string;
  identity_id: string;
  resource_id: string;
  requested_action: Action;
  decision: Decision;
  risk_category: RiskCategory;
  risk_score: number;
  anomaly_score: number;
  policy_version: string;
  reasons: Reason[];
  recommended_next_step: string;
  timestamp: string;
  correlation_id: string;
  is_simulated: boolean;
}

export interface DeviceEnrollPayload {
  identity_id: string;
  name: string;
  device_type: "Laptop" | "Desktop" | "Mobile" | "Tablet" | "Virtual Machine";
  operating_system: string;
  initial_state: "TRUSTED" | "UNVERIFIED";
}

export interface ListParams {
  q?: string;
  page?: number;
  page_size?: number;
  [key: string]: string | number | boolean | undefined;
}
