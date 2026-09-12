// Onam mimarisi — kapı kararı (v6.211 · 2026-09-03 Doctorium A + C; v6.269 · 2026-09-13 kod Paket B: AURA kapsam seti).
//
// v6.211 (👤 karar 03.09.2026, vault output/doctorium-hukuki-belgeler/15-genel-onam-kapsam-revizyonu.md §7):
// A — AYRI KAPSAM: Doctorium'dan kayıt olan doktor/öğrenci Doctorium'un kendi aydınlatmasını (DOCTORIUM_KVKK = belge 01)
//     ve üyelik sözleşmesini (DOCTORIUM_TERMS = belge 02) onaylar. Klinik kapsam yalnız Aşama 2'de, aktivasyon şartı.
// C — EKRAN = HASH: onam ekranında gösterilen metin, hash'lenen metnin kendisidir.
//
// v6.269 (kod Paket B — AURA hukuki set Sürüm 1.0 NİHAİ, 👤 12.09.2026 S10/R17): AURA tarafı da ekran = hash'e geçti:
//   · PATIENT  → GENERAL_KVKK v4 (A01 tam metin + madde 14 açık rıza) + AURA_TERMS v1 (A02) — /onam AuraConsentGate
//   · personel (COORDINATOR·ETHICS·ADMIN·AGENCY·PARTNER·HEALTH_PRO) → STAFF_KVKK v1 (A09 + ROL KESİTİ; hash rol × dil)
//   · DOCTOR   → Aşama 1: Doctorium seti · Aşama 2 (klinik aktif): STAFF_KVKK (DOCTOR kesiti) + Doctorium seti ·
//                Doctorium'dan çıkmış: STAFF_KVKK · profilsiz DOCTOR: STAFF_KVKK (fail-safe)
//   Klinik aktivasyon şartı GENERAL_KVKK → STAFF_KVKK (lib/doctor-activation). Mevcut hasta/personel kayıtları GENERAL v3'te
//   kaldığı için herkes bir kez yeni kapıya düşer (CONSENT_VERSION 4). Kanıt sayfası her kapsamı TR+EN (personelde rol
//   kesiti) adaylarına göre doğrular (canonicalTextsFor).
//
// Kapı mantığı (proxy DB'siz kalır — JWT `cv` yine tek sayı): `gateConsentVersion` kullanıcının ROLÜNE ve aşamasına
// göre GEREKLİ kapsam setinin tam olup olmadığına bakar; tamsa CONSENT_VERSION, değilse 0. /onam sayfası DB-taze
// `missingConsentScopes` ile hangi ekranın gösterileceğine karar verir (decideConsentScreen).
import { db } from "./db";
import { CONSENT_SCOPE, CONSENT_VERSION } from "./consent-config";
import { consentedVersion, recordConsent } from "./consent";
import { AYDINLATMA_MD } from "./doctorium-legal/texts/aydinlatma";
import { KOSULLAR_MD } from "./doctorium-legal/texts/kosullar";
import { DIPLOMA_BEYAN_TEXT } from "./doctorium-legal/diploma-beyan";
import {
  AURA_TERMS_SCOPE, AURA_TERMS_TEXT, AURA_TERMS_VERSION, GENERAL_KVKK_TEXT, HEALTH_DECLARATION_SCOPE, HEALTH_DECLARATION_VERSION,
  STAFF_KVKK_SCOPE, STAFF_KVKK_VERSION, staffKvkkText,
} from "./aura-consent-texts";
import {
  AI_CONSENT_SCOPE, AI_CONSENT_VERSION, AI_INTERPRET_SCOPE, AI_INTERPRET_VERSION, AI_INTERPRET_TEXT, AI_TRIAGE_TEXT, HEALTH_DECLARATION_TEXT,
} from "./ai-consent";
import { STAFF_APPLICATION_CONSENT_SCOPE, STAFF_APPLICATION_CONSENT_TEXTS, STAFF_APPLICATION_CONSENT_VERSION } from "./staff-application-config";

