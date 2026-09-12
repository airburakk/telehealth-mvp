// AURA onam kapsamları — SAF sabitler ve metin yardımcıları (kod Paket B, v6.269 · 2026-09-13). db/auth YOK:
// client kapıları (onam/AuraConsentGate · StaffConsentGate · AiConsentGate · PreConsultLobby · PackageBuilder ·
// hesap/ConsentWithdrawPanel) ve testler buradan okur; sunucu tarafı (kayıt/aktiflik) lib/aura-consent.ts'te.
//
// Kaynak: vault output/aura-hukuki-belgeler Sürüm 1.0 NİHAİ → lib/aura-legal/texts/*.ts (_yayin-kesiti.py üretir).
// EKRAN = HASH (Doctorium 15 madde 7 Seçenek C, AURA S10): kapıda gösterilen dize, ConsentRecord.textHash'e hash'lenen
// dizenin KENDİSİDİR; dil başına ayrı hash (S4). Kapsamlar:
//   GENERAL_KVKK v4  → A01 aydınlatma + açık rıza (hasta) — CONSENT_VERSION 3→4: herkes bir kez yeniden onaylar
//   AURA_TERMS v1    → A02 kullanım koşulları ve hizmet sözleşmesi (hasta, kayıt akışında /onam kapısında)
//   STAFF_KVKK v1    → A09 personel aydınlatması + ROL KESİTİ (madde 10 yalnız rolün maddesi — R17; hash rol × dil)
//   AI_TRIAGE v2 · AI_INTERPRET v2 · HEALTH_DECLARATION v1 → A04 (b) (c) (d) (lib/ai-consent.ts sabitleri)
//   STAFF_APPLICATION_KVKK v2 → A10 (lib/staff-application-config.ts)
import { AYDINLATMA_TR, AYDINLATMA_EN } from "./aura-legal/texts/aydinlatma";
import { KOSULLAR_TR, KOSULLAR_EN } from "./aura-legal/texts/kosullar";
import { PERSONEL_TR, PERSONEL_EN } from "./aura-legal/texts/personel";
import type { ConsentLang } from "./consent-lang";

export const AURA_TERMS_SCOPE = "AURA_TERMS";
export const AURA_TERMS_VERSION = 1;
export const STAFF_KVKK_SCOPE = "STAFF_KVKK";
export const STAFF_KVKK_VERSION = 1;
export const HEALTH_DECLARATION_SCOPE = "HEALTH_DECLARATION";
export const HEALTH_DECLARATION_VERSION = 1;

export const GENERAL_KVKK_TEXT: Record<ConsentLang, string> = { tr: AYDINLATMA_TR, en: AYDINLATMA_EN };
export const AURA_TERMS_TEXT: Record<ConsentLang, string> = { tr: KOSULLAR_TR, en: KOSULLAR_EN };
/** A09 tam metni (7 rol maddesiyle) — kapıda rol kesiti gösterilir (staffKvkkText). */
export const STAFF_KVKK_FULL_TEXT: Record<ConsentLang, string> = { tr: PERSONEL_TR, en: PERSONEL_EN };

/** Personel rolleri (hasta dışı, DOCTOR hariç) — STAFF_KVKK kapısını görürler; DOCTOR Aşama 2 klinik aktivasyonda görür. */
export const STAFF_ROLES = ["COORDINATOR", "ETHICS", "ADMIN", "AGENCY", "PARTNER", "HEALTH_PRO"] as const;

/** A09 madde 10 rol maddesi numarası (10.N) — kesit bu paragrafı bırakır, diğer altısını düşürür. */
export const STAFF_ROLE_CLAUSE: Record<string, number> = {
  DOCTOR: 1, COORDINATOR: 2, ETHICS: 3, ADMIN: 4, AGENCY: 5, PARTNER: 6, HEALTH_PRO: 7,
};

const CLAUSE_SECTION_RE = /^## 10\./;

/**
 * STAFF_KVKK kanonik KESİTİ (R17: "rol ekleri kanonik metne"): A09 gövdesinde madde 10 altında yalnız rolün
 * paragrafı kalır (madde başlığı + `**10.N …**` paragrafı); diğer bölümler aynen. Bilinmeyen rol → tam metin
 * (fail-safe: fazla bilgilendirme, eksik değil). Saf ve deterministik → hash rol × dil için sabittir.
 */
