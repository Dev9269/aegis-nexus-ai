import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, buildQuery, request } from "./http";

afterEach(() => vi.unstubAllGlobals());

describe("http", () => {
  it("adds double-submit CSRF headers for unsafe methods", async () => {
    document.cookie = "aegis_csrf=csrf-test";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await request("/demo/run", { method: "POST" });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Headers).get("X-CSRF-Token")).toBe("csrf-test");
    expect(init.credentials).toBe("include");
  });

  it("preserves the error envelope contract", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: { code: "FORBIDDEN", message: "Denied." } }),
          { status: 403, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    await expect(request("/audit")).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
      message: "Denied.",
    });
  });
});

describe("buildQuery", () => {
  it("drops empty values and the ALL sentinel", () => {
    expect(
      buildQuery({
        q: "maya",
        status: "ALL",
        severity: "",
        page: 2,
        identity_id: undefined,
        empty: null,
      }),
    ).toBe("?q=maya&page=2");
  });

  it("repeats array parameters", () => {
    expect(buildQuery({ role: ["AUDITOR", "EMPLOYEE"] })).toBe("?role=AUDITOR&role=EMPLOYEE");
    expect(buildQuery(undefined)).toBe("");
  });
});

describe("request", () => {
  it("parses structured API errors and broadcasts unauthorized responses", async () => {
    const listener = vi.fn();
    window.addEventListener("aegis:unauthorized", listener);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: { code: "SESSION_EXPIRED", message: "Session expired." } }),
          { status: 401, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    await expect(request("/identities")).rejects.toMatchObject({
      status: 401,
      code: "SESSION_EXPIRED",
      message: "Session expired.",
    });
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener("aegis:unauthorized", listener);
  });

  it("does not broadcast unauthorized for the session probe", async () => {
    const listener = vi.fn();
    window.addEventListener("aegis:unauthorized", listener);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "Not authenticated" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await expect(request("/auth/me")).rejects.toBeInstanceOf(ApiError);
    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener("aegis:unauthorized", listener);
  });

  it("turns network failures into a helpful API error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(request("/health")).rejects.toMatchObject({
      status: 0,
      code: "NETWORK_UNAVAILABLE",
    });
  });
});
