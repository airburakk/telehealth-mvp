// Birim — lib/case-access.ts (vaka LİSTE kapsamı; kontrol raporu 2026-09-17 K02/K09).
// Kural: liste ucu nesne-düzeyi kapıdan (canCaseBeAccessedBy) DAHA GENİŞ veri döndüremez. Burada Prisma
// `where` nesnesi küçük bir değerlendiriciyle örnek satırlara uygulanır → semantik (yalnız şekil değil) sınanır.
import { describe, it, expect } from "vitest";
import {
  doctorQueueScope, staffQueueScope, scopedWhere, queueFilterWhere, queueOrderBy, caseLaneOf,
  EMPTY_CASE_SCOPE, DOCTOR_POOL_STATUSES, CASE_LIST_SELECT,
} from "@/lib/case-access";

type Row = Record<string, unknown>;
type Where = Record<string, unknown>;

// Bu dosyanın ürettiği where alt-kümesi: AND/OR · eşitlik · null · in · gte · not
function matches(where: Where, row: Row): boolean {
  for (const [k, v] of Object.entries(where)) {
    if (k === "AND") { if (!(v as Where[]).every((w) => matches(w, row))) return false; continue; }
    if (k === "OR") { if (!(v as Where[]).some((w) => matches(w, row))) return false; continue; }
    const val = row[k];
    if (v !== null && typeof v === "object") {
      const cond = v as Record<string, unknown>;
      if ("in" in cond && !(cond.in as unknown[]).includes(val)) return false;
      if ("gte" in cond && !((val as number) >= (cond.gte as number))) return false;
      if ("not" in cond && val === cond.not) return false;
    } else if (val !== v) return false;
  }
  return true;
}

const ME = { doctorId: "doc-me", branch: "Kardiyoloji", verified: true };
const row = (o: Partial<Row>): Row => ({ id: "c", doctorId: null, branch: "Kardiyoloji", status: "NEW", deletionLockedAt: null, urgency: 3, ...o });

describe("doctorQueueScope — DOCTOR liste kapsamı", () => {
  it("profilsiz / doğrulanmamış / branşsız doktor → boş küme (hiçbir satır eşleşmez)", () => {
    for (const ctx of [null, { ...ME, verified: false }, { ...ME, branch: "" }]) {
      const w = doctorQueueScope(ctx) as Where;
      expect(w).toEqual(EMPTY_CASE_SCOPE);
      expect(matches(w, row({ doctorId: "doc-me" }))).toBe(false);
    }
  });

  it("kendisine ATANMIŞ vaka: durum ve branş fark etmez", () => {
    const w = doctorQueueScope(ME) as Where;
    expect(matches(w, row({ doctorId: "doc-me", status: "DONE", branch: "Onkoloji" }))).toBe(true);
    expect(matches(w, row({ doctorId: "doc-me", status: "IN_CONSULT" }))).toBe(true);
  });

  it("BAŞKA doktora atanmış aynı-branş vaka listeye GİRMEZ (K02 — eskiden sayfa dalında giriyordu)", () => {
    const w = doctorQueueScope(ME) as Where;
    expect(matches(w, row({ doctorId: "doc-other", status: "NEW" }))).toBe(false);
    expect(matches(w, row({ doctorId: "doc-other", status: "IN_REVIEW" }))).toBe(false);
  });

  it("havuz = atanmamış + KENDİ branşı + yalnız NEW/IN_REVIEW (DOCS_PENDING/IN_CONSULT/DONE havuz değil)", () => {
    const w = doctorQueueScope(ME) as Where;
    expect(DOCTOR_POOL_STATUSES).toEqual(["NEW", "IN_REVIEW"]);
    expect(matches(w, row({ status: "NEW" }))).toBe(true);
    expect(matches(w, row({ status: "IN_REVIEW" }))).toBe(true);
    expect(matches(w, row({ status: "DOCS_PENDING" }))).toBe(false);
    expect(matches(w, row({ status: "IN_CONSULT" }))).toBe(false);
    expect(matches(w, row({ status: "DONE" }))).toBe(false);
    expect(matches(w, row({ status: "NEW", branch: "Onkoloji" }))).toBe(false); // yabancı branş
  });

  it("silme-kilitli vaka HİÇBİR dalda listelenmez (atanmış olsa bile — v6.11 taahhüdü)", () => {
    const w = doctorQueueScope(ME) as Where;
    expect(matches(w, row({ doctorId: "doc-me", deletionLockedAt: new Date() }))).toBe(false);
    expect(matches(w, row({ deletionLockedAt: new Date() }))).toBe(false);
  });
});

describe("staffQueueScope + filtreler", () => {
  it("personel tüm kuyruğu görür, kilitliler hariç", () => {
    const w = staffQueueScope() as Where;
    expect(matches(w, row({ doctorId: "x", status: "DONE", branch: "Onkoloji" }))).toBe(true);
    expect(matches(w, row({ deletionLockedAt: new Date() }))).toBe(false);
  });

  it("filtre kapsamı GENİŞLETEMEZ: durum=DONE filtresi doktorun havuz-dışı DONE vakasını getirmez", () => {
    const w = scopedWhere(doctorQueueScope(ME), { status: "DONE" }) as Where;
    expect(matches(w, row({ doctorId: "doc-me", status: "DONE" }))).toBe(true);
    expect(matches(w, row({ doctorId: null, status: "DONE" }))).toBe(false);
  });

  it("filtresizde kapsam aynen döner; acil filtresi urgency>=4; boş filtre nesnesi", () => {
    const scope = staffQueueScope();
    expect(scopedWhere(scope, {})).toBe(scope);
    expect(queueFilterWhere({ urgent: true })).toEqual({ urgency: { gte: 4 } });
    expect(queueFilterWhere({})).toEqual({});
    const w = scopedWhere(scope, { urgent: true, branch: "Onkoloji" }) as Where;
    expect(matches(w, row({ urgency: 4, branch: "Onkoloji" }))).toBe(true);
    expect(matches(w, row({ urgency: 3, branch: "Onkoloji" }))).toBe(false);
  });

  it("sıralama: aciliyet varsayılan, en yeni tek alan", () => {
    expect(queueOrderBy("urgency")).toEqual([{ urgency: "desc" }, { createdAt: "desc" }]);
    expect(queueOrderBy("newest")).toEqual([{ createdAt: "desc" }]);
  });
});

describe("liste DTO'su", () => {
  it("kulvar türetimi: turizm > ücretsiz > uzaktan sağlık", () => {
    expect(caseLaneOf({ tourismPlan: "{}", freeCare: true })).toBe("tourism");
    expect(caseLaneOf({ tourismPlan: null, freeCare: true })).toBe("free");
    expect(caseLaneOf({ tourismPlan: null, freeCare: false })).toBe("telehealth");
  });

  it("CASE_LIST_SELECT klinik metin/beyan/telefon taşımaz (dar liste-DTO)", () => {
    for (const forbidden of ["symptoms", "reasoning", "extra", "patientPhone", "healthDeclaration", "dischargeReport", "labResults", "documents"]) {
      expect(forbidden in CASE_LIST_SELECT).toBe(false);
    }
  });
});
