// Doctorium DENEME ÜYELİĞİ bayrağı — env'i okuyan TEK yer (sunucu modülü; client bundle'a girmez).
//
// 🔴 İKİ Vercel projesine (telehealth-mvp + doctorium) AYRI girilir — devralma YOK (EDEVLET_VERIFY_ENABLED
// dersi, 2026-09-02). Yalnız ÜÇ yerde okunur: hesap oluşturmada deneme damgası (lib/doctor-signup) ·
// /doctorium/kayit form seçimi · POST /api/auth/signup-trial (kapalıysa 404). Katman çözücüsü, portal
// kapısı, Header rozeti ve trial-sweep cron'u DAMGA-güdümlüdür — bayrak sonradan kapansa bile başlamış
// denemeler biter ve imha edilir; yalnız YENİ deneme girişi kapanır.
//
// ⚖️ AÇMA ŞARTI (plan §5): 02 Üyelik Sözleşmesi madde 3.2 ("doğrulama tamamlanmadan içerik erişimi
// açılmaz") deneme maddesini almadan bayrak "1" yapılmaz — aksi hâlde üye, metnin tanımlamadığı bir
// erişim rejimine sokulur. Metinler kesinleşince DOCTORIUM_CONSENT_VERSION de artar.
export function isTrialEnabled(): boolean {
  return process.env.DOCTORIUM_TRIAL_ENABLED === "1";
}
