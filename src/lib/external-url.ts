// Harici bağlantı doğrulaması (2026-08-03 denetimi) — hasta/personel tarafından girilen belge
// bağlantıları için tek kaynak.
//
// Bu uygulamada harici belge bağlantısı meşru bir ihtiyaçtır (hasta, hastanesinin portalındaki
// raporu ekler) → host allowlist'i pratik değil. Bu yüzden kapı ŞEMA düzeyindedir: yalnız http(s),
// kimlik gömülü olmayan, ayrıştırılabilir URL'ler geçer.
//
// ⚠️ NEDEN YAZIM ANINDAKİ REGEX YETMEZ: satır başka bir yoldan (eski sürüm, ileride eklenecek içe
// aktarma, veri düzeltmesi) gelmiş olabilir. Yönlendirme yapan taraf DAİMA yeniden doğrular.
//
// KAPSAM NOTU (bilinçli): bu fonksiyon "kimlik avı" riskini KALDIRMAZ, yalnız tehlikeli şemaları
// (javascript:, data:, file:) ve kimlik gömülü URL'leri eler. Kullanıcıya hedef alan adını gösteren
// bir "çıkış uyarısı" ekranı ayrı bir ARAYÜZ kararıdır — istismarı için saldırganın zaten o vakaya
// erişimi olan kimlikli bir hesabı olması gerektiğinden riski düşük değerlendirildi.

/**
 * Girilen bağlantıyı doğrular ve normalize edilmiş hâlini döndürür. Güvenli değilse `null`.
 * Fail-closed: ayrıştırılamayan her şey reddedilir.
 */
export function safeExternalUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return null; // ayrıştırılamıyor → reddet
  }

  // javascript:, data:, file:, vbscript: … hepsi burada elenir.
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  // https://kullanici:parola@site — tarayıcı adres çubuğunda alan adını gizlemek için kullanılır.
  if (u.username || u.password) return null;
  if (!u.hostname) return null;

  return u.toString(); // normalize edilmiş biçim (kaçış dizileri çözülmüş, host küçük harfe inmiş)
}
