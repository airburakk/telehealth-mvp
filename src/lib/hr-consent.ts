// İnsan kaynakları iletişim izni (v6.87) — iki aşamalı doktor girişinin Aşama 1 rıza kalemlerinden.
// İK MODÜLÜ HENÜZ YOK: onam şimdiden toplanır; modül geldiğinde İK uzmanlarına yalnız
// hrContactOptInAt DOLU doktorlar listelenir (rızasız doktor hiçbir İK listesinde görünmez).
// Opt-in'dir, hizmete ŞART KOŞULMAZ (KVKK md.5: rıza özgür iradeyle — Doctorium erişimi bu
// onamdan bağımsız açılır).
//
// Desen lib/sponsor.ts setSponsorPersonalization ile AYNI: durum Doctor.hrContactOptInAt
// damgasında (hızlı okuma), ispat ConsentRecord zincirinde (scope kovaları — migration istemez).
import { db } from "./db";
import { recordConsent, consentedVersion } from "./consent";

// ── Açık onam sabitleri (sponsor.ts / ai-consent.ts deseni) ─────────────────────────────────────
// Grant ve revoke AYRI scope'ta ayrı satırlar: aç-kapa-aç döngüsünün her adımı zincirde ayrı
// mühürle iz bırakır (version = kova içinde artan sayaç).
export const HR_CONTACT_SCOPE = "HR_CONTACT";
export const HR_CONTACT_REVOKE_SCOPE = "HR_CONTACT_REVOKE";

// ⚖️ NİHAİ metin (v6.210, 👤 avukat kararı 03.09.2026) — kanonik kaynak: vault
// output/doctorium-hukuki-belgeler/09-acik-riza-kariyer-ik-iletisimi.md §3. Değişiklikler: "onam" →
// KVKK terimi "açık rıza" · aktarım modeli KARARLAŞTIRILDI: profil (ad-soyad, branş, şehir) yalnız
// platformda doğrulanmış işveren üyeye görünür kılınır, iletişim PLATFORM İÇİ mesajla, iletişim bilgisi
// aktarılmaz · geri alma yolu "Tercihler" · geri almanın geçmişe etkili olmayabileceği dürüstçe yazıldı ·
// "(TASLAK)" kalktı. Modül İŞKUR izniyle açılırken bu metinle rıza YENİDEN alınır (bugünkü kayıtlar
// yalnız kayıt) — metin sürümü textHash ile ispatlanır (sponsor.ts notuyla aynı kural).
export const HR_CONTACT_CONSENT_TEXT = `Doctorium'da doğrulanmış işveren üyelerin (sağlık kuruluşları ve bunların insan kaynakları yetkilileri), iş ve kariyer fırsatları hakkında benimle iletişime geçebilmesi amacıyla; mesleki profilimdeki ad-soyad, uzmanlık branşı ve şehir bilgilerimin bu üyelere platform üzerinden görünür kılınmasına açık rıza veriyorum. İletişimin yalnız platform içi mesaj yoluyla kurulacağını; e-posta adresimin, telefon numaramın ve diğer iletişim bilgilerimin işverene aktarılmayacağını biliyorum. Bu rızanın hizmet şartı olmadığını; vermediğimde veya geri aldığımda Doctorium'u aynı şekilde kullanmaya devam edeceğimi biliyorum. Rızamı Tercihler sayfasından her an geri alabileceğimi; geri aldığımda yeni iletişim taleplerinin durdurulacağını, ancak daha önce iletilmiş bilgilerin geri alınmasının mümkün olmayabileceğini anladım. Kariyer modülü henüz kullanıma açılmamıştır; rızam, modül açılıncaya kadar yalnız kayıt altında tutulur ve hiçbir aktarım yapılmaz.`;
export const HR_CONTACT_REVOKE_TEXT = `Kariyer ve insan kaynakları iletişimi için verdiğim açık rızayı geri alıyorum.`;

/**
 * İK iletişim iznini aç/kapat — durum Doctor.hrContactOptInAt, ispat ConsentRecord.
 *
 * GRANT fail-closed: ÖNCE zincir izi yazılır (recordConsent throw ederse damga atılmaz →
 * ispatsız izin AÇILMAZ). REVOKE'ta sıra TERSİNE bilinçli: geri alma iradesi DERHAL uygulanır
 * (önce damga null), iz yazımı sonra — iz hatası geri almayı bloke edemez (KVKK).
 */
export async function setHrContactConsent(
  userId: string,
  doctorId: string,
  enable: boolean,
  ip?: string | null,
  userAgent?: string | null,
): Promise<void> {
  if (enable) {
    const next = (await consentedVersion(userId, HR_CONTACT_SCOPE)) + 1;
    await recordConsent(userId, ip, userAgent, {
      scope: HR_CONTACT_SCOPE, version: next, text: HR_CONTACT_CONSENT_TEXT,
    });
    await db.doctor.update({ where: { id: doctorId }, data: { hrContactOptInAt: new Date() } });
  } else {
    await db.doctor.update({ where: { id: doctorId }, data: { hrContactOptInAt: null } });
    const next = (await consentedVersion(userId, HR_CONTACT_REVOKE_SCOPE)) + 1;
    await recordConsent(userId, ip, userAgent, {
      scope: HR_CONTACT_REVOKE_SCOPE, version: next, text: HR_CONTACT_REVOKE_TEXT,
    });
  }
}
