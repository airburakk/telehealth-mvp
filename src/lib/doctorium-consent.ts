// Doctorium onam mimarisi (v6.211 · 2026-09-03) — 👤 karar 03.09.2026: Seçenek A + C
// (vault output/doctorium-hukuki-belgeler/15-genel-onam-kapsam-revizyonu.md §7).
//
// A — AYRI KAPSAM: Doctorium'dan kayıt olan doktor/öğrenci telesağlık metnini (GENERAL_KVKK) DEĞİL,
//     Doctorium'un kendi aydınlatmasını (DOCTORIUM_KVKK = belge 01) ve üyelik sözleşmesini
//     (DOCTORIUM_TERMS = belge 02) onaylar. Klinik kapsam (GENERAL_KVKK) yalnız Aşama 2'de,
//     klinik aktivasyonun ÖN KOŞULU olarak alınır (refreshActivation bu onam yoksa activatedAt yazmaz).
// C — EKRAN = HASH: onam ekranında gösterilen metin, hash'lenen metnin kendisidir (lib/doctorium-legal
//     texts/*.ts tek kaynak; LegalMarkdown yalnız yapıya ayırır, metni değiştirmez).
//
// Kapı mantığı (proxy DB'siz kalır — JWT `cv` yine tek sayı): `gateConsentVersion` kullanıcının
// ROLÜNE ve aşamasına göre GEREKLİ kapsam setinin tam olup olmadığına bakar; tamsa CONSENT_VERSION,
// değilse 0 döner. Böylece proxy'deki `cv < CONSENT_VERSION → /onam` kuralı değişmeden Doctorium
// doktoru kendi kapısına, hasta/personel eski kapısına düşer. /onam sayfası DB-taze `missingConsentScopes`
// ile hangi ekranın gösterileceğine karar verir.
//
// Mevcut üyeler (👤 15 §7/3): Doctorium seti olmayan her doktor ilk girişte Doctorium metnini onaylar
// (Aşama 2 doktorları dâhil — Doctorium'u da kullanıyorlar). GENERAL onamı olan aktif doktorlar
// klinik erişimini KAYBETMEZ (activatedAt zaten dolu; şart yalnız yeni aktivasyonda aranır).
import { db } from "./db";
import { CONSENT_SCOPE, CONSENT_VERSION, CONSENT_TEXT } from "./consent-config";
import { consentedVersion, recordConsent } from "./consent";
import { AYDINLATMA_MD } from "./doctorium-legal/texts/aydinlatma";
import { KOSULLAR_MD } from "./doctorium-legal/texts/kosullar";
import { DIPLOMA_BEYAN_TEXT } from "./doctorium-legal/diploma-beyan";

export const DOCTORIUM_KVKK_SCOPE = "DOCTORIUM_KVKK";
export const DOCTORIUM_TERMS_SCOPE = "DOCTORIUM_TERMS";
export const DOCTORIUM_DIPLOMA_BEYAN_SCOPE = "DOCTORIUM_DIPLOMA_BEYAN";
/**
 * Belge 01 + 02 sürümü. Hash'lenen metin değişince artır → Doctorium üyeleri ilk girişte bir kez yeniden onaylar
 * (eski kayıtlar zincirde kendi sürümüyle kalır). 1 = Sürüm 1.0 (03.09.2026) · 2 = Sürüm 1.1 (04.09.2026, 👤 revizyon
 * turu 1: 02 madde 1.3 + madde atıfları "madde N", 01 madde 2 kutusu tek cümle, sözleşme başlıkları büyük harf).
 */
export const DOCTORIUM_CONSENT_VERSION = 2;

export const DOCTORIUM_SCOPES: readonly string[] = [DOCTORIUM_KVKK_SCOPE, DOCTORIUM_TERMS_SCOPE];

export interface ConsentStage {
  activatedAt: Date | null;
  doctoriumOptOutAt: Date | null;
}

/**
 * Rol + aşamaya göre GEREKLİ onam kapsamları (saf — birim testli):
 *  · PATIENT / personel rolleri → GENERAL_KVKK (mevcut düzen)
 *  · DOCTOR, Doctorium'dan çıkmış (doctoriumOptOutAt) → GENERAL_KVKK (yalnız klinik hesap)
 *  · DOCTOR, klinik aktif (activatedAt) → GENERAL_KVKK + Doctorium seti (iki yüzeyi de kullanır)
 *  · DOCTOR, Aşama 1 / öğrenci → yalnız Doctorium seti (klinik onam Aşama 2'de, aktivasyon şartı olarak)
 *  · DOCTOR ama doktor profili yok (bozuk hesap) → GENERAL_KVKK (eski davranış, fail-safe)
 */
export function requiredConsentScopes(role: string, d: ConsentStage | null): string[] {
  if (role !== "DOCTOR" || !d) return [CONSENT_SCOPE];
  if (d.doctoriumOptOutAt) return [CONSENT_SCOPE];
  if (d.activatedAt) return [CONSENT_SCOPE, ...DOCTORIUM_SCOPES];
  return [...DOCTORIUM_SCOPES];
}

