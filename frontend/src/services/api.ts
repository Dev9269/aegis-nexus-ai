import type {
  AccessRequest,
  AccessRequestDetail,
  AuditEntry,
  AuditVerify,
  DecisionResult,
  DemoReset,
  DemoRun,
  DemoScenarioInfo,
  Device,
  DeviceEnrollPayload,
  EvaluateAccessPayload,
  FeatureMetadata,
  HealthStatus,
  IdentityDetail,
  IdentitySummary,
  Incident,
  IncidentDetail,
  IncidentNote,
  IncidentUpdate,
  ListParams,
  Me,
  ModelEvaluation,
  Notification,
  Overview,
  Page,
  Policy,
  PolicyDraft,
  PolicyPreview,
  PolicyPreviewCase,
  ResourcePolicy,
  SecurityEvent,
  SettingsInfo,
  ScenarioId,
  DeviceState,
} from "../types/api";

import { buildQuery, download, request } from "../lib/http";

export {
  ApiError,
  buildQuery,
  download,
  messageFromError,
  request,
  type RequestOptions,
} from "../lib/http";
export { websocketUrl } from "../config/env";

export const api = {
  me: () => request<Me>("/auth/me"),
  login: (email: string, password: string) =>
    request<Me>("/auth/login", { method: "POST", body: { email, password } }),
  logout: () => request<{ status: string }>("/auth/logout", { method: "POST" }),
  detailedHealth: () => request<HealthStatus>("/health/detailed"),

  overview: (rangeHours: number) =>
    request<Overview>(`/overview${buildQuery({ range_hours: rangeHours })}`),

  identities: (params: ListParams) =>
    request<Page<IdentitySummary>>(`/identities${buildQuery(params)}`),
  identity: (identityId: string) => request<IdentityDetail>(`/identities/${identityId}`),

  devices: (params: ListParams) => request<Page<Device>>(`/devices${buildQuery(params)}`),
  enrollDevice: (payload: DeviceEnrollPayload) =>
    request<Device>("/devices", { method: "POST", body: payload }),
  updateDeviceState: (deviceId: string, state: DeviceState, reason: string) =>
    request<Device>(`/devices/${deviceId}/state`, {
      method: "PATCH",
      body: { state, reason },
    }),

  accessRequests: (params: ListParams) =>
    request<Page<AccessRequest>>(`/access-requests${buildQuery(params)}`),
  accessRequest: (requestId: string) =>
    request<AccessRequestDetail>(`/access-requests/${requestId}`),
  evaluateAccess: (payload: EvaluateAccessPayload) =>
    request<DecisionResult>("/access-requests/evaluate", {
      method: "POST",
      body: payload,
    }),
  exportAccessRequests: (params: ListParams) =>
    download(`/access-requests/export.csv${buildQuery(params)}`, "aegis-access-requests.csv"),

  incidents: (params: ListParams) =>
    request<Page<Incident>>(`/incidents${buildQuery(params)}`),
  incident: (incidentId: string) => request<IncidentDetail>(`/incidents/${incidentId}`),
  updateIncident: (incidentId: string, payload: IncidentUpdate) =>
    request<IncidentDetail>(`/incidents/${incidentId}`, {
      method: "PATCH",
      body: payload,
    }),
  addIncidentNote: (incidentId: string, note: string) =>
    request<IncidentNote>(`/incidents/${incidentId}/notes`, {
      method: "POST",
      body: { note },
    }),

  resources: (params?: ListParams) =>
    request<ResourcePolicy[]>(`/resources${buildQuery(params)}`),
  policyHistory: (resourceId: string) =>
    request<Policy[]>(`/resources/${resourceId}/policies`),
  updatePolicy: (resourceId: string, draft: PolicyDraft) =>
    request<Policy>(`/resources/${resourceId}/policy`, {
      method: "PUT",
      body: draft,
    }),
  previewPolicy: (draft: PolicyDraft, cases: PolicyPreviewCase[]) =>
    request<PolicyPreview>("/policies/preview", {
      method: "POST",
      body: { draft, cases },
    }),

  events: (params: ListParams) =>
    request<Page<SecurityEvent>>(`/events${buildQuery(params)}`),
  event: (eventId: string) => request<SecurityEvent>(`/events/${eventId}`),
  notifications: () => request<Notification[]>("/notifications"),

  modelEvaluation: () => request<ModelEvaluation>("/model/evaluation"),
  modelFeatures: () => request<FeatureMetadata[]>("/model/features"),
  retrainModel: (seed: number, rows: number) =>
    request<ModelEvaluation>(`/model/retrain${buildQuery({ seed, rows })}`, {
      method: "POST",
    }),

  audit: (params: ListParams) => request<Page<AuditEntry>>(`/audit${buildQuery(params)}`),
  verifyAudit: () => request<AuditVerify>("/audit/verify"),
  exportAudit: (params: ListParams) =>
    download(`/audit/export.csv${buildQuery(params)}`, "aegis-audit-log.csv"),

  settings: () => request<SettingsInfo>("/settings/info"),

  demoScenarios: () => request<DemoScenarioInfo[]>("/demo/scenarios"),
  runDemoScenario: (scenario: ScenarioId) =>
    request<DemoRun>(`/demo/scenarios/${scenario}`, { method: "POST" }),
  runAllDemos: () => request<DemoRun>("/demo/run", { method: "POST" }),
  resetDemo: () => request<DemoReset>("/demo/reset", { method: "POST" }),
};
