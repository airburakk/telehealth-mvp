import { describe, expect, it } from "vitest";
import { buildStudentDraft, readStudentCall, supportsStudentSource, TUBITAK_2209A_URL, verifyStudentRules } from "@/lib/social-calendar/student-evidence";
import { evaluateGates } from "@/lib/social-calendar/gates";
import { normalizePayload } from "@/lib/social-calendar/payload";
import { seriesByKey } from "@/lib/social-calendar/series";
import { callRules, programHtml } from "./student-fixture";
const now = new Date("2026-10-17T12:00Z");
const call = () => {
  const r = readStudentCall(programHtml(), "2026-10-23", now);
  if (!r.ok) throw new Error(r.reason);
  return r.value;
};

describe("TÜBİTAK 2209-A primary source adapter", () => {
  it("extracts the live call year and clock time rather than old day-only DB metadata", () => {
    expect(call()).toMatchObject({ year: "2026", callKey: "tubitak-2209a:2026", deadlineAt: "2026-11-11T17:30:00+03:00" });
    expect(Date.parse(call().deadlineAt)).toBe(Date.parse("2026-11-11T14:30:00Z"));
  });
  it("supports only exact official program routes and identity", () => {
    expect(supportsStudentSource({ title: "TÜBİTAK 2209-A", sourceUrl: TUBITAK_2209A_URL })).toBe(true);
    for (const sourceUrl of ["https://tubitak.gov.tr.evil.test/program", TUBITAK_2209A_URL + "?x=1", "http://tubitak.gov.tr", "https://user@tubitak.gov.tr/", "https://tubitak.gov.tr/other"]) {
      expect(supportsStudentSource({ title: "2209-A", sourceUrl })).toBe(false);
    }
    expect(supportsStudentSource({ title: "2209-B", sourceUrl: TUBITAK_2209A_URL })).toBe(false);
  });
  it("blocks missing/ambiguous clock times, old years and malformed calendar dates", () => {
    for (const html of [programHtml("2025"), programHtml().replace("17.30'a", "17'a"), programHtml() + programHtml(),
      programHtml().replace("11 Kasım", "31 Şubat"), programHtml("2026", "27.30")]) {
      expect(readStudentCall(html, "2026-10-23", now).ok).toBe(false);
    }
  });
  it("checks the instant at the exact Turkish cutoff and the planned publication time", () => {
    expect(readStudentCall(programHtml(), "2026-11-06", new Date("2026-11-11T14:29:59Z")).ok).toBe(true);
    expect(readStudentCall(programHtml(), "2026-11-06", new Date("2026-11-11T14:30:00Z"))).toMatchObject({ ok: false, reason: "call-closes-before-slot" });
    expect(readStudentCall(programHtml(), "2026-11-13", now).ok).toBe(false);
    const sameDay = programHtml().replace("11 Kasım", "6 Kasım");
    expect(readStudentCall(sameDay, "2026-11-06", now).ok).toBe(true);
    expect(readStudentCall(sameDay.replace("17.30", "10.30"), "2026-11-06", now).ok).toBe(false);
  });
  it("requires the same-year PDF on the exact official host and rejects cancelled calls", () => {
    for (const html of [programHtml().replaceAll("/sites/", "https://evil.test/sites/"), programHtml().replace("2026_Yili", "2025_Yili"), programHtml() + "Çağrı iptal edilmiştir."]) {
      expect(readStudentCall(html, "2026-10-23", now).ok).toBe(false);
    }
  });
  it("requires current eligibility, adviser approval and the matching PDF cutoff time", () => {
    expect(verifyStudentRules(callRules(), call())).toEqual({ ok: true, value: true });
    for (const rules of [callRules("2025"), callRules().replace("Danışman onayı", "Onay"), callRules().replace("Açık Öğretim", "Uzaktan öğretim"), callRules().replace("güncel YÖK", "YÖK")]) {
      expect(verifyStudentRules(rules, call()).ok).toBe(false);
    }
    expect(verifyStudentRules(callRules("2026", "17.00"), call())).toMatchObject({ ok: false, reason: "primary-deadline-time-conflict" });
  });
  it("builds the existing four-slide student template within limits and all current approval gates", () => {
    const p = buildStudentDraft(call());
    expect(normalizePayload(p).ok).toBe(true);
    expect(evaluateGates({ series: seriesByKey("ogrenci-kosesi")!, payload: p, sourceIds: ["edu"], sourceTexts: [], attestIdentity: false }).ok).toBe(true);
    expect(p.caption).toContain("17:30 (Türkiye saati)");
    expect(p.caption).toContain("danışman onayı");
    expect(p.slides.map((s) => s.role)).toEqual(["kapak", "genel", "genel", "kaynak"]);
    expect(JSON.stringify(p)).not.toMatch(/12\.000|maaş|işe alım|kadro|başvuru garantisi/);
  });
});
