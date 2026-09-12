// AURA onam mimarisi — kod Paket B (v6.269, 2026-09-13; AURA hukuki set Sürüm 1.0 NİHAİ, 👤 S4/S10/R3/R4/R17) — saf sözleşmeler:
//  1) Kapsam/sürüm: GENERAL_KVKK v4 · AURA_TERMS v1 · STAFF_KVKK v1 · AI_TRIAGE v2 · AI_INTERPRET v2 · HEALTH_DECLARATION v1 ·
//     STAFF_APPLICATION_KVKK v2 — metinler vault yayın kesiti (etiket/taslak/iç not/"hekim" SIZMAZ).
//  2) Rol kesiti (R17): staffKvkkText yalnız rolün madde 10 paragrafını bırakır; 7 rol × 2 dil = 14 farklı hash; bilinmeyen rol tam metin.
//  3) Kanıt adayları (S4): canonicalTextsFor TR + EN; personelde rol kesiti; STAFF_APPLICATION iki dil.
//  4) Geri alma: decideActive (son verme > son geri alma); REVOKE_TEXT üç kova × iki dil.
//  5) Dil yardımcıları: consentLangFor / consentLangParam / needsCourtesyTranslation / plainLegalText.
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { canonicalTextsFor, scopeVersion } from "@/lib/doctorium-consent";
import {
  AURA_TERMS_SCOPE, AURA_TERMS_TEXT, AURA_TERMS_VERSION, GENERAL_KVKK_TEXT, HEALTH_DECLARATION_SCOPE, HEALTH_DECLARATION_VERSION,
  REVOCABLE_LABEL, REVOCABLE_SCOPES, REVOKE_TEXT, STAFF_KVKK_FULL_TEXT, STAFF_KVKK_SCOPE, STAFF_KVKK_VERSION, STAFF_ROLE_CLAUSE,
  STAFF_ROLES, decideActive, revokeScopeOf, staffKvkkText,
} from "@/lib/aura-consent-texts";
import {
  AI_CONSENT_SCOPE, AI_CONSENT_VERSION, AI_INTERPRET_SCOPE, AI_INTERPRET_VERSION, AI_INTERPRET_TEXT, AI_TRIAGE_TEXT, HEALTH_DECLARATION_TEXT,
} from "@/lib/ai-consent";
import { CONSENT_SCOPE, CONSENT_VERSION } from "@/lib/consent-config";
import { STAFF_APPLICATION_CONSENT_SCOPE, STAFF_APPLICATION_CONSENT_TEXT, STAFF_APPLICATION_CONSENT_TEXTS, STAFF_APPLICATION_CONSENT_VERSION } from "@/lib/staff-application-config";
import { CONSENT_LANG_NOTE, consentLangFor, consentLangParam, needsCourtesyTranslation, plainLegalText } from "@/lib/consent-lang";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const LANGS = ["tr", "en"] as const;
const BAD = ["[İŞLETİCİ", "[MERSİS", "[KEP", "[VERBİS", "[AURA KANAL", "[AB TEMSİLCİSİ]", "[KLİNİK HİZMET", "Kılavuz", "Guide, Section", "👤", "✅", "⏳", "TASLAK", ".md`", "§", "hekim"];
const ALL_TEXTS: Record<string, Record<"tr" | "en", string>> = {
  GENERAL_KVKK: GENERAL_KVKK_TEXT, AURA_TERMS: AURA_TERMS_TEXT, STAFF_KVKK: STAFF_KVKK_FULL_TEXT,
  AI_TRIAGE: AI_TRIAGE_TEXT, AI_INTERPRET: AI_INTERPRET_TEXT, HEALTH_DECLARATION: HEALTH_DECLARATION_TEXT,
  STAFF_APPLICATION_KVKK: STAFF_APPLICATION_CONSENT_TEXTS,
};

