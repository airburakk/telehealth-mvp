// AURA onam kapsamları — SUNUCU tarafı (kod Paket B, v6.269 · 2026-09-13): kayıt yardımcıları + geri-alma duyarlı
// aktiflik. Saf sabitler/kesit lib/aura-consent-texts.ts'te (client + test); kapı kararı (gerekli set, ekran, cv)
// lib/doctorium-consent.ts'te (v6.211 mimarisi korunur, kapsam seti genişler). Bu modül doctorium-consent'i
// import ETMEZ (döngü yok): doctorium-consent bunu import eder.
import { db } from "./db";
import { consentedVersion, recordConsent } from "./consent";
import { CONSENT_SCOPE, CONSENT_VERSION } from "./consent-config";
import type { ConsentLang } from "./consent-lang";
import {
  AURA_TERMS_SCOPE, AURA_TERMS_TEXT, AURA_TERMS_VERSION, GENERAL_KVKK_TEXT, REVOKE_TEXT, STAFF_KVKK_SCOPE,
  STAFF_KVKK_VERSION, decideActive, revokeScopeOf, staffKvkkText, type RevocableScope,
} from "./aura-consent-texts";

export * from "./aura-consent-texts";

/** Hasta kapısı (/onam "general"): A01 GENERAL_KVKK v4 + A02 AURA_TERMS v1 — gösterilen dilin metniyle, iki kayıt (idempotent). */
export async function recordPatientConsent(userId: string, lang: ConsentLang, ip?: string | null, userAgent?: string | null): Promise<void> {
  await recordConsent(userId, ip, userAgent, { scope: CONSENT_SCOPE, version: CONSENT_VERSION, text: GENERAL_KVKK_TEXT[lang] });
  await recordConsent(userId, ip, userAgent, { scope: AURA_TERMS_SCOPE, version: AURA_TERMS_VERSION, text: AURA_TERMS_TEXT[lang] });
}

/** Personel / Aşama 2 doktor kapısı: A09 rol kesiti (STAFF_KVKK v1) — hash rol × dil. */
export async function recordStaffConsent(userId: string, role: string, lang: ConsentLang, ip?: string | null, userAgent?: string | null): Promise<void> {
  await recordConsent(userId, ip, userAgent, { scope: STAFF_KVKK_SCOPE, version: STAFF_KVKK_VERSION, text: staffKvkkText(role, lang) });
}

/** Geri alma: `<KAPSAM>_REVOKE` kovasına sayaç-sürümlü kayıt (aynı zincir, ispatlı). */
export async function recordRevocation(userId: string, scope: RevocableScope, lang: ConsentLang, ip?: string | null, userAgent?: string | null): Promise<void> {
  const rs = revokeScopeOf(scope);
  const next = (await consentedVersion(userId, rs)) + 1;
  await recordConsent(userId, ip, userAgent, { scope: rs, version: next, text: REVOKE_TEXT[scope][lang] });
}

export interface ConsentStatus {
  active: boolean;
  grantedAt: Date | null;
  grantedVersion: number | null;
  revokedAt: Date | null;
}

/** Kapsamın geri-alma duyarlı durumu: en güncel verme kaydı vs en son geri alma (decideActive). */
export async function consentStatus(userId: string, scope: string, requiredVersion: number): Promise<ConsentStatus> {
  const [grant, revoke] = await Promise.all([
    db.consentRecord.findFirst({ where: { userId, scope }, orderBy: [{ version: "desc" }], select: { version: true, grantedAt: true } }),
    db.consentRecord.findFirst({ where: { userId, scope: `${scope}_REVOKE` }, orderBy: [{ grantedAt: "desc" }], select: { grantedAt: true } }),
  ]);
  return {
    active: decideActive(grant, revoke, requiredVersion),
    grantedAt: grant?.grantedAt ?? null,
    grantedVersion: grant?.version ?? null,
    revokedAt: revoke?.grantedAt ?? null,
  };
}

/** hasCurrentConsent'in geri-alma duyarlı eşleniği — AI/beyan uçları BUNU kullanır (geri alınan rıza kapıyı kapatır). */
export async function activeConsent(userId: string, scope: string, requiredVersion: number): Promise<boolean> {
  return (await consentStatus(userId, scope, requiredVersion)).active;
}
