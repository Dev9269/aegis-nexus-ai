import { describe, expect, it } from "vitest";
import { navForPath, pageTitle, visibleNav } from "./navigation";

describe("role-aware navigation", () => {
  it("limits employees to personal posture and their own access history", () => {
    const items = visibleNav("EMPLOYEE").map((item) => item.to);
    expect(items).toEqual(["/me", "/access"]);
  });

  it("gives every staff role the operations surface", () => {
    for (const role of ["SECURITY_ADMIN", "SECURITY_ANALYST", "AUDITOR"] as const) {
      const items = visibleNav(role).map((item) => item.to);
      expect(items).toContain("/");
      expect(items).toContain("/identities");
      expect(items).toContain("/audit");
      expect(items).toContain("/settings");
      expect(items).toContain("/me");
    }
  });

  it("resolves nested paths and document titles", () => {
    expect(navForPath("/identities/abc", "SECURITY_ADMIN")?.to).toBe("/identities");
    expect(navForPath("/", "SECURITY_ADMIN")?.to).toBe("/");
    expect(navForPath("/identities/abc", "EMPLOYEE")).toBeUndefined();
    expect(pageTitle("/identities/abc")).toBe("Identity dossier");
    expect(pageTitle("/me")).toBe("My security");
    expect(pageTitle("/unknown")).toBe("AEGIS NEXUS");
  });
});
