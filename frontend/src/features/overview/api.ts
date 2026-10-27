import { buildQuery, request } from "../../lib/http";
import type { Overview } from "../../types/api";

export function getOverview(rangeHours: number): Promise<Overview> {
  return request<Overview>(`/overview${buildQuery({ range_hours: rangeHours })}`);
}
