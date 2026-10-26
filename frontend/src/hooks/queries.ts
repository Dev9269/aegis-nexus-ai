import { keepPreviousData, useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { api } from "../services/api";
import type {
  AccessRequest,
  AuditEntry,
  DemoScenarioInfo,
  Device,
  FeatureMetadata,
  IdentityDetail,
  IdentitySummary,
  Incident,
  ListParams,
  ModelEvaluation,
  Overview,
  Page,
  ResourcePolicy,
  SecurityEvent,
  SettingsInfo,
} from "../types/api";

export const queryKeys = {
  me: ["me"] as const,
  overview: (range: number) => ["overview", range] as const,
  identities: (params: ListParams) => ["identities", params] as const,
  identity: (id: string) => ["identity", id] as const,
  devices: (params: ListParams) => ["devices", params] as const,
  access: (params: ListParams) => ["access", params] as const,
  accessDetail: (id: string) => ["access-detail", id] as const,
  incidents: (params: ListParams) => ["incidents", params] as const,
  incident: (id: string) => ["incident", id] as const,
  resources: (params: ListParams) => ["resources", params] as const,
  policyHistory: (id: string) => ["policy-history", id] as const,
  events: (params: ListParams) => ["events", params] as const,
  notifications: ["notifications"] as const,
  modelEvaluation: ["model-evaluation"] as const,
  modelFeatures: ["model-features"] as const,
  audit: (params: ListParams) => ["audit", params] as const,
  settings: ["settings"] as const,
  demoScenarios: ["demo-scenarios"] as const,
  health: ["health-detailed"] as const,
};

function withPlaceholder<T>(
  options: UseQueryOptions<T, Error, T, readonly unknown[]>,
): UseQueryOptions<T, Error, T, readonly unknown[]> {
  return {
    placeholderData: keepPreviousData,
    ...options,
  } as UseQueryOptions<T, Error, T, readonly unknown[]>;
}

export function useOverview(rangeHours: number) {
  return useQuery({
    queryKey: queryKeys.overview(rangeHours),
    queryFn: () => api.overview(rangeHours),
    refetchInterval: 30_000,
  });
}

export function useIdentities(params: ListParams, enabled = true) {
  return useQuery(
    withPlaceholder<Page<IdentitySummary>>({
      queryKey: queryKeys.identities(params),
      queryFn: () => api.identities(params),
      enabled,
    }),
  );
}

export function useIdentity(identityId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.identity(identityId ?? "none"),
    queryFn: () => api.identity(identityId as string),
    enabled: Boolean(identityId),
  });
}

export function useDevices(params: ListParams, enabled = true) {
  return useQuery(
    withPlaceholder<Page<Device>>({
      queryKey: queryKeys.devices(params),
      queryFn: () => api.devices(params),
      enabled,
    }),
  );
}

export function useAccessRequests(params: ListParams, enabled = true) {
  return useQuery(
    withPlaceholder<Page<AccessRequest>>({
      queryKey: queryKeys.access(params),
      queryFn: () => api.accessRequests(params),
      enabled,
    }),
  );
}

export function useAccessRequest(requestId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.accessDetail(requestId ?? "none"),
    queryFn: () => api.accessRequest(requestId as string),
    enabled: Boolean(requestId),
  });
}

export function useIncidents(params: ListParams, enabled = true) {
  return useQuery(
    withPlaceholder<Page<Incident>>({
      queryKey: queryKeys.incidents(params),
      queryFn: () => api.incidents(params),
      enabled,
      refetchInterval: 30_000,
    }),
  );
}

export function useIncident(incidentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.incident(incidentId ?? "none"),
    queryFn: () => api.incident(incidentId as string),
    enabled: Boolean(incidentId),
  });
}

export function useResources(params: ListParams = {}, enabled = true) {
  return useQuery({
    queryKey: queryKeys.resources(params),
    queryFn: () => api.resources(params),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function usePolicyHistory(resourceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.policyHistory(resourceId ?? "none"),
    queryFn: () => api.policyHistory(resourceId as string),
    enabled: Boolean(resourceId),
  });
}

export function useEvents(params: ListParams, enabled = true) {
  return useQuery(
    withPlaceholder<Page<SecurityEvent>>({
      queryKey: queryKeys.events(params),
      queryFn: () => api.events(params),
      enabled,
    }),
  );
}

export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: api.notifications,
    enabled,
    refetchInterval: 45_000,
  });
}

export function useModelEvaluation(enabled = true) {
  return useQuery<ModelEvaluation>({
    queryKey: queryKeys.modelEvaluation,
    queryFn: api.modelEvaluation,
    enabled,
  });
}

export function useModelFeatures(enabled = true) {
  return useQuery<FeatureMetadata[]>({
    queryKey: queryKeys.modelFeatures,
    queryFn: api.modelFeatures,
    enabled,
  });
}

export function useAuditEntries(params: ListParams, enabled = true) {
  return useQuery(
    withPlaceholder<Page<AuditEntry>>({
      queryKey: queryKeys.audit(params),
      queryFn: () => api.audit(params),
      enabled,
    }),
  );
}

export function useSettingsInfo(enabled = true) {
  return useQuery<SettingsInfo>({
    queryKey: queryKeys.settings,
    queryFn: api.settings,
    enabled,
  });
}

export function useDemoScenarios(enabled = true) {
  return useQuery<DemoScenarioInfo[]>({
    queryKey: queryKeys.demoScenarios,
    queryFn: api.demoScenarios,
    enabled,
  });
}

export function useDetailedHealth(enabled = true) {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: api.detailedHealth,
    enabled,
    refetchInterval: 30_000,
  });
}

export function useResourcesList(enabled = true) {
  return useResources({}, enabled);
}

export function useStaffCandidates(enabled = true) {
  return useIdentities({ page_size: 100, role: "SECURITY_ANALYST" }, enabled);
}

export function useAllIdentities(enabled = true) {
  return useIdentities({ page_size: 100 }, enabled);
}

export type { ResourcePolicy };
