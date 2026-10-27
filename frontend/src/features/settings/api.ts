import { request } from "../../lib/http";
import type { HealthStatus, SettingsInfo } from "../../types/api";

export function getSettingsInfo(): Promise<SettingsInfo> {
  return request<SettingsInfo>("/settings/info");
}

export function getDetailedHealth(): Promise<HealthStatus> {
  return request<HealthStatus>("/health/detailed");
}
