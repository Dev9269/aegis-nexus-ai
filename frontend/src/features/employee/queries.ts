import { useQuery } from "@tanstack/react-query";
import type { IdentityDetail } from "../../types/api";
import { getEmployeeIdentity } from "./api";

export const employeeKeys = {
  identity: (identityId: string) => ["identity", identityId] as const,
};

export function useEmployeeIdentity(identityId: string | undefined) {
  return useQuery<IdentityDetail>({
    queryKey: employeeKeys.identity(identityId ?? "none"),
    queryFn: () => getEmployeeIdentity(identityId as string),
    enabled: Boolean(identityId),
  });
}
