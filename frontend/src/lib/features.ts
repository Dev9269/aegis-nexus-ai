import type { BehaviorFeatures, FeatureMetadata } from "../types/api";

export const FEATURE_FIELDS: Array<{
  key: keyof BehaviorFeatures;
  label: string;
  hint: string;
  min?: number;
  max?: number;
  step?: number;
  type: "number" | "boolean" | "ratio";
}> = [
  { key: "login_hour", label: "Login hour", hint: "UTC hour (0–23)", min: 0, max: 23, step: 1, type: "number" },
  { key: "day_of_week", label: "Day of week", hint: "0 = Monday, 6 = Sunday", min: 0, max: 6, step: 1, type: "number" },
  { key: "failed_logins_15m", label: "Failed logins / 15m", hint: "Trailing authentication failures", min: 0, max: 100, step: 1, type: "number" },
  { key: "requests_1h", label: "Requests / hour", hint: "Trailing access volume", min: 0, max: 1000, step: 1, type: "number" },
  { key: "distinct_resources_1h", label: "Distinct resources", hint: "Unique resources in one hour", min: 0, max: 100, step: 1, type: "number" },
  { key: "sensitive_access_ratio", label: "Sensitive ratio", hint: "0–1 share of sensitive requests", min: 0, max: 1, step: 0.05, type: "ratio" },
  { key: "new_device", label: "New device", hint: "First observed in seven days", type: "boolean" },
  { key: "geo_novelty", label: "Novel geography", hint: "Simulated location novelty", type: "boolean" },
  { key: "session_duration_min", label: "Session duration", hint: "Minutes since authentication", min: 0, max: 1440, step: 1, type: "number" },
  { key: "activity_deviation", label: "Activity deviation", hint: "0–10 robust activity deviation", min: 0, max: 10, step: 0.1, type: "number" },
];

export function featureMetadataByName(features: FeatureMetadata[] | undefined) {
  return new Map((features ?? []).map((feature) => [feature.name, feature]));
}