export const DOCTORIUM_KVKK_SCOPE = "DOCTORIUM_KVKK";
export const DOCTORIUM_TERMS_SCOPE = "DOCTORIUM_TERMS";
export const DOCTORIUM_DIPLOMA_BEYAN_SCOPE = "DOCTORIUM_DIPLOMA_BEYAN";
/**
 * Belge 01 + 02 sürümü. Hash'lenen metin değişince artır → Doctorium üyeleri ilk girişte bir kez yeniden onaylar
 * (eski kayıtlar zincirde kendi sürümüyle kalır). 1 = Sürüm 1.0 (03.09.2026) · 2 = Sürüm 1.1 (04.09.2026, 👤 revizyon
 * turu 1: 02 madde 1.3 + madde atıfları "madde N", 01 madde 2 kutusu tek cümle, sözleşme başlıkları büyük harf) ·
 * 3 = Sürüm 1.2 (05.09.2026, 👤 revizyon turu 2 — üç katmanlı üyelik: 02 madde 2 "Deneme Erişimi" tanımı, madde 3.2
 * a–d deneme erişimi [30 gün · sponsorlu/anket/puan/ödül kapalı · ücretli üyeliğe dönüşmez · +90 gün silme], madde 10.2-e;
 * 01 madde 3.1/6/8 deneme kaydı + parolasız giriş bağlantısı 20 dk). Bayrak DOCTORIUM_TRIAL_ENABLED bu sürümden önce AÇILMAZ ·
 * 4 = Sürüm 1.4 (09.09.2026, 👤 revizyon turu 4 — tam tur kontrol: 02 madde 2 "doğrulanmış doktor" + "İçerik" tanımı + madde 4.8
 * sınav/yerleştirme verileri; 01 unvan · tercihler/amaçlar fırsat takibi · madde 8 "Belge 05 esastır" notu).
 */
export const DOCTORIUM_CONSENT_VERSION = 4;

export const DOCTORIUM_SCOPES: readonly string[] = [DOCTORIUM_KVKK_SCOPE, DOCTORIUM_TERMS_SCOPE];
/** AURA "çekirdek" kapsamlar — biri eksikse /onam general/clinical kapısı (v6.269). */
export const AURA_CORE_SCOPES: readonly string[] = [CONSENT_SCOPE, AURA_TERMS_SCOPE, STAFF_KVKK_SCOPE];

export interface ConsentStage {
  activatedAt: Date | null;
  doctoriumOptOutAt: Date | null;
}

/**
 * Rol + aşamaya göre GEREKLİ onam kapsamları (saf — birim testli, v6.269):
 *  · PATIENT → GENERAL_KVKK + AURA_TERMS
 *  · personel rolleri → STAFF_KVKK (rol kesiti)
 *  · DOCTOR, Doctorium'dan çıkmış (doctoriumOptOutAt) → STAFF_KVKK (yalnız klinik hesap)
 *  · DOCTOR, klinik aktif (activatedAt) → STAFF_KVKK + Doctorium seti (iki yüzeyi de kullanır)
 *  · DOCTOR, Aşama 1 / öğrenci → yalnız Doctorium seti (klinik onam Aşama 2'de, aktivasyon şartı olarak)
 *  · DOCTOR ama doktor profili yok (bozuk hesap) → STAFF_KVKK (fail-safe)
 */
export function requiredConsentScopes(role: string, d: ConsentStage | null): string[] {
  if (role === "PATIENT") return [CONSENT_SCOPE, AURA_TERMS_SCOPE];
  if (role !== "DOCTOR" || !d) return [STAFF_KVKK_SCOPE];
  if (d.doctoriumOptOutAt) return [STAFF_KVKK_SCOPE];
  if (d.activatedAt) return [STAFF_KVKK_SCOPE, ...DOCTORIUM_SCOPES];
  return [...DOCTORIUM_SCOPES];
}

/** Kapsamın güncel sürümü (proxy/JWT için değil — hasCurrentConsent karşılaştırması için). */
export function scopeVersion(scope: string): number {
  switch (scope) {
    case DOCTORIUM_KVKK_SCOPE:
    case DOCTORIUM_TERMS_SCOPE: return DOCTORIUM_CONSENT_VERSION;
    case AURA_TERMS_SCOPE: return AURA_TERMS_VERSION;
    case STAFF_KVKK_SCOPE: return STAFF_KVKK_VERSION;
    case AI_CONSENT_SCOPE: return AI_CONSENT_VERSION;
    case AI_INTERPRET_SCOPE: return AI_INTERPRET_VERSION;
    case HEALTH_DECLARATION_SCOPE: return HEALTH_DECLARATION_VERSION;
    case STAFF_APPLICATION_CONSENT_SCOPE: return STAFF_APPLICATION_CONSENT_VERSION;
    default: return CONSENT_VERSION;
  }
}

export interface CanonicalTexts {
  /** Kabul edilen kanonik adaylar — TR ve EN (personelde rol kesiti TR/EN); textHash bunlardan biriyle eşleşmeli. */
  texts: string[];
  version: number;
  title: string;
}

