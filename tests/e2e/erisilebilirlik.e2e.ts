// Erişilebilirlik smoke paketi (Faz 5 Ray D, 2026-07-17) — halka açık yüzeyler.
// ⚠️ Bu paket WCAG UYGUNLUK İDDİASI DEĞİLDİR ve iddiaya dönüştürülemez ([[public-claim-honesty]] +
// launch-gate 9): otomatik tarama + smoke, bilinen regresyonları yakalayan TABAN çizgisidir;
// uygunluk beyanı ancak bağımsız denetimle verilir (ayrı bütçe kararı).
//
// Kapsam: axe-core taraması (kritik/ciddi ihlal = test düşer; hafif ihlaller log'a yazılır) ·
// h1 tekilliği · klavye-yalnız erişim (/giris) · reduced-motion (hero pin kurulmaz, metin görünür) ·
// RTL (/ar: konteyner dir+lang + yatay taşma yok). Tamamı SALT-OKUR — giriş yok, dev DB kirlenmez
// ([[t10-test-infra-gotchas]] veri-kirliliği notu bu pakete uygulanmaz).
//
// Dil tuzağı (t10): vitrin dili client-side `air_lang` (varsayılan EN) → beklentiler EN;
// Arapça/TR doğrulaması SSR'lı locale rotaları (/ar, /tr) üzerinden yapılır.
import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

// Halka açık, auth'suz sayfalar (sentetik kontrol listesinin a11y-uygun alt kümesi;
// /tr /ar aynı bileşeni SSR'ladığından axe'te tekrar taranmaz — RTL testi ayrık).
const PUBLIC_PAGES = ["/", "/giris", "/kurumsal-giris", "/guven-ve-gizlilik", "/how-it-works", "/for-clinicians"];

// GSAP/hydration otursun diye kısa nefes — networkidle KULLANILMAZ (landing videoları
// preload=none + izleme istekleri networkidle'ı asılı bırakabilir).
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(900);
}

test.describe("axe taraması — kritik/ciddi ihlal yok", () => {
  for (const path of PUBLIC_PAGES) {
    test(`axe: ${path}`, async ({ page }) => {
      await page.goto(path);
      await settle(page);
      const results = await new AxeBuilder({ page }).analyze();

      // Hafif/orta ihlaller: düşürmez ama görünür olsun (manuel checklist beslemesi).
      const minor = results.violations.filter((v) => v.impact !== "critical" && v.impact !== "serious");
      if (minor.length) {
        console.log(`[axe:${path}] hafif/orta (${minor.length}):`, minor.map((v) => `${v.id}×${v.nodes.length}`).join(" · "));
      }

      const severe = results.violations
        .filter((v) => v.impact === "critical" || v.impact === "serious")
        .map((v) => `${v.id} (${v.impact}) ${v.nodes.length} düğüm — ör: ${v.nodes[0]?.target?.join(" ")}`);
      expect(severe, `${path} kritik/ciddi axe ihlalleri`).toEqual([]);
    });
  }
});

test.describe("başlık hiyerarşisi", () => {
  for (const path of PUBLIC_PAGES) {
    test(`tek h1: ${path}`, async ({ page }) => {
      await page.goto(path);
      await settle(page);
      // Ekran okuyucu için sayfanın tek ana başlığı olmalı (for-clinicians bulgusu bu testle kapandı).
      expect(await page.locator("h1").count(), `${path} h1 sayısı`).toBe(1);
    });
  }
});

test.describe("klavye-yalnız erişim", () => {
  test("/giris: e-posta girişine Tab ile ulaşılır ve Enter çalışır", async ({ page }) => {
    await page.goto("/giris");
    await settle(page);
    // Fare olmadan: Tab turuyla /giris/e-posta bağlantısını bul (15 durak yeter — kapı paneli kısa).
    let found = false;
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab");
      const href = await page.evaluate(() => (document.activeElement as HTMLAnchorElement | null)?.getAttribute?.("href"));
      if (href === "/giris/e-posta") { found = true; break; }
    }
    expect(found, "Tab turunda /giris/e-posta odaklanamadı").toBe(true);
    await page.keyboard.press("Enter");
    await page.waitForURL("**/giris/e-posta", { timeout: 10_000 });
  });

  test("/ (landing): Tab ilk duraklardan birinde gerçek bir bağlantıya ulaşır", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    let reached: string | null = null;
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Tab");
      reached = await page.evaluate(() => {
        const el = document.activeElement as HTMLAnchorElement | null;
        return el?.tagName === "A" ? el.getAttribute("href") : null;
      });
      if (reached) break;
    }
    expect(reached, "landing'de klavye hiçbir bağlantıya ulaşamadı").toBeTruthy();
  });
});

test.describe("reduced-motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("/ hero: pin kurulmaz, başlık beklemeden okunur", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    // Sözleşme (v6.14/v6.18): prefers-reduced-motion'da GSAP pin/scrub HİÇ kurulmaz,
    // metinler SSR'dan görünür (fail-open). Pin kurulsaydı .pin-spacer sarmalayıcısı olurdu.
    expect(await page.locator(".pin-spacer").count(), "reduced-motion'da pin-spacer bulundu").toBe(0);
    // Playwright toBeVisible opacity:0'ı görünür sayar → computed opacity açıkça ölçülür.
    const opacity = await page.locator("h1").evaluate((el) => Number(getComputedStyle(el).opacity));
    expect(opacity, "hero h1 reduced-motion'da görünür değil").toBeGreaterThan(0.9);
  });
});

test.describe("RTL — /ar", () => {
  test("konteyner dir=rtl + lang=ar taşır, yatay taşma yok", async ({ page }) => {
    await page.goto("/ar");
    await settle(page);
    // v5.9 sözleşmesi: dir/lang KÖKE değil KONTEYNERE ( [[nextfont-fallback-unicode-trap]] —
    // :lang(ar) font kapsamı + ekran okuyucu telaffuzu bu niteliklere bağlı).
    await expect(page.locator("[dir='rtl'][lang='ar']").first()).toBeAttached();
    await expect(page.locator("h1")).toContainText("رعاية");
    const overflow = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollW, `RTL yatay taşma: scrollWidth=${overflow.scrollW} clientWidth=${overflow.clientW}`)
      .toBeLessThanOrEqual(overflow.clientW + 1);
  });

  test("/tr konteyneri lang=tr taşır (locale SSR kontrolü)", async ({ page }) => {
    await page.goto("/tr");
    await settle(page);
    await expect(page.locator("[lang='tr'].aura-page").first()).toBeAttached();
    await expect(page.locator("h1")).toContainText("Bakım");
  });
});
