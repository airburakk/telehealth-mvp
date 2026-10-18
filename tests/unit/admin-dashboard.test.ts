import { describe, expect, it } from "vitest";
import { changePct, compositionKey, relativeShort, summarizeMembers, type DashboardMember } from "@/lib/admin-dashboard";

const HOUR = 3600_000;
const DAY = 24 * HOUR;
// 17.10.2026 09:12 TSİ
const NOW = new Date("2026-10-17T06:12:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);

let n = 0;
function member(over: Partial<DashboardMember["p"]> = {}, createdAt = ago(40 * DAY), name: string | null = "Dr. Test"): DashboardMember {
  n++;
  return {
    userId: `u${n}`,
    name,
    createdAt,
    p: {
      diplomaVerifiedAt: null, studentVerifiedAt: null, doctoriumOptOutAt: null, trialEndsAt: null,
      studentTrack: false, verified: false, activatedAt: null,
      branch: "Kardiyoloji", city: "İstanbul", studentUniversity: null,
      ...over,
    },
  };
}

describe("compositionKey — kitle çözücü + NONE ayrımı", () => {
  it("üyelikten çıkan, hiç doğrulanmamıştan AYRI dilime düşer", () => {
    expect(compositionKey(member({ doctoriumOptOutAt: ago(DAY), diplomaVerifiedAt: ago(9 * DAY) }), NOW)).toBe("OPTED_OUT");
    expect(compositionKey(member(), NOW)).toBe("UNVERIFIED");
  });
  it("öncelik doctorium-tiers ile aynı: diploma > öğrenci > deneme", () => {
    expect(compositionKey(member({ diplomaVerifiedAt: ago(DAY), trialEndsAt: new Date(NOW.getTime() + DAY) }), NOW)).toBe("VERIFIED");
    expect(compositionKey(member({ trialEndsAt: new Date(NOW.getTime() + DAY) }), NOW)).toBe("TRIAL");
    expect(compositionKey(member({ trialEndsAt: ago(DAY) }), NOW)).toBe("LOCKED");
  });
});

describe("summarizeMembers", () => {
  it("pencereler ve önceki eşit pencere — sınırlar çakışmaz", () => {
    const ms = [
      member({}, ago(2 * HOUR)), // 24 sa · 7 g · 30 g
      member({ studentTrack: true }, ago(30 * HOUR)), // önceki 24 sa · 7 g · 30 g
      member({}, ago(10 * DAY)), // önceki 7 g · 30 g
      member({}, ago(45 * DAY)), // önceki 30 g
      member({}, ago(70 * DAY)), // hiçbiri
    ];
    const s = summarizeMembers(ms, NOW);
    expect(s.windows.map((w) => [w.total, w.previous])).toEqual([[1, 1], [2, 1], [3, 1]]);
    expect(s.windows[1]).toMatchObject({ doctors: 1, students: 1 });
    expect(s.total).toBe(5);
  });

  it("günlük kovalar Türkiye takvim gününe göre: 22:30 TSİ kaydı o güne, 00:30 TSİ ertesi güne düşer", () => {
    const late = member({}, new Date("2026-10-16T19:30:00Z")); // 16.10 22:30 TSİ (UTC'de de 16'sı)
    const early = member({ studentTrack: true }, new Date("2026-10-16T21:30:00Z")); // 17.10 00:30 TSİ (UTC'de hâlâ 16'sı!)
    const s = summarizeMembers([late, early], NOW);
    expect(s.daily).toHaveLength(30);
    expect(s.daily.at(-1)).toEqual({ day: "2026-10-17", doctors: 0, students: 1 });
    expect(s.daily.at(-2)).toEqual({ day: "2026-10-16", doctors: 1, students: 0 });
    expect(s.daily[0].day).toBe("2026-09-18");
  });

  it("eksenler bağımsız: admin onaylı sayısı diploma sayısından büyük olabilir (huni değil)", () => {
    const s = summarizeMembers([member({ verified: true }), member({ verified: true, diplomaVerifiedAt: ago(DAY) }), member({ studentTrack: true })], NOW);
    expect(s.axes.find((a) => a.label === "Diploması doğrulanmış")).toMatchObject({ value: 1, base: 2 });
    expect(s.axes.find((a) => a.label === "Admin onaylı")).toMatchObject({ value: 2, base: 2 });
    expect(s.axes.find((a) => a.label.startsWith("Öğrenci"))).toMatchObject({ value: 0, base: 1 });
  });

  it("bekleyenler: en acil önde, sayılar sınırsız; doğrulanmış/çıkmış girmez", () => {
    const ms = [
      member({ trialEndsAt: new Date(NOW.getTime() + 20 * DAY) }, ago(10 * DAY), "Uzun"),
      member({ trialEndsAt: new Date(NOW.getTime() + 2 * DAY) }, ago(28 * DAY), "Kısa"),
      member({ studentTrack: true }, ago(5 * DAY), "Öğr"),
      member({ trialEndsAt: ago(80 * DAY) }, ago(110 * DAY), "Kilit"),
      member({ diplomaVerifiedAt: ago(DAY) }),
      member({ doctoriumOptOutAt: ago(DAY), studentTrack: true }),
    ];
    const s = summarizeMembers(ms, NOW, { waitingLimit: 3 });
    expect(s.waiting).toMatchObject({ trial: 2, locked: 1, studentEmail: 1 });
    expect(s.waiting.rows.map((r) => r.name)).toEqual(["Öğr", "Kısa", "Kilit"]);
    expect(s.waiting.rows[2].detail).toBe("Deneme doldu · imhaya 10 gün");
  });

  it("son katılanlar en yeni önde; öğrencide üniversite, doktorda branş; adsız güvenli", () => {
    const s = summarizeMembers([
      member({}, ago(5 * DAY)),
      member({ studentTrack: true, studentUniversity: "Hacettepe", city: "Ankara" }, ago(HOUR), "  "),
    ], NOW);
    expect(s.recent[0]).toMatchObject({ name: "Adsız üye", student: true, where: "Hacettepe · Ankara" });
    expect(s.recent[1].where).toBe("Kardiyoloji · İstanbul");
  });

  it("bileşimde sıfır dilim yok, sıra sabit", () => {
    const s = summarizeMembers([member({ trialEndsAt: new Date(NOW.getTime() + DAY) }), member({ diplomaVerifiedAt: ago(DAY) })], NOW);
    expect(s.composition).toEqual([{ key: "VERIFIED", value: 1 }, { key: "TRIAL", value: 1 }]);
  });
});

describe("yardımcılar", () => {
  it("changePct: önceki 0 → null (sonsuz yüzde gösterilmez)", () => {
    expect(changePct(5, 0)).toBeNull();
    expect(changePct(12, 10)).toBe(20);
    expect(changePct(5, 10)).toBe(-50);
  });
  it("relativeShort", () => {
    expect(relativeShort(ago(30_000), NOW)).toBe("1 dk");
    expect(relativeShort(ago(5 * HOUR), NOW)).toBe("5 sa");
    expect(relativeShort(ago(3 * DAY + HOUR), NOW)).toBe("3 gün");
  });
});