/**
 * Kanıt sayfası: kapsamın kanonik metin ADAYLARI + güncel sürümü (ekran = hash, dil başına — S4). Personel kapsamında
 * kesit role bağlıdır (ctx.role); rol yoksa tam metin adayı. Bilinmeyen kapsam → null.
 */
export function canonicalTextsFor(scope: string, ctx?: { role?: string | null }): CanonicalTexts | null {
  const role = ctx?.role ?? "";
  switch (scope) {
    case CONSENT_SCOPE: return { texts: [GENERAL_KVKK_TEXT.tr, GENERAL_KVKK_TEXT.en], version: CONSENT_VERSION, title: "KVKK Aydınlatma ve Açık Rıza (hasta)" };
    case AURA_TERMS_SCOPE: return { texts: [AURA_TERMS_TEXT.tr, AURA_TERMS_TEXT.en], version: AURA_TERMS_VERSION, title: "Kullanım Koşulları ve Hizmet Sözleşmesi" };
    case STAFF_KVKK_SCOPE: return { texts: [staffKvkkText(role, "tr"), staffKvkkText(role, "en")], version: STAFF_KVKK_VERSION, title: "Personel Aydınlatma Metni ve Rol Maddesi" };
    case AI_CONSENT_SCOPE: return { texts: [AI_TRIAGE_TEXT.tr, AI_TRIAGE_TEXT.en], version: AI_CONSENT_VERSION, title: "Yapay zekâ ile ön değerlendirme — açık rıza" };
    case AI_INTERPRET_SCOPE: return { texts: [AI_INTERPRET_TEXT.tr, AI_INTERPRET_TEXT.en], version: AI_INTERPRET_VERSION, title: "Yapay zekâ ile simültane tercüme — açık rıza" };
    case HEALTH_DECLARATION_SCOPE: return { texts: [HEALTH_DECLARATION_TEXT.tr, HEALTH_DECLARATION_TEXT.en], version: HEALTH_DECLARATION_VERSION, title: "Sigorta sağlık beyanı — açık rıza" };
    case STAFF_APPLICATION_CONSENT_SCOPE: return { texts: [STAFF_APPLICATION_CONSENT_TEXTS.tr, STAFF_APPLICATION_CONSENT_TEXTS.en], version: STAFF_APPLICATION_CONSENT_VERSION, title: "Kurumsal Üyelik Başvurusu Aydınlatması" };
    case DOCTORIUM_KVKK_SCOPE: return { texts: [AYDINLATMA_MD], version: DOCTORIUM_CONSENT_VERSION, title: "Doctorium Aydınlatma Metni" };
    case DOCTORIUM_TERMS_SCOPE: return { texts: [KOSULLAR_MD], version: DOCTORIUM_CONSENT_VERSION, title: "Doctorium Üyelik Sözleşmesi" };
    case DOCTORIUM_DIPLOMA_BEYAN_SCOPE: return { texts: [DIPLOMA_BEYAN_TEXT], version: 0, title: "Diploma doğrulama beyanı" };
    default: return null;
  }
}

/** Geriye uyum (v6.211 çağıranları/testleri): ilk aday = TR kanonik. */
export function canonicalTextFor(scope: string): { text: string; version: number; title: string } | null {
  const c = canonicalTextsFor(scope);
  return c ? { text: c.texts[0], version: c.version, title: c.title } : null;
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
 * /onam sayfasının ekran kararı (saf — birim testli). Sıra: Doctorium seti eksikse önce o; sonra AURA çekirdeği
 * (GENERAL_KVKK/AURA_TERMS hasta · STAFF_KVKK personel; DOCTOR için klinik kapı — `wantsClinical` ile onboarding'den
 * gelen istek, STAFF_KVKK "gerekli set"te olmasa da [Aşama 1 doktoru] onamsızsa klinik kapıyı gösterir); her şey
 * tamsa: klinik istekse hedefe dön, değilse JWT'yi yenile (resign).
 */
export function decideConsentScreen(p: { role: string; missing: string[]; wantsClinical: boolean; generalOk: boolean }): ConsentScreen {
  if (p.missing.some((s) => DOCTORIUM_SCOPES.includes(s))) return "doctorium";
  const coreMissing = p.missing.some((s) => AURA_CORE_SCOPES.includes(s)) || (p.wantsClinical && !p.generalOk);
  if (coreMissing) return p.role === "DOCTOR" ? "clinical" : "general";
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
