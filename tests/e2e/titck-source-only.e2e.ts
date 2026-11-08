import "dotenv/config";
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

test.use({ channel: process.env.E2E_BROWSER_CHANNEL as "chrome" | undefined });

for (const viewport of [{ name: "desktop", width: 1280, height: 900 }, { name: "mobile", width: 390, height: 844 }]) {
  test.describe(`TİTCK source-only (${viewport.name})`, () => {
    test.use({ viewport });
    test("renders official metadata without AI guidance after reload and history navigation", async ({ page, baseURL }) => {
      test.skip(!baseURL || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname), "DEV only");
      const host = (value: string | undefined) => value ? new URL(value).hostname.replace("-pooler", "") : null;
      if (!host(process.env.DATABASE_URL) || !host(process.env.PROD_DATABASE_URL) || host(process.env.DATABASE_URL) === host(process.env.PROD_DATABASE_URL)) throw new Error("Distinct DEV required");
      const db = new PrismaClient();
      const row = await db.newsArticle.findFirst({ where: { source: "titck-recalls" }, select: { id: true, url: true } });
      await db.$disconnect();
      expect(row).toBeTruthy();
      expect((await page.request.post("/api/auth/login", { data: { email: "doktor@air.test", password: "1234" } })).ok()).toBeTruthy();
      await page.goto("/doktor/doctorium/aile-hekimligi");
      await expect(page.getByRole("heading", { name: "Kaynak güncelleme takibi" })).toBeVisible();
      await page.goto(`/doktor/doctorium/${row!.id}`);
      const note = page.getByText(/Bu kayıt TİTCK geri çekme\/blokaj/);
      await expect(note).toBeVisible();
      await expect(page.locator(`a[href="${row!.url}"]`).first()).toBeVisible();
      await page.reload();
      await expect(note).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
      await page.screenshot({ path: `test-results/titck-source-${viewport.name}.png`, fullPage: true });
      await page.goBack();
      await expect(page).toHaveURL(/\/aile-hekimligi$/);
      await page.goForward();
      await expect(note).toBeVisible();
    });
  });
}
