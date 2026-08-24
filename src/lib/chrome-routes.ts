// Global krom (Header + SiteFooter) GİZLENEN rotalar — TEK KAYNAK.
//
// Neden ayrı modül (2026-08-17): bu liste Header.tsx ve SiteFooter.tsx içinde İKİ KOPYA
// halinde yaşıyordu ve sürüklendi — /doctorium landing'i Header'ın listesine eklenirken
// SiteFooter'ınkine eklenmemişti → landing kendi koyu footer'ını çizdi, ALTINA global AURA
// footer'ı bindi ("iki footer" bildirimi, kullanıcı 2026-08-17). Kopya liste = kaçınılmaz
// drift; artık iki bileşen de buradan okur.
//
// Kapsam gerekçesi:
//   • Landing rotaları (/, /v2, /how-it-works, /guven-ve-gizlilik, /for-clinicians, /doctorium)
//     kendi üst barını + footer'ını taşır (landing sözleşmesi).
//   • Giriş kapıları (/giris, /kurumsal-giris, /doctorium/giris) tam-ekran vitrin panelidir —
//     kendi logosu + "← ana sayfa" bağlantısıyla. ⚠️ exact match: /giris/e-posta gibi form
//     alt-rotalarında krom DURUR (bilinçli).
//   • Locale rotaları (/en /tr /bg … — v6.17) de landing'dir.
//   • Video görüşme rotaları IMMERSIVE tam-ekran (100dvh) → krom gizlenir.
//
// Yeni bir tam-ekran yüzey eklerken rotayı BURAYA yaz; Header/SiteFooter'a ayrıca dokunma.
import { isImmersiveCallPath } from "@/lib/immersive-routes";
import { LANG_CODES } from "@/lib/aura-landing/copy";

export const CHROME_FREE_ROUTES = [
  "/",
  "/v2",
  "/how-it-works",
  "/guven-ve-gizlilik",
  "/for-clinicians",
  "/doctorium",
  // v1 yedeği (2026-08-23): V2 landing'e geçişte eski landing'in noindex karşılaştırma kopyası —
  // aynı bileşen, aynı kendi-kromu sözleşmesi. V2 kesinleşince bu satır bileşenle birlikte kalkar.
  "/doctorium-v1",
  "/doctorium/giris",
  // Doctorium kayıt yüzeyleri (ayrışma Faz B, 2026-08-24): kendi koyu kabuğunu taşır
  // (DoctoriumSignupShell) — AURA Header/SiteFooter girmez. AURA'nın /kayit + /ogrenci'si
  // listede DEĞİL (onlar AURA kromuyla yaşamaya devam eder).
  "/doctorium/kayit",
  "/doctorium/ogrenci",
  "/giris",
  "/kurumsal-giris",
] as const;

// Header + footer BİRLİKTE gizlenir (yukarıdaki liste).
export function hidesGlobalChrome(pathname: string): boolean {
  return (
    (CHROME_FREE_ROUTES as readonly string[]).includes(pathname) ||
    (LANG_CODES as readonly string[]).includes(pathname.slice(1)) ||
    isImmersiveCallPath(pathname)
  );
}

// Yalnız FOOTER gizlenen ağaçlar — sayfa kendi alt bilgisini taşır ama global Header'a
// İHTİYACI VARDIR (2026-08-18).
//
// 🪤 Neden ayrı eksen: /doktor/doctorium/* iç portalı kendi DoctoriumFooter'ını segment
// layout'undan çiziyor, dolayısıyla AURA SiteFooter'ının susması gerekti. Ama bu rotayı
// CHROME_FREE_ROUTES'a yazmak Header'ı da düşürürdü ve v6.109 Üst Raf navigasyonu (portalın
// TEK gezinme omurgası) yok olurdu — doktor Doctorium'a girer, çıkamazdı. Krom artık iki
// eksende sorgulanıyor; "kendi footer'ı var ama nav'a muhtaç" yeni bir yüzey eklerken
// rotayı BURAYA yaz, CHROME_FREE_ROUTES'a değil.
const FOOTER_FREE_PREFIXES = ["/doktor/doctorium"] as const;

export function hidesFooter(pathname: string): boolean {
  return (
    hidesGlobalChrome(pathname) ||
    FOOTER_FREE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  );
}
