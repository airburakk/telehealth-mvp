// Landing öğrenci hunisi — /admin/landing-analitik paneli (2026-09-19). Saf hesap: LandingEvent agregat satırları → huni.
// Beklentiler 2026-09-19 prod salt-okur ölçümünden (vault log): 9 günde section_view/ogrenci 8 (4 gün) · student_click 0 ·
// landing_view 33 · hero 30 → hero sonrası bölüme ulaşan ~%27, tıklama oranı 0, örneklem küçük.
import { describe, it, expect } from "vitest";
import {
  studentFunnel, STUDENT_FUNNEL_SINCE, STUDENT_CLICK_PLACEMENTS, STUDENT_FUNNEL_MIN_SAMPLE,
} from "@/lib/doctorium-landing/student-funnel";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const row = (name: string, placement: string, day: string, count: number) => ({ name, placement, day: d(day), count });

describe("studentFunnel — Öğrenciler bölümü hunisi", () => {
  it("2026-09-19 ölçümü: 8 bölüm görüntülenme (4 gün) · 0 tıklama · hero 30 · ziyaret 33 → pay %27, oran 0, örneklem küçük", () => {
    const rows = [
      row("section_view", "ogrenci", "2026-09-10", 2), row("section_view", "ogrenci", "2026-09-11", 1),
      row("section_view", "ogrenci", "2026-09-17", 4), row("section_view", "ogrenci", "2026-09-18", 1),
      row("section_view", "hero", "2026-09-10", 8), row("section_view", "hero", "2026-09-17", 22),
      row("landing_view", "none", "2026-09-10", 9), row("landing_view", "none", "2026-09-17", 24),
    ];
    const f = studentFunnel(rows);
    expect(f.since).toBe(STUDENT_FUNNEL_SINCE);
    expect(f.sectionViews).toBe(8);
    expect(f.clicks).toBe(0);
    expect(f.heroViews).toBe(30);
    expect(f.landingViews).toBe(33);
    expect(f.reachShare).toBeCloseTo(8 / 30, 5);
    expect(f.clickRate).toBe(0);
    expect(f.smallSample).toBe(true);
    expect(f.days.map((x) => x.day)).toEqual(["2026-09-10", "2026-09-11", "2026-09-17", "2026-09-18"]);
    expect(f.days[2]).toEqual({ day: "2026-09-17", landingViews: 24, sectionViews: 4, clicks: 0 });
  });

  it("tıklamalar yerleşime göre ayrışır; üç yerleşim CtaLink kaynaklarıyla aynı (Students · FinalCta · Identity)", () => {
    expect([...STUDENT_CLICK_PLACEMENTS]).toEqual(["ogrenci", "final", "identity"]);
    const f = studentFunnel([
      row("section_view", "ogrenci", "2026-09-12", 40),
      row("student_click", "ogrenci", "2026-09-12", 3),
      row("student_click", "final", "2026-09-13", 1),
      row("student_click", "identity", "2026-09-13", 2),
    ]);
    expect(f.clicks).toBe(6);
    expect(f.clicksByPlacement).toEqual({ ogrenci: 3, final: 1, identity: 2 });
    expect(f.clickRate).toBeCloseTo(6 / 40, 5);
    expect(f.smallSample).toBe(false); // 40 ≥ eşik
    expect(f.days.map((x) => x.clicks)).toEqual([3, 3]);
  });

  it("başlangıç öncesi satırlar ve ilgisiz olaylar sayılmaz; veri yokken oranlar null, gün listesi boş", () => {
    const f = studentFunnel([
      row("section_view", "ogrenci", "2026-09-09", 5), // v6.262 öncesi
      row("section_view", "kongre", "2026-09-12", 9),
      row("login_click", "header", "2026-09-12", 2),
    ]);
    expect(f).toMatchObject({
      sectionViews: 0, clicks: 0, heroViews: 0, landingViews: 0, reachShare: null, clickRate: null, smallSample: true, days: [],
    });
    expect(STUDENT_FUNNEL_SINCE.toISOString()).toBe("2026-09-10T00:00:00.000Z");
    expect(STUDENT_FUNNEL_MIN_SAMPLE).toBe(30);
  });

  it("since parametresi pencereyi kaydırır (betik/panel aynı ölçüyü farklı pencereyle alabilir)", () => {
    const f = studentFunnel([row("section_view", "ogrenci", "2026-09-09", 5)], d("2026-09-01"));
    expect(f.sectionViews).toBe(5);
    expect(f.since).toEqual(d("2026-09-01"));
  });
});
