// Deneme mesajı ilkesi (👤 kullanıcı şartı 2026-09-05, plan §2b) — TEK KAYNAK metinler. SAF modül
// (db/env yok; client bileşenleri — Header rozeti, kayıt formu — doğrudan import eder).
//
// KURAL: 30 günlük süre sitede YALNIZ doğrulama süresi olarak anlatılır; bu sürenin hiçbir şekilde
// ücretli üyeliğe dönüşmeyeceği kesin dille söylenir. Kayıt paneli · Header rozeti · kilit bandı ·
// e-postalar · (bayrakla birlikte) landing hepsi buradan okur — kopya metin ÜRETİLMEZ.
//
// ⚖️ İfade sınırı (02 Üyelik Sözleşmesi madde 5.2 ileride ücretli HİZMET sunma hakkını saklı tutar):
// metin "denemenin ücretli üyeliğe dönüşmemesi"ne odaklanır — mutlak "hiçbir zaman / ömür boyu
// ücretsiz" vaadi YAZILMAZ (iddia kayıt defteri membership.free yasak kalıpları).
//
// 📐 Kanonik uzun metin kullanıcının (avukat) kendi ifadesidir (05.09.2026); süre ifadeleri ("birkaç
// saniye", "birkaç dakika") 👤 kararıyla AYNEN korunur. ⚠️ Bu metin LANDING'e taşınmaz: vitrin iddia
// kayıt defteri testi ölçülmemiş süre kalıplarını ("dakika") ve "yalnızca doktor" kalıbını yakalar —
// kayıt sayfası o taramanın dışındadır (bilinçli). Taşınacaksa o gün metin yeniden ele alınır.

/** Kayıt sayfası "Üyelik nasıl işler?" paneli — üç paragraf (kanonik metin, 👤 05.09.2026). */
export const TRIAL_PROMISE_PARAGRAPHS: readonly string[] = [
  "Yalnızca doktorlar ve tıp öğrencileri için kapalı bir topluluğa hitap eden bu platformu deneyimlemek için yalnızca birkaç saniyenizi ayırmanız yeterli.",
  "Platformun kalıcı bir üyesi olabilmeniz için ise doktor ve/veya tıp öğrencisi olduğunuzu doğrulamanız gerekmektedir. Bu işlem yalnızca birkaç dakikanızı alır: doktorlar için e-Devlet'ten kolaylıkla temin edilebilen Mezun Belgesi, tıp öğrencileri için mensubu bulundukları üniversitenin .edu.tr uzantılı e-posta adresi üzerinden doğrulama yeterlidir.",
  "30 günlük süre yalnızca bu doğrulamayı tamamlamanız içindir; sürenin sonunda ücretli bir üyelik başlamaz, ödeme bilgisi istenmez — Doctorium üyeliği ücretsizdir.",
];

/** Tek paragraf hâli (e-posta düz metni, test). */
export const TRIAL_PROMISE = TRIAL_PROMISE_PARAGRAPHS.join(" ");

/** Header rozeti tooltip'i / kısa hatırlatma. */
export const TRIAL_PROMISE_SHORT = "Deneme süresi yalnız doğrulama içindir · ücretli üyeliğe dönüşmez.";

/** Kilit ekranı (süre dolmuş) başlığı + notu. */
export const TRIAL_LOCKED_TITLE = "Deneme süreniz sona erdi";
export const TRIAL_LOCKED_NOTE =
  "Süre yalnız doğrulama içindi; ücret istenmez — e-Devlet barkodlu Mezun Belgenizle doğrulayın, erişiminiz yeniden açılır.";

/** Her deneme e-postasının altbilgisi. */
export const TRIAL_EMAIL_FOOTER =
  "Deneme süresi yalnız doğrulama içindir; ücretli üyeliğe dönüşmez, ödeme bilgisi istenmez. Doctorium üyeliği ücretsizdir.";

/** Kayıt sayfası adımları (panel, kanonik metnin altında). */
export const TRIAL_STEPS: readonly { title: string; body: string }[] = [
  {
    title: "1 · Hesabınızı oluşturun",
    body: "Ad soyad, e-posta, branş ve şehir — parola yok; giriş bağlantısı e-postanıza gelir. Google ya da Apple ile de girebilirsiniz.",
  },
  {
    title: "2 · 30 gün tam erişim",
    body: "Akışınız, sağlık hukuku, etkinlik takvimi ve Doctorium Post açık. Sponsorlu içerik, anket ve puan bu dönemde kapalıdır.",
  },
  {
    title: "3 · Kimliğinizi doğrulayın",
    body: "e-Devlet barkodlu Mezun Belgenizle. Doğrulama tamamlanınca üyeliğiniz kalıcı olur; tıp öğrencileri üniversite e-postasıyla doğrulanır.",
  },
];

// ── Header rozeti metinleri (client; tarih hesabı YOK — sayı/etiket sunucudan gelir) ──────────
export function trialBadgeLabel(daysLeft: number): string {
  return `DENEME · ${daysLeft} GÜN`;
}
export function trialBadgeShort(daysLeft: number): string {
  return `${daysLeft} g`;
}
export function trialBadgeTitle(endsAtLabel: string): string {
  return `Tam erişim ${endsAtLabel} tarihine kadar — e-Devlet mezun belgenizle doğrulayın. ${TRIAL_PROMISE_SHORT}`;
}
