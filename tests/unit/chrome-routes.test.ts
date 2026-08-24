// hidesGlobalChrome — global krom (Header + SiteFooter) gizleme sözleşmesi.
//
// NEDEN TEST (2026-08-17): bu liste Header.tsx ve SiteFooter.tsx içinde İKİ KOPYA halinde
// yaşıyordu ve sürüklendi — /doctorium landing'i yalnız Header'ın listesine eklenmişti, footer
// listesine değil → landing kendi footer'ını çizdi, ALTINA global AURA footer'ı bindi
// ("iki footer" bildirimi). Liste lib/chrome-routes.ts'te tek kaynağa alındı; bu test kaynağın
// tek kalmasını değil, DAVRANIŞIN doğruluğunu kilitler.
//
// ⚠️ Yeni tam-ekran yüzey eklerken buraya da bir satır ekle: kromun gizlendiğini iddia eden
// her rota burada kanıtlanır, "landing sözleşmesi" sözlü gelenek olarak kalmaz.
import { describe, it, expect } from "vitest";
import { hidesGlobalChrome, CHROME_FREE_ROUTES } from "@/lib/chrome-routes";

describe("hidesGlobalChrome", () => {
  it("landing rotalarında krom gizlenir — /doctorium DAHİL (çift footer regresyonu)", () => {
    // /doctorium-v1 (2026-08-23): V2 geçişinde eski landing'in noindex yedeği — aynı bileşen, aynı sözleşme.
    for (const p of ["/", "/v2", "/how-it-works", "/guven-ve-gizlilik", "/for-clinicians", "/doctorium", "/doctorium-v1"]) {
      expect(hidesGlobalChrome(p), p).toBe(true);
    }
  });

  it("giriş kapıları tam-ekran vitrin panelidir → krom gizlenir", () => {
    for (const p of ["/giris", "/kurumsal-giris", "/doctorium/giris"]) {
      expect(hidesGlobalChrome(p), p).toBe(true);
    }
  });

  it("EXACT match: kapı alt-rotalarında krom DURUR (bilinçli)", () => {
    // /giris/e-posta gibi form alt-rotaları uygulama kabuğunda yaşar.
    expect(hidesGlobalChrome("/giris/e-posta")).toBe(false);
    expect(hidesGlobalChrome("/kayit")).toBe(false);
    expect(hidesGlobalChrome("/ogrenci")).toBe(false);
  });

  it("locale landing rotaları (v6.17) krom taşımaz", () => {
    expect(hidesGlobalChrome("/en")).toBe(true);
    expect(hidesGlobalChrome("/bg")).toBe(true);
    expect(hidesGlobalChrome("/enn")).toBe(false); // gerçek olmayan kod eşleşmez
  });

  it("immersive görüşme rotaları (100dvh) krom gizler", () => {
    expect(hidesGlobalChrome("/gorusme/abc123")).toBe(true);
    expect(hidesGlobalChrome("/second-opinion/gorusme/x")).toBe(true);
    expect(hidesGlobalChrome("/konsultasyon/gorusme/x")).toBe(true);
  });

  it("uygulama içi rotalarda krom DURUR", () => {
    for (const p of ["/doktor", "/doktor/doctorium", "/doktorlar", "/doktorlar/abc", "/vakalarim", "/admin"]) {
      expect(hidesGlobalChrome(p), p).toBe(false);
    }
  });

  it("liste tek kaynaktır — /doctorium listede kayıtlı", () => {
    expect(CHROME_FREE_ROUTES).toContain("/doctorium");
  });
});
