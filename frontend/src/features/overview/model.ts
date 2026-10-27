import type { Overview } from "../../types/api";

export function greetingFor(name: string | undefined): string {
  const period = new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening";
  return `Good ${period}, ${name ?? "operator"}`;
}

export function overviewTotals(data: Overview) {
  return {
    riskTotal: data.risk_distribution.reduce((sum, item) => sum + item.value, 0),
    blocked: data.metrics.denied_requests + data.metrics.challenged_requests,
  };
}
