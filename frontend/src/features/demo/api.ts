import { request } from "../../lib/http";
import type { DemoReset, DemoRun, DemoScenarioInfo, ScenarioId } from "../../types/api";

export function getDemoScenarios(): Promise<DemoScenarioInfo[]> {
  return request<DemoScenarioInfo[]>("/demo/scenarios");
}

export function runDemoScenario(scenario: ScenarioId): Promise<DemoRun> {
  return request<DemoRun>(`/demo/scenarios/${scenario}`, { method: "POST" });
}

export function runAllDemos(): Promise<DemoRun> {
  return request<DemoRun>("/demo/run", { method: "POST" });
}

export function resetDemo(): Promise<DemoReset> {
  return request<DemoReset>("/demo/reset", { method: "POST" });
}
