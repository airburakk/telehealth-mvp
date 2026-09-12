// Yapay zekâ işleme AÇIK RIZALARI — saf sabitler (db importsuz; client kapıları + proxy/Node her ikisinden okunur).
//
// v2 (kod Paket B, v6.269 · 2026-09-13 — AURA hukuki set Sürüm 1.0 NİHAİ, belge A04 (b)(c)(d), 👤 12.09.2026 R3/R4):
// metinler vault'tan üretilir (lib/aura-legal/texts/acik-riza — _yayin-kesiti.py), TR kanonik + EN ikinci kanonik,
// EKRAN = HASH ve hash DİL BAŞINA. Sürüm 1→2: hastalar bir kez yeniden onaylar (eski v1 kayıtları zincirde kalır).
//   AI_TRIAGE v2       — ön değerlendirme + belge çevirisi; sağlayıcı adıyla (Anthropic/Claude, ABD; ad iletilmez);
//                        dört başvuru yolunda formdan ÖNCE (AiConsentGate); rıza yoksa başvuru oluşturulamaz.
//   AI_INTERPRET v2    — simültane tercüme (Google Gemini Live, ABD; ses kaydedilmez); YALNIZ görüşme dilleri farklıysa,
//                        cihaz izninden ÖNCE (PreConsultLobby); "tercümesiz devam" seçeneği (R4).
//   HEALTH_DECLARATION — sigorta sağlık beyanı (kapsam/sürüm lib/aura-consent-texts; metin burada, aynı kaynak dosya).
// Geri alma: Hesabım → Rızalarım (lib/aura-consent activeConsent; uçlar geri-alma duyarlı kontrol yapar).
import { AI_TRIAGE_TR, AI_TRIAGE_EN, AI_INTERPRET_TR, AI_INTERPRET_EN, HEALTH_DECLARATION_TR, HEALTH_DECLARATION_EN } from "./aura-legal/texts/acik-riza";
import type { ConsentLang } from "./consent-lang";

export const AI_CONSENT_SCOPE = "AI_TRIAGE";
export const AI_CONSENT_VERSION = 2;
export const AI_TRIAGE_TEXT: Record<ConsentLang, string> = { tr: AI_TRIAGE_TR, en: AI_TRIAGE_EN };

export const AI_INTERPRET_SCOPE = "AI_INTERPRET";
export const AI_INTERPRET_VERSION = 2;
export const AI_INTERPRET_TEXT: Record<ConsentLang, string> = { tr: AI_INTERPRET_TR, en: AI_INTERPRET_EN };

export const HEALTH_DECLARATION_TEXT: Record<ConsentLang, string> = { tr: HEALTH_DECLARATION_TR, en: HEALTH_DECLARATION_EN };
