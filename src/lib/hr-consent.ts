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

// ⚖️ HUKUKİ TASLAK — nihai metin kullanıcı (avukat) kontrolünden geçecek; ESASLI değişiklikte
// metin güncellenir (metin sürümü textHash ile ispatlanır — sponsor.ts notuyla aynı kural).
export const HR_CONTACT_CONSENT_TEXT = `Sağlık kuruluşları ve insan kaynakları uzmanlarının, platformdaki mesleki profilim (ad-soyad, branş, şehir) üzerinden iş ve kariyer fırsatları hakkında benimle iletişime geçmesine AÇIK ONAM veriyorum. Bu iznin hizmet şartı olmadığını, vermediğimde veya geri aldığımda platformu aynı şekilde kullanmaya devam edeceğimi, iznimi her an geri alabileceğimi ve iletişim tercihimin insan kaynakları modülü devreye girene kadar yalnız kayıt altında tutulacağını anladım. (TASLAK)`;
export const HR_CONTACT_REVOKE_TEXT = `İnsan kaynakları uzmanlarının benimle iletişime geçmesi için verdiğim açık onamı geri alıyorum. (TASLAK)`;

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
