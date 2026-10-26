import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Me } from "./types/api";

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const employee: Me = {
  id: "employee-1",
  display_name: "Maya Chen",
  email: "maya.chen@aegisnexus.ai",
  role: "EMPLOYEE",
  status: "ACTIVE",
  department: "Finance",
  title: "Financial Analyst",
  current_risk: 22,
  csrf_token: "test-csrf",
  session_expires_at: "2026-10-27T00:00:00Z",
  demo_mode: true,
};

async function renderAt(path: string) {
  vi.resetModules();
  const { default: App } = await import("./App");
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("application routing", () => {
  it("sends unauthenticated visitors to the secure sign-in screen", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ error: { code: "AUTHENTICATION_REQUIRED", message: "Sign in required." } }, 401),
      ),
    );

    await renderAt("/audit");

    expect(await screen.findByRole("heading", { name: "Enter the command center" })).toBeInTheDocument();
    expect(screen.queryByText("Audit ledger")).not.toBeInTheDocument();
  });

  it("blocks an employee from deep-linking into staff operations", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/auth/me")) return jsonResponse(employee);
        return jsonResponse({ error: { code: "FORBIDDEN", message: "Not allowed." } }, 403);
      }),
    );

    await renderAt("/identities");

    expect(await screen.findByRole("heading", { name: "Access boundary enforced" })).toBeInTheDocument();
    expect(screen.queryByText("People, sessions, and risk history")).not.toBeInTheDocument();
  });
});
