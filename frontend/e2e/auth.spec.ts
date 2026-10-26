import { expect, test } from "@playwright/test";

const password = process.env.AEGIS_DEMO_PASSWORD ?? "ChangeMe-Demo!2026";

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Work email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /Sign in securely/i }).click();
}

test("security admin lands on the live command center", async ({ page }) => {
  await login(page, "admin@aegisnexus.ai");

  await expect(page).toHaveURL("http://127.0.0.1:5173/");
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening), Avery/ })).toBeVisible();
  await expect(page.getByRole("navigation").getByRole("link", { name: "Access decisions" })).toBeVisible();
  await expect(page.getByText("API operational")).toBeVisible();
  await expect(page.getByText(/ML ranks anomalies; policy makes the decision/i)).toBeVisible();
});

test("employee is contained to the personal console", async ({ page }) => {
  await login(page, "maya.chen@aegisnexus.ai");

  await expect(page).toHaveURL("http://127.0.0.1:5173/me");
  await expect(page.getByRole("heading", { name: "Welcome, Maya" })).toBeVisible();
  await expect(page.getByRole("navigation").getByRole("link", { name: "Overview" })).toHaveCount(0);
  await expect(page.getByRole("navigation").getByRole("link", { name: "Audit ledger" })).toHaveCount(0);

  await page.goto("/audit");
  await expect(page.getByRole("heading", { name: "Access boundary enforced" })).toBeVisible();
  await expect(page).toHaveURL("http://127.0.0.1:5173/audit");
});
