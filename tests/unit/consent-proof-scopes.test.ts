// Birim — lib/consent-proof-scopes (kontrol raporu 2026-09-17 H12, v6.283): Onay Kanıtı sekmeleri role göre kesilir —
// hasta personel/Doctorium kapsamlarını görmez; ADMIN ve kimliksiz tam liste.
import { describe, it, expect } from "vitest";
import { CONSENT_PROOF_SCOPES, proofScopesForRole } from "@/lib/consent-proof-scopes";

const keys = (role?: string | null) => proofScopesForRole(role).map((s) => s.key);

describe("proofScopesForRole", () => {
  it("hasta: yalnız kendi kapsamları; personel/Doctorium sekmesi YOK", () => {
    const k = keys("PATIENT");
    expect(k).toEqual(["GENERAL_KVKK", "AURA_TERMS", "AI_TRIAGE", "AI_INTERPRET", "HEALTH_DECLARATION"]);
    expect(k.some((x) => x.startsWith("STAFF") || x.startsWith("DOCTORIUM"))).toBe(false);
  });
  it("doktor/koordinatör: personel + Doctorium kapsamları; hasta AI/genel kapsamları yok", () => {
    for (const role of ["DOCTOR", "COORDINATOR", "ETHICS", "AGENCY"]) {
      const k = keys(role);
      expect(k, role).toContain("STAFF_KVKK");
      expect(k, role).toContain("DOCTORIUM_KVKK");
      expect(k, role).not.toContain("AI_TRIAGE");
      expect(k, role).not.toContain("GENERAL_KVKK");
    }
  });
  it("ADMIN ve kimliksiz: tam liste (sıra korunur)", () => {
    expect(keys("ADMIN")).toEqual(CONSENT_PROOF_SCOPES.map((s) => s.key));
    expect(keys(null)).toEqual(CONSENT_PROOF_SCOPES.map((s) => s.key));
    expect(keys(undefined)).toHaveLength(CONSENT_PROOF_SCOPES.length);
  });
  it("her kapsamın etiketi var", () => {
    for (const s of CONSENT_PROOF_SCOPES) expect(s.label.length, s.key).toBeGreaterThan(3);
  });
});
