// Mobil smoke paketi (2026-08-24) — Doctorium Landing V2 pre-freeze QA'sının otomasyonu.
// Kökeni: 2026-08-23/24 mobil QA turunda "@360 + @390 yatay taşma 0" canlı prod DOM'unda ELLE
// doğrulanmıştı; bu paket o kontrolü regresyon testine çevirir (bkz. vault Devam Noktası v6.149).
// Yalnız `mobil` projesinde koşar (playwright.config.ts — Pixel 7 tanımı, isMobile+touch).
//
// Kapsam — tamamı SALT-OKUR (giriş yok, veri yazmaz):
//   1. Yatay taşma @360/@390: tüm halka açık sayfalar + /ar (RTL + dar ekran = klasik taşma
//      kaynağı; [[css-grid-min-content-tasma]] sınıfı hatalar tam bu testte yakalanır).
//   2. /doctorium mobil header sözleşmesi (pre-freeze patch 2026-08-23, LandingHeader.tsx):
//      statik (sticky DEĞİL) 56px bar · barda `Doctorium | Oluştur | ☰` · "Giriş yap" barda
//      GİZLİ, hamburger panelinde · Escape paneli kapatır.
import { test, expect, type Page } from "@playwright/test";
import { PUBLIC_PAGES } from "./helpers";

// GSAP/hydration otursun diye kısa nefes — networkidle KULLANILMAZ (erisilebilirlik.e2e.ts ile
// aynı gerekçe: preload=none videolar + izleme istekleri networkidle'ı asılı bırakabilir).
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(900);
}

// Elle yapılan QA'nın ölçtüğü iki genişlik: 360 (yaygın en dar Android) + 390 (iPhone 12-15).
const WIDTHS = [360, 390] as const;

// /ar: RTL yüzeyi masaüstünde erisilebilirlik.e2e.ts kontrol eder; dar ekran RTL taşması ayrı
// hata sınıfı olduğundan mobilde de taranır.
const OVERFLOW_PAGES = [...PUBLIC_PAGES, "/ar"];

test.describe("yatay taşma yok @360/@390", () => {
  for (const path of OVERFLOW_PAGES) {
    test(`taşma: ${path}`, async ({ page }) => {
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(path);
        await settle(page);
        // Sayfa sonuna in: tembel monte olan alt bölümler layout'a girsin (elle QA da tam
        // sayfa kaydırarak bakmıştı), sonra belge genişliği ölçülür.
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await page.waitForTimeout(400);
        const m = await page.evaluate(() => ({
          scrollW: document.documentElement.scrollWidth,
          clientW: document.documentElement.clientWidth,
        }));
        expect(m.scrollW, `${path} @${width}px yatay taşma: scrollWidth=${m.scrollW} clientWidth=${m.clientW}`)
          .toBeLessThanOrEqual(m.clientW + 1);
      }
    });
  }
});

test.describe("/doctorium mobil header sözleşmesi", () => {
  test("statik 56px bar: Oluştur barda, Giriş yap menüde, Escape kapatır", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/doctorium");
    await settle(page);

    // Bar STATİK ve 56px (h-14): sticky bar mobilde ürün kartlarının üstüne biniyordu —
    // pre-freeze kararı "mobilde yapışmamak". md:sticky yalnız 768+ içindir.
    const header = page.locator("header").first();
    expect(await header.evaluate((el) => getComputedStyle(el).position), "mobil header sticky olmamalı").toBe("static");
    // boundingBox border-box döndürür: h-14 (56px) + border-b 1px = 57. Masaüstü 72+1=73'ten
    // yine net ayrışır — amaç piksel saymak değil, 56'lık mobil barın 72'ye REGRESE olmaması.
    const box = await header.boundingBox();
    const h = Math.round(box?.height ?? 0);
    expect(h, `mobil header ~56px olmalı (ölçülen ${h})`).toBeGreaterThanOrEqual(56);
    expect(h, `mobil header ~56px olmalı (ölçülen ${h})`).toBeLessThanOrEqual(58);

    // Barda "Oluştur" (kısa CTA) görünür; "Giriş yap" barda GİZLİ (dört öğe 360'ta yarışıyordu).
    await expect(header.getByRole("link", { name: "Oluştur" })).toBeVisible();
    await expect(header.getByRole("link", { name: "Giriş yap" })).toBeHidden();

    // Hamburger: aria sözleşmesi (expanded/controls) + panel içinde "Giriş yap" bağlantısı.
    const burger = header.locator('button[aria-controls="doctorium-nav-menu"]');
    await expect(burger).toBeVisible();
    await expect(burger).toHaveAttribute("aria-expanded", "false");
    await burger.click();
    await expect(burger).toHaveAttribute("aria-expanded", "true");
    const panel = page.locator("#doctorium-nav-menu");
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("link", { name: "Giriş yap" })).toBeVisible();

    // Escape paneli kapatır (klavye kullanıcısı panele hapsolmaz — DoctoriumMobileMenu deseni).
    await page.keyboard.press("Escape");
    await expect(burger).toHaveAttribute("aria-expanded", "false");
    await expect(panel).toBeHidden();
  });
});
