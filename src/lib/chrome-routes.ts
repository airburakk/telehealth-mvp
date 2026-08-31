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
  "/doctorium/giris",
  // Doctorium kayıt yüzeyleri (ayrışma Faz B, 2026-08-24): kendi koyu kabuğunu taşır
  // (DoctoriumSignupShell) — AURA Header/SiteFooter girmez. AURA'nın /kayit + /ogrenci'si
  // listede DEĞİL (onlar AURA kromuyla yaşamaya devam eder).
  "/doctorium/kayit",
  "/doctorium/ogrenci",
  "/giris",
  "/kurumsal-giris",
  // Parola kurtarma yüzeyleri (v6.194) — kapılarla aynı sınıf: kendi panelini taşıyan tam-ekran
  // kimlik yüzeyi. ⚠️ Krom GİZLENMESİ marka gereği de ZORUNLU: bu iki rota AURA_ONLY_PREFIXES'te
  // değil (kurtarma her iki markanın üyesine de lazım) → doctorium.tr'de de servis edilir ve
  // AURA Header/SiteFooter çizilseydi Doctorium yüzeyine AURA izi düşerdi.
  "/sifremi-unuttum",
  "/sifre-sifirla",
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
// /admin (2026-08-29, 2. tur): yönetim dizininin TAMAMI Doctorium kromundadır — panellerin
// çoğu zaten Doctorium işidir (kampanya · anket · etkinlik · ödüller · landing-analitik · üye
// analitiği) ve yönetici portaldan "Yönetim"e tıkladığında AURA'ya düşüyordu (kullanıcı bulgusu).
// Footer'ı app/admin/layout.tsx çizer → global AURA footer'ı burada susar.
const FOOTER_FREE_PREFIXES = ["/doktor/doctorium", "/admin"] as const;

export function hidesFooter(pathname: string): boolean {
  return (
    hidesGlobalChrome(pathname) ||
    FOOTER_FREE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  );
}

// Doctorium MARKASIYLA çizilen ama Doctorium ağacında OLMAYAN yüzeyler (2026-08-29).
//
// 🪤 Neden ayrı bir eksen gerekti: Header'ın marka bloğu iki şeye bakar — rota
// (/doktor/doctorium) ve hesap aşaması (stage1) — ve bu soruyu YALNIZ DOCTOR/COORDINATOR
// rolünde sorar. Yönetici yüzeyi her iki eksenin de dışında kaldığı için /admin altındaki
// Doctorium panelleri AURA logosuyla çiziliyordu. Bu liste rolden bağımsız olarak "bu rota
// Doctorium'a aittir" der.
//
// Kapsam (kullanıcı kararı 2026-08-29, 2. tur): /admin ağacının TAMAMI. İlk turda yalnız
// /admin/uyeler alınmıştı; yönetici portaldan "Yönetim"e tıklayınca AURA logosuna düşüyordu
// ("Management ve Operation'a tıkladığın anda Aura'ya dönüyor"). Yönetim dizini artık
// Doctorium'un yönetim yüzeyidir — AURA'ya özgü paneller oradan çıkarıldı.
const DOCTORIUM_BRAND_ROUTES = ["/admin"] as const;

export function usesDoctoriumBrand(pathname: string): boolean {
  return (DOCTORIUM_BRAND_ROUTES as readonly string[]).some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}
