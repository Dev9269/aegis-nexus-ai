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

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";
const WS_PATH = import.meta.env.VITE_WS_PATH ?? "/api/ws/events";

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

function readCookie(name: string): string | null {
  const prefix = `${encodeURIComponent(name)}=`;
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }
  return null;
}

export function buildQuery(params: Record<string, unknown> | undefined): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "" || value === "ALL") continue;
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, String(item));
    } else {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

async function parseError(response: Response): Promise<ApiError> {
  let code = `HTTP_${response.status}`;
  let message = response.statusText || "Request failed.";
  let details: unknown;
  try {
    const payload = (await response.json()) as {
      error?: { code?: string; message?: string; details?: unknown };
      detail?: string;
    };
    if (payload.error) {
      code = payload.error.code ?? code;
      message = payload.error.message ?? message;
      details = payload.error.details;
    } else if (payload.detail) {
      message = payload.detail;
    }
  } catch {
    // Non-JSON responses keep the HTTP status text.
  }
  return new ApiError(response.status, code, message, details);
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers = new Headers(options.headers);
  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrf = readCookie("aegis_csrf");
    if (csrf) headers.set("X-CSRF-Token", csrf);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      method,
      headers,
      body,
      credentials: "include",
    });
  } catch {
    throw new ApiError(
      0,
      "NETWORK_UNAVAILABLE",
      "Cannot reach the AEGIS API. Confirm the backend is running on port 8000.",
    );
  }

  if (!response.ok) {
    const error = await parseError(response);
    if (error.status === 401 && path !== "/auth/me" && path !== "/auth/login") {
      window.dispatchEvent(new Event("aegis:unauthorized"));
    }
    throw error;
  }

  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return (await response.text()) as T;
  }
  return (await response.json()) as T;
}

async function download(path: string, fallbackName: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { credentials: "include" });
  } catch {
    throw new ApiError(0, "NETWORK_UNAVAILABLE", "Cannot reach the AEGIS API.");
  }
  if (!response.ok) throw await parseError(response);
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const filename = match?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

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

export function websocketUrl(): string {
  if (WS_PATH.startsWith("ws://") || WS_PATH.startsWith("wss://")) return WS_PATH;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${WS_PATH}`;
}

export function messageFromError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}
