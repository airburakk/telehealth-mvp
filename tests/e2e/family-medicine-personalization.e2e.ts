import { test, expect } from "@playwright/test";
test.use({ channel: process.env.E2E_BROWSER_CHANNEL as "chrome" | undefined });
test("family medicine personalization requires a separate explicit action", async ({ page, baseURL }) => {
  test.skip(!baseURL || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname), "Local demo only");
  expect((await page.request.post("/api/auth/login", { data: { email: "doktor@air.test", password: "1234" } })).ok()).toBeTruthy();
  const branchWrites: string[][] = []; let subscriptionWrites = 0;
  await page.route("**/api/doctor/news-branches", async route => {
    branchWrites.push(route.request().postDataJSON().branches);
    await route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/doctor/view-filters", route => route.fulfill({ json: { ok: true } }));
  await page.route("**/api/doctor/digest", async route => { subscriptionWrites++; await route.fulfill({ json: { ok: true } }); });
  await page.goto("/doktor/doctorium/tercihler");
  const setting = page.locator("#calisma-alani");
  await setting.getByRole("button", { name: "ASM / birinci basamak", exact: true }).click();
  await expect(setting.getByRole("button", { name: "ASM / birinci basamak", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(branchWrites).toHaveLength(0);
  const add = page.getByRole("button", { name: "Aile Hekimliğini akış tercihlerime ekle", exact: true });
  await expect(add).toBeVisible();
  await add.click();
  await expect.poll(() => branchWrites.length).toBe(1);
  expect(branchWrites[0]).toContain("aile-hekimligi");
  expect(subscriptionWrites).toBe(0);
  await expect(add).toHaveCount(0);
  // API is mocked: this test proves explicit intent and routing, not database persistence.
});
