import { useQuery } from "@tanstack/react-query";
import type { HealthStatus, SettingsInfo } from "../../types/api";
import { getDetailedHealth, getSettingsInfo } from "./api";

export const settingsKeys = {
  settings: ["settings"] as const,
  health: ["health-detailed"] as const,
};

export function useSettingsInfo(enabled = true) {
  return useQuery<SettingsInfo>({
    queryKey: settingsKeys.settings,
    queryFn: getSettingsInfo,
    enabled,
  });
}

export function useDetailedHealth(enabled = true) {
  return useQuery<HealthStatus>({
    queryKey: settingsKeys.health,
    queryFn: getDetailedHealth,
    enabled,
    refetchInterval: 30_000,
  });
}
