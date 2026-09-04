// Doctorium onam mimarisi (v6.211, 2026-09-03 — 👤 karar 15 §7: Seçenek A + C) — saf sözleşmeler:
//  · requiredConsentScopes: rol/aşama → gerekli kapsam seti (PATIENT/personel → GENERAL; Aşama 1 doktor ve
//    öğrenci → yalnız Doctorium seti; Aşama 2 doktor → GENERAL + Doctorium; Doctorium'dan çıkan → GENERAL)
//  · canonicalTextFor: kanıt sayfası her kapsamı kendi kanonik metniyle doğrular (ekran = hash)
//  · diploma beyanı: 6 madde; hash'lenen metin ekrandaki maddelerle aynı kaynaktan
import { describe, it, expect } from "vitest";
import {
  requiredConsentScopes, scopeVersion, canonicalTextFor, decideConsentScreen,
  DOCTORIUM_KVKK_SCOPE, DOCTORIUM_TERMS_SCOPE, DOCTORIUM_DIPLOMA_BEYAN_SCOPE, DOCTORIUM_CONSENT_VERSION, DOCTORIUM_SCOPES,
} from "@/lib/doctorium-consent";
import { CONSENT_SCOPE, CONSENT_VERSION } from "@/lib/consent-config";
import { AYDINLATMA_MD } from "@/lib/doctorium-legal/texts/aydinlatma";
import { KOSULLAR_MD } from "@/lib/doctorium-legal/texts/kosullar";
import { OGRENCI_EKI_MD } from "@/lib/doctorium-legal/texts/ogrenci-eki";
import { DIPLOMA_BEYAN_ITEMS, DIPLOMA_BEYAN_TEXT } from "@/lib/doctorium-legal/diploma-beyan";

const stage = (o: Partial<{ activatedAt: Date | null; doctoriumOptOutAt: Date | null }> = {}) => ({
  activatedAt: null, doctoriumOptOutAt: null, ...o,
});

describe("requiredConsentScopes — rol/aşama → gerekli set", () => {
  it("hasta ve personel rolleri yalnız GENERAL_KVKK (mevcut düzen değişmez)", () => {
    for (const r of ["PATIENT", "COORDINATOR", "ADMIN", "AGENCY", "PARTNER", "HEALTH_PRO", "ETHICS"]) {
      expect(requiredConsentScopes(r, stage()), r).toEqual([CONSENT_SCOPE]);
    }
  });
  it("Aşama 1 doktoru / öğrenci → yalnız Doctorium seti (telesağlık metni İMZALATILMAZ)", () => {
    expect(requiredConsentScopes("DOCTOR", stage())).toEqual([DOCTORIUM_KVKK_SCOPE, DOCTORIUM_TERMS_SCOPE]);
  });
  it("Aşama 2 (klinik aktif) doktor → GENERAL + Doctorium seti (iki yüzeyi de kullanır)", () => {
    expect(requiredConsentScopes("DOCTOR", stage({ activatedAt: new Date() }))).toEqual([CONSENT_SCOPE, ...DOCTORIUM_SCOPES]);
  });
  it("Doctorium'dan çıkmış klinik doktor → yalnız GENERAL", () => {
    expect(requiredConsentScopes("DOCTOR", stage({ activatedAt: new Date(), doctoriumOptOutAt: new Date() }))).toEqual([CONSENT_SCOPE]);
  });
  it("doktor profili olmayan DOCTOR (bozuk hesap) → GENERAL (fail-safe, eski davranış)", () => {
    expect(requiredConsentScopes("DOCTOR", null)).toEqual([CONSENT_SCOPE]);
  });
});

