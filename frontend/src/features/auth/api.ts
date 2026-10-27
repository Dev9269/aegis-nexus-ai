import { request } from "../../lib/http";
import type { Me } from "../../types/api";

export function getMe(): Promise<Me> {
  return request<Me>("/auth/me");
}

export function login(email: string, password: string): Promise<Me> {
  return request<Me>("/auth/login", { method: "POST", body: { email, password } });
}

export function logout(): Promise<{ status: string }> {
  return request<{ status: string }>("/auth/logout", { method: "POST" });
}
