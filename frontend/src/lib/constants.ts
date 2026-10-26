import type { BehaviorFeatures, Role } from "../types/api";

export const STAFF_ROLES: Role[] = ["SECURITY_ADMIN", "SECURITY_ANALYST", "AUDITOR"];
export const WRITE_ROLES: Role[] = ["SECURITY_ADMIN", "SECURITY_ANALYST"];

export const RANGE_OPTIONS = [
  { value: 1, label: "1h" },
  { value: 6, label: "6h" },
  { value: 24, label: "24h" },
  { value: 72, label: "3d" },
  { value: 168, label: "7d" },
];

export const RISK_ORDER = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const DECISION_ORDER = ["ALLOW", "CHALLENGE", "RESTRICT", "DENY"] as const;
export const SEVERITY_ORDER = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const ROLE_OPTIONS: Role[] = [
  "SECURITY_ADMIN",
  "SECURITY_ANALYST",
  "EMPLOYEE",
  "AUDITOR",
];

export const DEVICE_STATE_OPTIONS = ["TRUSTED", "UNVERIFIED", "RESTRICTED", "REVOKED"] as const;
export const POLICY_DEVICE_STATES = ["TRUSTED", "UNVERIFIED", "RESTRICTED"] as const;

export const CHART_COLORS = {
  accent: "rgb(var(--accent))",
  accent2: "rgb(var(--accent-2))",
  low: "rgb(var(--low))",
  medium: "rgb(var(--medium))",
  high: "rgb(var(--high))",
  critical: "rgb(var(--critical))",
  line: "rgb(var(--line))",
  muted: "rgb(var(--muted))",
};

export const RISK_COLORS: Record<string, string> = {
  LOW: CHART_COLORS.low,
  MEDIUM: CHART_COLORS.medium,
  HIGH: CHART_COLORS.high,
  CRITICAL: CHART_COLORS.critical,
};

export const DECISION_COLORS: Record<string, string> = {
  ALLOW: CHART_COLORS.low,
  CHALLENGE: CHART_COLORS.medium,
  RESTRICT: CHART_COLORS.high,
  DENY: CHART_COLORS.critical,
};

export const NORMAL_FEATURES: BehaviorFeatures = {
  login_hour: 10,
  day_of_week: 2,
  failed_logins_15m: 0,
  requests_1h: 8,
  distinct_resources_1h: 2,
  sensitive_access_ratio: 0.2,
  new_device: false,
  geo_novelty: false,
  session_duration_min: 45,
  activity_deviation: 0.4,
};

export const ELEVATED_FEATURES: BehaviorFeatures = {
  login_hour: 2,
  day_of_week: 2,
  failed_logins_15m: 3,
  requests_1h: 24,
  distinct_resources_1h: 5,
  sensitive_access_ratio: 0.65,
  new_device: true,
  geo_novelty: true,
  session_duration_min: 120,
  activity_deviation: 1.6,
};

export const ANOMALOUS_FEATURES: BehaviorFeatures = {
  login_hour: 3,
  day_of_week: 6,
  failed_logins_15m: 18,
  requests_1h: 240,
  distinct_resources_1h: 18,
  sensitive_access_ratio: 1,
  new_device: true,
  geo_novelty: true,
  session_duration_min: 420,
  activity_deviation: 6.5,
};

export const FEATURE_PRESETS = [
  { id: "normal", label: "Normal baseline", features: NORMAL_FEATURES },
  { id: "elevated", label: "Elevated deviation", features: ELEVATED_FEATURES },
  { id: "anomalous", label: "Anomalous burst", features: ANOMALOUS_FEATURES },
];

export const REASON_EXPLANATIONS: Record<string, string> = {
  ALL_POLICIES_SATISFIED: "Every mandatory control passed and behavioral risk stayed below challenge thresholds.",
  RISK_POLICY_CHALLENGE:
    "Behavioral risk crossed the challenge threshold. A stronger authentication step is required.",
  RISK_POLICY_DENY: "Behavioral risk crossed the deny threshold for this resource.",
  ROLE_NOT_AUTHORIZED: "The identity's role is not allowed by the active resource policy.",
  ACCOUNT_DISABLED: "The identity is disabled. No policy can override this control.",
  DEVICE_NOT_TRUSTED: "The device state is not permitted by the active policy.",
  DEVICE_OWNERSHIP_MISMATCH: "The selected device belongs to another identity.",
  DEVICE_REVOKED: "The device has been revoked and cannot be used for access.",
  NO_ACTIVE_POLICY: "The resource has no active policy, so the secure default is deny.",
  SESSION_MAX_EXCEEDED: "The session is older than the maximum duration allowed by policy.",
  REPEATED_ANOMALIES:
    "Three or more high-risk behavioral events were detected within 30 minutes.",
  RESOURCE_INACTIVE: "The resource is inactive.",
  SESSION_INACTIVE: "The session is no longer active.",
  AUTHENTICATION_REQUIRED: "A valid authenticated session is required.",
  ACTION_NOT_AUTHORIZED: "The requested action is not permitted by the policy.",
};

export const EVENT_CATEGORIES = [
  "Authentication",
  "Access",
  "Behavior",
  "Device",
  "Incident",
  "Policy",
  "Session",
  "Model",
  "Audit",
  "Demo",
];
