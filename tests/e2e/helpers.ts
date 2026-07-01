// Playwright E2E ortak yardımcıları — demo hızlı-giriş + KVKK onam kapısı geçişi.
// Demo hesaplar dev branch'te seed'lidir (parola 1234). loginAs bir role girer, ilk-giriş onam'ını kabul eder.
import { Page, Browser, expect } from "@playwright/test";

export type DemoRole = "Hasta" | "Doktor" | "Koordinatör" | "Etik Kurul" | "Partner Doktor";

// Verilen sayfada demo rolüyle giriş yap (LoginForm hızlı-giriş butonu) + gerekirse onam'ı kabul et.
export async function loginAs(page: Page, role: DemoRole): Promise<void> {
  await page.goto("/giris");
  await page.getByRole("button", { name: role, exact: true }).click();
  // login → window.location.assign yönlendirmesi: giriş sayfasından ayrılmayı bekle.
  await page.waitForURL((url) => !url.pathname.startsWith("/giris"), { timeout: 15_000 });
  // İlk girişte KVKK onam kapısı araya girebilir → kabul et (bir kez alınır).
  if (page.url().includes("/onam")) {
    await page.getByRole("button", { name: /Onaylıyorum ve devam et/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/onam"), { timeout: 15_000 });
  }
}

// Çok-rollü akışlar için: role'e giriş yapılmış YENİ izole context+page döndür (çerezler karışmaz).
export async function contextAs(browser: Browser, role: DemoRole): Promise<Page> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await loginAs(page, role);
  return page;
}

// Küçük yardımcı: bir metnin sayfada GÖRÜNMEDİĞİNİ doğrula (de-id sızıntı kontrolü).
export async function expectNotVisible(page: Page, text: string): Promise<void> {
  await expect(page.getByText(text, { exact: false })).toHaveCount(0);
}
