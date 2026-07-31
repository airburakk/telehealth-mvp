// Playwright E2E ortak yardımcıları — demo hesapla giriş + KVKK onam kapısı geçişi.
// Demo hesaplar dev branch'te seed'lidir (parola 1234).
//
// ⚠️ 2026-07-31: loginAs eskiden giriş ekranındaki "hızlı demo girişi" BUTONUNA tıklıyordu. O blok
// v6.39'da halka açık ekranlardan gizlendi (yalnız yetkili e-posta yazılınca beliriyor) → helper
// kırıldı ve loginAs'e bağlı TÜM E2E akışları düştü. Artık giriş, UI kısayoluna değil giriş
// SÖZLEŞMESİNE (POST /api/auth/login) dayanır: demo butonları ileride tamamen kaldırılsa da
// (todo'daki üretim-öncesi temizlik) testler ayakta kalır.
import { Page, Browser, BrowserContext, expect } from "@playwright/test";

export type DemoRole = "Hasta" | "Doktor" | "Koordinatör" | "Etik Kurul" | "Partner Doktor";

// Rol → seed'li demo hesabı (prisma/seed.ts ile birebir).
const DEMO_EMAIL: Record<DemoRole, string> = {
  "Hasta": "hasta@air.test",
  "Doktor": "doktor@air.test",
  "Koordinatör": "koordinator@air.test",
  "Etik Kurul": "kurul@air.test",
  "Partner Doktor": "partner@air.test",
};

// Rol başına oturum çerezi önbelleği. ⚠️ ŞART: /api/auth/login'de brute-force freni var
// (10 istek / 5 dk / IP — api/auth/login/route.ts). Suite 20+ test × giriş yapınca limit aşılıp
// HTTP 429 ile testler düşüyordu. Rol başına BİR kez giriş yapıp çerezi yeniden kullanmak hem
// limiti aşmaz hem koşuyu hızlandırır (JWT 7 gün geçerli, suite süresince taze kalır).
type SessionCookies = Parameters<BrowserContext["addCookies"]>[0];
const sessionCookies = new Map<DemoRole, SessionCookies>();

// Demo rolüyle giriş yap + gerekirse ilk-giriş KVKK onamını kabul et.
export async function loginAs(page: Page, role: DemoRole): Promise<void> {
  const cached = sessionCookies.get(role);
  if (cached?.length) {
    await page.context().addCookies(cached);
  } else {
    const res = await page.request.post("/api/auth/login", {
      data: { email: DEMO_EMAIL[role], password: "1234" },
    });
    if (!res.ok()) throw new Error(`E2E giriş başarısız (${role} · ${DEMO_EMAIL[role]}): HTTP ${res.status()}`);
    sessionCookies.set(role, await page.context().cookies());
  }

  // Korumalı bir sayfaya giderek oturumu doğrula + onam kapısını tetikle.
  await page.goto("/vakalarim");
  if (page.url().includes("/onam")) {
    await page.getByRole("button", { name: /Onaylıyorum ve devam et/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/onam"), { timeout: 15_000 });
    sessionCookies.set(role, await page.context().cookies()); // onam sonrası tazelenen çerez (cv claim)
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