export function staffKvkkText(role: string, lang: ConsentLang): string {
  const body = STAFF_KVKK_FULL_TEXT[lang];
  const n = STAFF_ROLE_CLAUSE[role];
  if (!n) return body;
  const lines = body.split("\n");
  const start = lines.findIndex((l) => CLAUSE_SECTION_RE.test(l));
  if (start < 0) return body;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## ") || lines[i].trim() === "---") { end = i; break; }
  }
  const paragraphs: string[][] = [];
  let cur: string[] = [];
  for (const l of lines.slice(start + 1, end)) {
    if (l.trim() === "") { if (cur.length) { paragraphs.push(cur); cur = []; } }
    else cur.push(l);
  }
  if (cur.length) paragraphs.push(cur);
  const kept = paragraphs.filter((p) => p[0].startsWith(`**10.${n} `) || p[0].startsWith(`**10.${n}.`));
  const section = [lines[start], "", ...kept.map((p) => p.join("\n")), ""];
  return [...lines.slice(0, start), ...section, ...lines.slice(end)].join("\n");
}

// ── Rıza geri alma (Hesabım) ─────────────────────────────────────────────────────────────────────
// Geri alınabilir kovalar: AI_TRIAGE · AI_INTERPRET · HEALTH_DECLARATION (A01 madde 12 / A04: "rızanızı dilediğiniz zaman
// geri alabilirsiniz; geri alma o ana kadar yapılmış işlemi etkilemez"). GENERAL_KVKK'nın geri alınması hizmetin
// sona ermesidir → hesap silme akışı (DeleteAccountPanel), burada değil. Geri alma = `<KAPSAM>_REVOKE` kovasına sayaç-
// sürümlü kayıt (sponsor/hr-consent deseni); aktiflik = son verme kaydı son geri almadan SONRA mı (decideActive).
export const REVOCABLE_SCOPES = ["AI_TRIAGE", "AI_INTERPRET", "HEALTH_DECLARATION"] as const;
export type RevocableScope = (typeof REVOCABLE_SCOPES)[number];

export function revokeScopeOf(scope: RevocableScope): string {
  return `${scope}_REVOKE`;
}

/** Geri alma beyanı — kayda hash'lenen metin (⚖️ asistan yazımı; 👤 onayı bekler, kılavuz madde 4 Paket B notu). */
export const REVOKE_TEXT: Record<RevocableScope, Record<ConsentLang, string>> = {
  AI_TRIAGE: {
    tr: "Yapay zekâ ile ön değerlendirme ve belge çevirisi için verdiğim açık rızayı geri alıyorum. Geri almanın o ana kadar yapılmış işlemleri etkilemediğini ve yeni bir başvuru için rızamın yeniden isteneceğini biliyorum.",
    en: "I withdraw the explicit consent I gave for AI-assisted preliminary assessment and document translation. I understand that withdrawal does not affect processing carried out until now and that my consent will be requested again for a new case.",
  },
  AI_INTERPRET: {
    tr: "Yapay zekâ ile simültane tercüme için verdiğim açık rızayı geri alıyorum. Geri almanın o ana kadar yapılan tercümeyi etkilemediğini ve sonraki görüşmede rızamın yeniden isteneceğini biliyorum.",
    en: "I withdraw the explicit consent I gave for AI simultaneous interpretation. I understand that withdrawal does not affect interpretation carried out until now and that my consent will be requested again at the next consultation.",
  },
  HEALTH_DECLARATION: {
    tr: "Sigorta sağlık beyanımın işlenmesi için verdiğim açık rızayı geri alıyorum. Beyanımı Hesabım veya paket ekranından silebileceğimi, geri almanın o ana kadar hesaplanmış prim tahminini etkilemediğini biliyorum.",
    en: "I withdraw the explicit consent I gave for the processing of my insurance health declaration. I understand that I can delete my declaration from My Account or the package screen and that withdrawal does not affect the premium estimate calculated until now.",
  },
};

export const REVOCABLE_LABEL: Record<RevocableScope, Record<ConsentLang, string>> = {
  AI_TRIAGE: { tr: "Yapay zekâ ile ön değerlendirme ve belge çevirisi", en: "AI-assisted preliminary assessment and document translation" },
  AI_INTERPRET: { tr: "Yapay zekâ ile simültane tercüme", en: "AI simultaneous interpretation" },
  HEALTH_DECLARATION: { tr: "Sigorta sağlık beyanı", en: "Insurance health declaration" },
};

/** Aktiflik kararı (saf — birim testli): güncel sürümde verme kaydı var ve son geri alma ondan ÖNCE. */
export function decideActive(
  grant: { version: number; grantedAt: Date } | null,
  revoke: { grantedAt: Date } | null,
  requiredVersion: number,
): boolean {
  if (!grant || grant.version < requiredVersion) return false;
  if (!revoke) return true;
  return revoke.grantedAt.getTime() < grant.grantedAt.getTime();
}
