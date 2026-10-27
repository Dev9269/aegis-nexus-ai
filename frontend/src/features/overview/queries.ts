import { useQuery } from "@tanstack/react-query";
import type { Overview } from "../../types/api";
import { getOverview } from "./api";

export const overviewKeys = {
  overview: (range: number) => ["overview", range] as const,
};

export function useOverview(rangeHours: number) {
  return useQuery<Overview>({
    queryKey: overviewKeys.overview(rangeHours),
    queryFn: () => getOverview(rangeHours),
    refetchInterval: 30_000,
  });
}