describe("kapsamlar ve sürümler", () => {
  it("sürüm sözleşmesi: GENERAL 4 · TERMS 1 · STAFF 1 · AI_TRIAGE 2 · AI_INTERPRET 2 · HEALTH 1 · STAFF_APPLICATION 2", () => {
    expect(CONSENT_VERSION).toBe(4);
    expect(AURA_TERMS_VERSION).toBe(1);
    expect(STAFF_KVKK_VERSION).toBe(1);
    expect(AI_CONSENT_VERSION).toBe(2);
    expect(AI_INTERPRET_VERSION).toBe(2);
    expect(HEALTH_DECLARATION_VERSION).toBe(1);
    expect(STAFF_APPLICATION_CONSENT_VERSION).toBe(2);
    for (const [scope, v] of [[CONSENT_SCOPE, 4], [AURA_TERMS_SCOPE, 1], [STAFF_KVKK_SCOPE, 1], [AI_CONSENT_SCOPE, 2], [AI_INTERPRET_SCOPE, 2], [HEALTH_DECLARATION_SCOPE, 1], [STAFF_APPLICATION_CONSENT_SCOPE, 2]] as const) {
      expect(scopeVersion(scope), scope).toBe(v);
    }
  });

  it("tüm onam metinleri TR + EN yayına uygun; boş değil; iç kalıntı yok", () => {
    for (const [name, rec] of Object.entries(ALL_TEXTS)) {
      for (const lang of LANGS) {
        expect(rec[lang].length, `${name}/${lang}`).toBeGreaterThan(500);
        for (const bad of BAD) expect(rec[lang], `${name}/${lang} içinde '${bad}'`).not.toContain(bad);
      }
      expect(rec.tr).not.toBe(rec.en);
    }
  });

  it("A04 rıza metinleri sağlayıcıları adıyla söyler (S9): Anthropic (ABD) · Google (ABD); beyan metni risk çarpanını anlatır", () => {
    expect(AI_TRIAGE_TEXT.tr).toContain("Anthropic");
    expect(AI_TRIAGE_TEXT.en).toContain("Anthropic");
    expect(AI_TRIAGE_TEXT.tr).toContain("AÇIK RIZAM");
    expect(AI_INTERPRET_TEXT.tr).toContain("Google");
    expect(AI_INTERPRET_TEXT.tr).toContain("tercümesiz");
    expect(HEALTH_DECLARATION_TEXT.tr).toContain("risk çarpanı");
    expect(HEALTH_DECLARATION_TEXT.en).toContain("risk multiplier");
  });

  it("A01 kanonik: işletici yer tutucusu + madde 14 açık rıza; A02: İzmir yetkisi; A10 v2: 90 gün ret imhası (TR kanonik = STAFF_APPLICATION_CONSENT_TEXT)", () => {
    expect(GENERAL_KVKK_TEXT.tr).toContain("AURA platform işleticisi");
    expect(GENERAL_KVKK_TEXT.tr).toContain("açık rızam vardır");
    expect(AURA_TERMS_TEXT.tr).toContain("İzmir");
    expect(STAFF_APPLICATION_CONSENT_TEXT).toBe(STAFF_APPLICATION_CONSENT_TEXTS.tr);
    expect(STAFF_APPLICATION_CONSENT_TEXT).toContain("90 gün");
    expect(STAFF_APPLICATION_CONSENT_TEXTS.en).toContain("90 days");
  });
});

describe("staffKvkkText — rol kesiti (R17: rol ekleri kanonik metne)", () => {
  it("her rol yalnız kendi madde 10 paragrafını görür; diğer altı düşer; başlık ve öteki bölümler kalır", () => {
    for (const role of Object.keys(STAFF_ROLE_CLAUSE)) {
      const n = STAFF_ROLE_CLAUSE[role];
      for (const lang of LANGS) {
        const t = staffKvkkText(role, lang);
        expect(t, `${role}/${lang}`).toContain(`**10.${n} `);
        for (let k = 1; k <= 7; k++) if (k !== n) expect(t, `${role}/${lang} 10.${k} sızdı`).not.toContain(`**10.${k} `);
        expect(t).toContain("## 10.");
        expect(t).toContain("## 11.");
        expect(t).toContain("## 1.");
        expect(t.length).toBeLessThan(STAFF_KVKK_FULL_TEXT[lang].length);
      }
    }
  });
  it("7 rol × 2 dil = 14 farklı hash (kanıt eşleşmesi rol × dil); personel rolleri + DOCTOR eşlemede", () => {
    const hashes = new Set<string>();
    for (const role of Object.keys(STAFF_ROLE_CLAUSE)) for (const lang of LANGS) hashes.add(sha(staffKvkkText(role, lang)));
    expect(hashes.size).toBe(14);
    for (const r of STAFF_ROLES) expect(STAFF_ROLE_CLAUSE[r], r).toBeGreaterThan(0);
    expect(STAFF_ROLE_CLAUSE.DOCTOR).toBe(1);
  });
  it("bilinmeyen rol → tam metin (fail-safe: fazla bilgilendirme, eksik değil); deterministik", () => {
    expect(staffKvkkText("YOK", "tr")).toBe(STAFF_KVKK_FULL_TEXT.tr);
    expect(staffKvkkText("AGENCY", "en")).toBe(staffKvkkText("AGENCY", "en"));
  });
});