describe("decideConsentScreen — /onam ekran kararı", () => {
  const D = [DOCTORIUM_KVKK_SCOPE, DOCTORIUM_TERMS_SCOPE];
  it("Doctorium seti eksik → doctorium kapısı (klinik istek olsa bile önce o)", () => {
    expect(decideConsentScreen({ role: "DOCTOR", missing: D, wantsClinical: false, generalOk: false })).toBe("doctorium");
    expect(decideConsentScreen({ role: "DOCTOR", missing: D, wantsClinical: true, generalOk: false })).toBe("doctorium");
  });
  it("hasta/personel GENERAL eksik → general kapısı", () => {
    expect(decideConsentScreen({ role: "PATIENT", missing: [CONSENT_SCOPE], wantsClinical: false, generalOk: false })).toBe("general");
  });
  it("Aşama 1 doktoru klinik istekle gelir, GENERAL yok → clinical kapısı (canlı bulgu 03.09.2026: eskiden yanlışlıkla onboarding'e dönüyordu)", () => {
    expect(decideConsentScreen({ role: "DOCTOR", missing: [], wantsClinical: true, generalOk: false })).toBe("clinical");
  });
  it("Aşama 2 doktoru GENERAL eksik (gerekli sette) → clinical", () => {
    expect(decideConsentScreen({ role: "DOCTOR", missing: [CONSENT_SCOPE], wantsClinical: false, generalOk: false })).toBe("clinical");
  });
  it("her şey tam: klinik istekse redirect, değilse resign (JWT yenile — proxy döngüsü kapanır)", () => {
    expect(decideConsentScreen({ role: "DOCTOR", missing: [], wantsClinical: true, generalOk: true })).toBe("redirect");
    expect(decideConsentScreen({ role: "DOCTOR", missing: [], wantsClinical: false, generalOk: true })).toBe("resign");
    expect(decideConsentScreen({ role: "PATIENT", missing: [], wantsClinical: false, generalOk: true })).toBe("resign");
  });
});

describe("kapsam sürümleri ve kanonik metinler", () => {
  it("Doctorium seti v2 (Sürüm 1.1 — 04.09.2026 revizyon turu 1); GENERAL CONSENT_VERSION", () => {
    expect(DOCTORIUM_CONSENT_VERSION).toBe(2);
    expect(scopeVersion(DOCTORIUM_KVKK_SCOPE)).toBe(2);
    expect(scopeVersion(DOCTORIUM_TERMS_SCOPE)).toBe(2);
    expect(scopeVersion(CONSENT_SCOPE)).toBe(CONSENT_VERSION);
  });
  it("canonicalTextFor: ekran = hash — kapsamın metni yayın kesitiyle birebir aynı nesne", () => {
    expect(canonicalTextFor(DOCTORIUM_KVKK_SCOPE)).toMatchObject({ text: AYDINLATMA_MD, version: 2 });
    expect(canonicalTextFor(DOCTORIUM_TERMS_SCOPE)).toMatchObject({ text: KOSULLAR_MD, version: 2 });
    expect(canonicalTextFor(DOCTORIUM_DIPLOMA_BEYAN_SCOPE)).toMatchObject({ text: DIPLOMA_BEYAN_TEXT, version: 0 });
    expect(canonicalTextFor(CONSENT_SCOPE)?.version).toBe(CONSENT_VERSION);
    expect(canonicalTextFor("YOK")).toBeNull();
  });
});

describe("diploma beyanı (belge 11 §B, 👤 03.09.2026)", () => {
  it("altı madde; hash'lenen metin maddeleri sırayla içerir", () => {
    expect(DIPLOMA_BEYAN_ITEMS).toHaveLength(6);
    for (const [i, t] of DIPLOMA_BEYAN_ITEMS.entries()) expect(DIPLOMA_BEYAN_TEXT).toContain(`${i + 1}. ${t}`);
  });
  it("kararları söyler: kabulde saklanmaz · incelemede geçici · TCKN yalnız sorguda · muvafakat · sahte belge", () => {
    for (const s of ["saklanmayacağını", "insan incelemesi için geçici olarak", "yalnız sorgu amacıyla", "muvafakat", "sahte belge"]) {
      expect(DIPLOMA_BEYAN_TEXT).toContain(s);
    }
    expect(DIPLOMA_BEYAN_TEXT).not.toContain("(TASLAK)");
  });
});

describe("öğrenci eki (belge 07 §A) — aydınlatma niteliğinde, kayıt akışında gösterilir", () => {
  it("18 yaş şartı ve statü değişikliği bildirme yükümlülüğü metinde; taslak/iç-not yok", () => {
    expect(OGRENCI_EKI_MD).toContain("18 yaşını doldurmuş");
    expect(OGRENCI_EKI_MD).toContain("bildirmekle");
    for (const bad of ["(TASLAK)", "👤", "✅", ".md`"]) expect(OGRENCI_EKI_MD).not.toContain(bad);
  });
});
