import { useQuery } from "@tanstack/react-query";
import type { DemoScenarioInfo } from "../../types/api";
import { getDemoScenarios } from "./api";

export const demoKeys = {
  scenarios: ["demo-scenarios"] as const,
};

export function useDemoScenarios(enabled = true) {
  return useQuery<DemoScenarioInfo[]>({
    queryKey: demoKeys.scenarios,
    queryFn: getDemoScenarios,
    enabled,
  });
}
