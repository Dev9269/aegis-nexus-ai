import { expect, test } from "@playwright/test";

const password = process.env.AEGIS_DEMO_PASSWORD ?? "ChangeMe-Demo!2026";

const pages = [
  { path: "/", heading: /Good (morning|afternoon|evening), Avery/ },
  { path: "/me", heading: "Welcome, Avery" },
  { path: "/access", heading: "Access decisions" },
  { path: "/behavior", heading: "Behavioral risk" },
  { path: "/identities", heading: "Identities" },
  { path: "/incidents", heading: "Incidents" },
  { path: "/events", heading: "Event timeline" },
  { path: "/devices", heading: "Devices" },
  { path: "/policies", heading: "Resource policies" },
  { path: "/model", heading: "Model evaluation" },
  { path: "/audit", heading: "Audit ledger" },
  { path: "/demos", heading: "Demo lab" },
  { path: "/settings", heading: "Settings" },
];

test("every staff console surface renders against the live API", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/login");
  await page.getByLabel("Work email").fill("admin@aegisnexus.ai");
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /Sign in securely/i }).click();
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening), Avery/ })).toBeVisible();

  for (const surface of pages) {
    await page.goto(surface.path);
    await expect(page.getByRole("heading", { name: surface.heading }).first()).toBeVisible();
    await page.waitForTimeout(350);
    await expect(page.getByText("The interface hit an unexpected error")).toHaveCount(0);
    expect(pageErrors, `render errors on ${surface.path}`).toEqual([]);
  }
});
