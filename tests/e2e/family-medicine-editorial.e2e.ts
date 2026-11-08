import { test, expect, type BrowserContext } from "@playwright/test";

// UI contract tests only. Every editorial request is mocked; no evidence or approval is written.
test.use({ channel: process.env.E2E_BROWSER_CHANNEL as "chrome" | undefined });
let cookies: Parameters<BrowserContext["addCookies"]>[0] = [];
const endpoint = "**/api/admin/aile-hekimligi";
const emptyEvidence = { sources: [], sourceGap: "Madde incelemesi bekliyor.", nextReviewOn: null };
const item = { sourceChanged: false, sourceBlockers: [], sourceFingerprint: "fixture", workflowId: "driver", revision: 3, evidence: emptyEvidence, clinicalById: null, clinicalAt: null, legalById: null, legalAt: null, updatedAt: "2026-11-07T20:00:00Z", events: [] };
const queue = { items: [item], grants: { clinical: false, legal: false } };

test.beforeAll(async ({ request, baseURL }) => {
  if (!baseURL || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)) return;
  const response = await request.post("/api/auth/login", { data: { email: "admin@air.test", password: "1234" } });
  expect(response.ok(), "Use existing dev admin only; never create or elevate a user").toBeTruthy();
  cookies = (await request.storageState()).cookies;
});
test.beforeEach(async ({ page, baseURL }) => {
  test.skip(!baseURL || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname), "Local development only");
  await page.context().addCookies(cookies);
});

test("missing migration blocks mutations and does not claim saved approval", async ({ page }) => {
  let writes = 0;
  await page.route(endpoint, async route => {
    if (route.request().method() === "POST") writes++;
    await route.fulfill({ status: 503, json: { code: "SCHEMA_MISSING", error: "missing" } });
  });
  await page.goto("/admin/aile-hekimligi");
  await expect(page.locator("p[role=alert]")).toContainText("şeması henüz kurulmamış");
  await expect(page.getByRole("button", { name: "Kanıt taslağını kaydet", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Hekim incelemesini kaydet", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Hukuk incelemesini kaydet", exact: true })).toBeDisabled();
  expect(writes).toBe(0);
});

test("ADMIN without grants cannot review; source candidates stay read-only", async ({ page }) => {
  await page.route(endpoint, route => route.fulfill({ json: queue }));
  await page.goto("/admin/aile-hekimligi");
  await expect(page.getByText(/Sunucu revizyonu: 3/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Hekim incelemesini kaydet", exact: true })).toBeDisabled();
  await expect(page.getByRole("checkbox")).toBeDisabled();
  await page.getByText("Madde eşleştirme adayları · uzman incelemesi bekliyor", { exact: true }).click();
  await expect(page.getByText(/Adaylar otomatik kaydedilmez/)).toBeVisible();
  await expect(page.getByLabel("HTTPS kaynak adresi")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Kanıt taslağını kaydet", exact: true })).toBeDisabled();
});

test("409 preserves draft and requires refresh before retry", async ({ page }) => {
  let writes = 0;
  await page.route(endpoint, async route => {
    if (route.request().method() === "POST") {
      writes++;
      expect(route.request().postDataJSON()).toMatchObject({ action: "save", workflowId: "driver", expectedRevision: 3 });
      await route.fulfill({ status: 409, json: { error: "conflict" } });
    } else await route.fulfill({ json: queue });
  });
  await page.goto("/admin/aile-hekimligi");
  await page.getByLabel("Eksik kaynak / inceleme açıklaması").fill("Yerel taslak değişikliği");
  await page.getByRole("button", { name: "Kanıt taslağını kaydet", exact: true }).click();
  await expect(page.locator("p[role=alert]")).toContainText("başka bir işlemle değişti");
  await expect(page.getByLabel("Eksik kaynak / inceleme açıklaması")).toHaveValue("Yerel taslak değişikliği");
  await expect(page.getByRole("button", { name: "Kanıt taslağını kaydet", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Kaydedilmemiş değişiklikleri bırak", exact: true }).click();
  await page.getByRole("button", { name: "Sunucu kaydını yenile", exact: true }).click();
  await expect(page.getByLabel("Eksik kaynak / inceleme açıklaması")).toBeEnabled();
  expect(writes).toBe(1);
});

test("uncertain response never automatically retries a mutation", async ({ page }) => {
  let writes = 0;
  await page.route(endpoint, async route => {
    if (route.request().method() === "POST") { writes++; await route.abort("failed"); }
    else await route.fulfill({ json: queue });
  });
  await page.goto("/admin/aile-hekimligi");
  await page.getByLabel("Eksik kaynak / inceleme açıklaması").fill("İnceleme taslağı");
  await page.getByRole("button", { name: "Kanıt taslağını kaydet", exact: true }).click();
  await expect(page.locator("p[role=alert]")).toContainText("sonucu doğrulanamadı");
  await expect(page.getByRole("button", { name: "Kanıt taslağını kaydet", exact: true })).toBeDisabled();
  expect(writes).toBe(1);
});

test("changed catalog requires a new evidence revision even with reviewer grants", async ({ page }) => {
  await page.route(endpoint, route => route.fulfill({ json: { items: [{ ...item, catalogChanged: true }], grants: { clinical: true, legal: true } } }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/aile-hekimligi");
  await expect(page.locator("p[role=alert]")).toContainText("Katalog değişti");
  await expect(page.getByRole("checkbox")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Hekim incelemesini kaydet", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Kanıt taslağını kaydet", exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test("changed source invalidates historical reviews and blocks new approval", async ({ page }) => {
  await page.route(endpoint, route => route.fulfill({ json: {
    items: [{ ...item, sourceChanged: true, clinicalAt: "2026-11-07T20:00:00Z", clinicalById: "reviewer-fixture" }],
    grants: { clinical: true, legal: true },
  } }));
  await page.goto("/admin/aile-hekimligi");
  await expect(page.getByText(/Önceki onaylar yalnız tarihsel kayıttır/)).toBeVisible();
  await expect(page.getByText(/Geçerli değil; yeniden inceleme gerekli/)).toBeVisible();
  await expect(page.getByRole("checkbox")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Hukuk incelemesini kaydet", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Kanıt taslağını kaydet", exact: true })).toBeEnabled();
});