describe("canonicalTextsFor — kanıt adayları (S4: dil başına hash)", () => {
  it("GENERAL/TERMS/AI/HEALTH/STAFF_APPLICATION: [TR, EN]; STAFF_KVKK: role göre kesit; rolsüz → tam metin", () => {
    expect(canonicalTextsFor(CONSENT_SCOPE)?.texts).toEqual([GENERAL_KVKK_TEXT.tr, GENERAL_KVKK_TEXT.en]);
    expect(canonicalTextsFor(AI_CONSENT_SCOPE)).toMatchObject({ texts: [AI_TRIAGE_TEXT.tr, AI_TRIAGE_TEXT.en], version: 2 });
    expect(canonicalTextsFor(AI_INTERPRET_SCOPE)?.version).toBe(2);
    expect(canonicalTextsFor(HEALTH_DECLARATION_SCOPE)?.texts).toEqual([HEALTH_DECLARATION_TEXT.tr, HEALTH_DECLARATION_TEXT.en]);
    expect(canonicalTextsFor(STAFF_APPLICATION_CONSENT_SCOPE)?.texts).toEqual([STAFF_APPLICATION_CONSENT_TEXTS.tr, STAFF_APPLICATION_CONSENT_TEXTS.en]);
    expect(canonicalTextsFor(STAFF_KVKK_SCOPE, { role: "PARTNER" })?.texts).toEqual([staffKvkkText("PARTNER", "tr"), staffKvkkText("PARTNER", "en")]);
    expect(canonicalTextsFor(STAFF_KVKK_SCOPE)?.texts[0]).toBe(STAFF_KVKK_FULL_TEXT.tr);
    expect(canonicalTextsFor("YOK")).toBeNull();
  });
});

describe("geri alma — decideActive + metinler", () => {
  const d = (s: string) => new Date(s);
  it("verme yok → pasif; eski sürüm → pasif; verme var, geri alma yok → aktif", () => {
    expect(decideActive(null, null, 2)).toBe(false);
    expect(decideActive({ version: 1, grantedAt: d("2026-09-01") }, null, 2)).toBe(false);
    expect(decideActive({ version: 2, grantedAt: d("2026-09-01") }, null, 2)).toBe(true);
  });
  it("geri alma vermeden SONRA → pasif; yeniden verme geri almadan SONRA → aktif", () => {
    expect(decideActive({ version: 2, grantedAt: d("2026-09-01") }, { grantedAt: d("2026-09-02") }, 2)).toBe(false);
    expect(decideActive({ version: 2, grantedAt: d("2026-09-03") }, { grantedAt: d("2026-09-02") }, 2)).toBe(true);
  });
  it("üç geri alınabilir kova; REVOKE kovası adı; TR/EN beyan + etiket dolu", () => {
    expect(REVOCABLE_SCOPES).toEqual(["AI_TRIAGE", "AI_INTERPRET", "HEALTH_DECLARATION"]);
    expect(revokeScopeOf("AI_TRIAGE")).toBe("AI_TRIAGE_REVOKE");
    for (const s of REVOCABLE_SCOPES) for (const lang of LANGS) {
      expect(REVOKE_TEXT[s][lang].length).toBeGreaterThan(60);
      expect(REVOCABLE_LABEL[s][lang].length).toBeGreaterThan(5);
    }
  });
});

describe("dil yardımcıları (consent-lang)", () => {
  it("Türkçe → tr, her şey → en; API parametresi yalnız 'en' İngilizce", () => {
    expect(consentLangFor("Türkçe")).toBe("tr");
    expect(consentLangFor(undefined)).toBe("tr");
    expect(consentLangFor("Rusça")).toBe("en");
    expect(consentLangFor("İngilizce")).toBe("en");
    expect(consentLangParam("en")).toBe("en");
    expect(consentLangParam("de")).toBe("tr");
    expect(consentLangParam(undefined)).toBe("tr");
  });
  it("bilgilendirme çevirisi yalnız TR/EN dışı arayüz dillerinde; düz metin işaretleri soyar, bağlantı metni kalır", () => {
    expect(needsCourtesyTranslation("Türkçe")).toBe(false);
    expect(needsCourtesyTranslation("İngilizce")).toBe(false);
    expect(needsCourtesyTranslation("Arapça")).toBe(true);
    const p = plainLegalText("> **Başlık**\n>\n> ☐ **Kalın** *italik* `kod` [Belge A01](/aydinlatma).");
    expect(p).toBe("Başlık\n\nKalın italik kod Belge A01.");
    expect(CONSENT_LANG_NOTE.tr).toContain("Türkçe metin esastır");
    expect(CONSENT_LANG_NOTE.en).toContain("Turkish text prevails");
  });
});
