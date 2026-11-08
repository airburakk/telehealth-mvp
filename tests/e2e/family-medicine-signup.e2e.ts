import { test, expect } from "@playwright/test";
test.use({ channel: process.env.E2E_BROWSER_CHANNEL as "chrome" | undefined });
for (const mobile of [false, true]) {
  for (const classic of [false, true]) {
    test(`optional signup work setting: ${classic ? "classic" : "trial"}, ${mobile ? "mobile" : "desktop"}`, async ({ page, baseURL }) => {
      test.skip(!baseURL || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname), "Local only; intercepted signup");
      if (mobile) await page.setViewportSize({ width: 390, height: 844 });
      const bodies: Record<string, unknown>[] = [];
      let preferenceWrites = 0;
      await page.route("**/api/auth/signup*", async route => {
        bodies.push(route.request().postDataJSON());
        await route.fulfill({ status: 400, json: { error: "Test yanıtı: hesap oluşturulmadı." } });
      });
      await page.route("**/api/doctor/**", async route => {
        preferenceWrites++;
        await route.fulfill({ status: 400, json: {} });
      });
      await page.goto(`/doctorium/kayit${classic ? "?klasik=1" : ""}`);
      const setting = page.getByRole("combobox", { name: /Çalışma alan/ });
      await expect(setting).toBeVisible();
      await expect(setting).toHaveValue("");
      await expect(setting).not.toHaveAttribute("required");
      await page.getByLabel("Ad soyad", { exact: true }).fill("Test Hekim");
      await page.locator('input[type="email"]').fill("signup-ui@example.invalid");
      await page.locator('input[type="password"]').nth(0).fill("LocalOnly123!");
      await page.locator('input[type="password"]').nth(1).fill("LocalOnly123!");
      await page.getByRole("combobox", { name: "Branş", exact: true }).selectOption("Kardiyoloji");
      await page.getByRole("combobox", { name: "Şehir", exact: true }).selectOption("İstanbul");
      const submit = page.locator('button[type="submit"]');
      await expect(submit).toContainText(classic ? "Hesap oluştur" : "Hesabımı oluştur");
      await setting.selectOption("asm");
      expect(bodies).toHaveLength(0);
      await submit.click();
      await expect.poll(() => bodies.length).toBe(1);
      expect(bodies[0]).toMatchObject({ branch: "Kardiyoloji", practiceSetting: "asm" });
      expect(bodies[0]).not.toHaveProperty("newsBranches");
      await expect(setting).toHaveValue("asm");
      await expect(page.getByRole("combobox", { name: "Branş", exact: true })).toHaveValue("Kardiyoloji");
      await setting.selectOption("diger");
      await setting.selectOption("");
      await submit.click();
      await expect.poll(() => bodies.length).toBe(2);
      expect(["", null, undefined]).toContain(bodies[1].practiceSetting);
      expect(preferenceWrites).toBe(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
      await page.getByRole("link", { name: "Giriş yapın", exact: true }).click();
      await page.waitForURL("**/doctorium/giris");
      await page.goBack();
      await expect(setting).toBeVisible();
      await expect(setting).not.toHaveAttribute("required");
      await page.reload();
      await expect(setting).toHaveValue("");
      expect(bodies).toHaveLength(2);
      // API interception tests UI intent only; no account or email is created.
    });
  }
}