/** Kapsamın güncel sürümü (proxy/JWT için değil — hasCurrentConsent karşılaştırması için). */
export function scopeVersion(scope: string): number {
  return DOCTORIUM_SCOPES.includes(scope) ? DOCTORIUM_CONSENT_VERSION : CONSENT_VERSION;
}

/** Kanıt sayfası: kapsamın kanonik metni + güncel sürümü (textHash eşleşmesi buna göre). */
export function canonicalTextFor(scope: string): { text: string; version: number; title: string } | null {
  switch (scope) {
    case CONSENT_SCOPE: return { text: CONSENT_TEXT, version: CONSENT_VERSION, title: "KVKK Aydınlatma & Açık Rıza (telesağlık)" };
    case DOCTORIUM_KVKK_SCOPE: return { text: AYDINLATMA_MD, version: DOCTORIUM_CONSENT_VERSION, title: "Doctorium Aydınlatma Metni" };
    case DOCTORIUM_TERMS_SCOPE: return { text: KOSULLAR_MD, version: DOCTORIUM_CONSENT_VERSION, title: "Doctorium Üyelik Sözleşmesi" };
    case DOCTORIUM_DIPLOMA_BEYAN_SCOPE: return { text: DIPLOMA_BEYAN_TEXT, version: 0, title: "Diploma doğrulama beyanı" };
    default: return null;
  }
}

async function stageFor(userId: string): Promise<ConsentStage | null> {
  const me = await db.user.findUnique({ where: { id: userId }, select: { doctorId: true } });
  if (!me?.doctorId) return null;
  return db.doctor.findUnique({ where: { id: me.doctorId }, select: { activatedAt: true, doctoriumOptOutAt: true } });
}

/** DB-taze: gerekli olup verilmemiş kapsamlar (sırayla). Boş = kapı geçilir. */
export async function missingConsentScopes(userId: string, role: string): Promise<string[]> {
  const required = requiredConsentScopes(role, role === "DOCTOR" ? await stageFor(userId) : null);
  const out: string[] = [];
  for (const scope of required) {
    if ((await consentedVersion(userId, scope)) < scopeVersion(scope)) out.push(scope);
  }
  return out;
}

export type ConsentScreen = "doctorium" | "clinical" | "general" | "resign" | "redirect";

/**
 * /onam sayfasının ekran kararı (saf — birim testli). Sıra: Doctorium seti eksikse önce o; sonra
 * GENERAL (hasta/personel için normal kapı; DOCTOR için klinik kapı — `wantsClinical` ile onboarding'den
 * gelen istek, GENERAL "gerekli set"te olmasa da [Aşama 1 doktoru] onamsızsa klinik kapıyı gösterir);
 * her şey tamsa: klinik istekse hedefe dön, değilse JWT'yi yenile (resign).
 */
export function decideConsentScreen(p: { role: string; missing: string[]; wantsClinical: boolean; generalOk: boolean }): ConsentScreen {
  if (p.missing.some((s) => DOCTORIUM_SCOPES.includes(s))) return "doctorium";
  const generalMissing = p.missing.includes(CONSENT_SCOPE) || (p.wantsClinical && !p.generalOk);
  if (generalMissing) return p.role === "DOCTOR" ? "clinical" : "general";
  return p.wantsClinical ? "redirect" : "resign";
}

/**
 * JWT `cv` değeri — proxy'nin `cv < CONSENT_VERSION → /onam` kuralıyla uyumlu tek sayı:
 * gerekli set tamsa CONSENT_VERSION, eksikse 0. login/OAuth/signup ve /api/consent bunu yazar.
 */
export async function gateConsentVersion(userId: string, role: string): Promise<number> {
  return (await missingConsentScopes(userId, role)).length === 0 ? CONSENT_VERSION : 0;
}

/** Doctorium seti (01 + 02) — iki kayıt, ikisi de idempotent (aynı kullanıcı/kapsam/sürüm bir kez). */
export async function recordDoctoriumConsent(userId: string, ip?: string | null, userAgent?: string | null): Promise<void> {
  await recordConsent(userId, ip, userAgent, { scope: DOCTORIUM_KVKK_SCOPE, version: DOCTORIUM_CONSENT_VERSION, text: AYDINLATMA_MD });
  await recordConsent(userId, ip, userAgent, { scope: DOCTORIUM_TERMS_SCOPE, version: DOCTORIUM_CONSENT_VERSION, text: KOSULLAR_MD });
}

/** Diploma beyanı — her yükleme ayrı satır (version = kova içi sayaç; sponsor.ts deseni). Fail-closed: throw ederse yükleme yapılmaz. */
export async function recordDiplomaDeclaration(userId: string, ip?: string | null, userAgent?: string | null): Promise<void> {
  const next = (await consentedVersion(userId, DOCTORIUM_DIPLOMA_BEYAN_SCOPE)) + 1;
  await recordConsent(userId, ip, userAgent, { scope: DOCTORIUM_DIPLOMA_BEYAN_SCOPE, version: next, text: DIPLOMA_BEYAN_TEXT });
}
