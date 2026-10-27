import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("env", () => {
  it("keeps demo disabled in production unless explicitly enabled", async () => {
    vi.stubEnv("PROD", true);
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_DEMO_MODE", "");
    const { env } = await import("./env");
    expect(env.demoEnabled).toBe(false);
    expect(env.demoPassword).toBe("");
  });

  it("uses a configured API base without exposing secrets", async () => {
    vi.stubEnv("VITE_API_BASE", "/secure-api");
    const { env } = await import("./env");
    expect(env.apiBase).toBe("/secure-api");
  });
});
