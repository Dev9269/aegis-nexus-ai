import { request } from "../../lib/http";
import type { IdentityDetail } from "../../types/api";

export function getEmployeeIdentity(identityId: string): Promise<IdentityDetail> {
  return request<IdentityDetail>(`/identities/${identityId}`);
}
