import { test, expect } from "@playwright/test";

test.use({ channel: process.env.E2E_BROWSER_CHANNEL as "chrome" | undefined });
// Local development only: never change preferences on a deployed account.
for (const viewport of [{ name: "desktop", width: 1280, height: 900 }, { name: "mobile", width: 390, height: 844 }]) {
  test.describe(`Family medicine preferences (${viewport.name})`, () => {
    test.use({ viewport, isMobile: viewport.name === "mobile", hasTouch: viewport.name === "mobile" });
    test("saves, reloads, navigates back/forward, and retains the last rapid choice", async ({ page, baseURL }) => {
      test.skip(!baseURL || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname), "Development database only");
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const login = await page.request.post("/api/auth/login", { data: { email: "doktor@air.test", password: "1234" } });
      expect(login.ok()).toBeTruthy();
      await page.goto("/doktor/doctorium/tercihler");
      const settings = page.locator("#calisma-alani");
      await expect(settings).toBeVisible();
      const initialLabel = await settings.locator('button[aria-pressed="true"]').innerText();
      const keys: Record<string, string | null> = { "Belirtmek istemiyorum": null, "ASM / birinci basamak": "asm", "Eğitim / araştırma": "egitim-arastirma", "Diğer": "diger" };
      const save = async (label: string) => {
        const response = page.waitForResponse((r) => r.url().endsWith("/api/doctor/view-filters") && r.request().method() === "POST" && r.request().postDataJSON()?.module === "practice");
        await settings.getByRole("button", { name: label, exact: true }).click();
        expect((await response).status()).toBe(200);
        await expect(settings.getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-pressed", "true");
      };
      try {
        await save("ASM / birinci basamak");
        await page.reload();
        await expect(settings.getByRole("button", { name: "ASM / birinci basamak", exact: true })).toHaveAttribute("aria-pressed", "true");
        await settings.getByRole("link", { name: /Aile Hekimliği çalışma alanına git/ }).click();
        await expect(page).toHaveURL(/\/aile-hekimligi$/);
        await expect(page.getByRole("heading", { name: "Aile Hekimliği çalışma alanı", exact: true })).toBeVisible();
        const sourceStatus = page.locator('section[aria-labelledby="family-source-watch"]');
        await expect(sourceStatus.getByRole("heading", { name: "Kaynak güncelleme takibi" })).toBeVisible();
        await sourceStatus.screenshot({ path: `test-results/family-source-${viewport.name}.png` });
        const workbench = page.locator('section[aria-labelledby="workflow-workbench"]');
        await expect(workbench.getByText("TASLAK · İNCELEME BEKLİYOR")).toBeVisible();
        await expect(workbench.locator('input[type="text"], input[type="file"], textarea')).toHaveCount(0);
        await workbench.getByRole("checkbox").first().check();
        await expect(workbench.getByRole("status")).toContainText("1/4");
        await workbench.getByRole("button", { name: "ASM kontrol hazırlığı", exact: true }).click();
        await expect(workbench.getByRole("status")).toContainText("0/4");
        await workbench.getByLabel("İncelenecek başlık").selectOption("maintenance");
        await expect(workbench.getByRole("heading", { name: "Cihaz bakım kayıtları", exact: true })).toBeVisible();
        await workbench.locator("summary").click();
        await expect(workbench.getByText("İçerik taslak durumunda; yayın onayı yok.", { exact: true })).toBeVisible();
        await workbench.getByRole("checkbox").first().check();
        await workbench.getByRole("button", { name: "İşaretleri temizle", exact: true }).click();
        await expect(workbench.getByRole("status")).toContainText("0/4");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
        await page.goBack();
        await expect(page).toHaveURL(/\/tercihler$/);
        await expect(settings.getByRole("button", { name: "ASM / birinci basamak", exact: true })).toHaveAttribute("aria-pressed", "true");
        await page.goForward();
        await expect(page).toHaveURL(/\/aile-hekimligi$/);
        await page.goBack();
        await expect(page).toHaveURL(/\/tercihler$/);
        await settings.getByRole("button", { name: "Eğitim / araştırma", exact: true }).click();
        await settings.getByRole("button", { name: "Diğer", exact: true }).click();
        await expect(settings.getByText("Kaydedildi", { exact: true })).toBeVisible();
        await page.reload();
        await expect(settings.getByRole("button", { name: "Diğer", exact: true })).toHaveAttribute("aria-pressed", "true");
        await save("Belirtmek istemiyorum");
        await page.reload();
        await expect(settings.getByRole("button", { name: "Belirtmek istemiyorum", exact: true })).toHaveAttribute("aria-pressed", "true");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
        expect(errors).toEqual([]);
      } finally {
        const restored = await page.request.post("/api/doctor/view-filters", { data: { module: "practice", setting: keys[initialLabel] } });
        expect(restored.ok()).toBeTruthy();
      }
    });
  });
}
