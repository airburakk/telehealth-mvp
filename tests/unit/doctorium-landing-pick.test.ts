// Landing kart seçim yardımcıları — v6.262 (2026-09-10): kongre kanıtında "açık son günlü etkinlik önce" kuralı.
// Neden: landing örneği "Bildiri süresi doldu · Erken kayıt sona erdi" satırlarıyla açılıyordu (👤 küçük paket).
import { describe, it, expect } from "vitest";
import { openDeadlineFirst } from "@/lib/doctorium-landing/pick";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("openDeadlineFirst (landing kongre örneği)", () => {
  const now = d("2026-09-10");
  const rows = [
    { id: "a", startDate: d("2026-09-11"), abstractDeadline: d("2026-07-13"), earlyBirdDeadline: d("2026-06-15") }, // ikisi de geçti
    { id: "b", startDate: d("2026-11-05"), abstractDeadline: d("2026-09-30"), earlyBirdDeadline: null },            // bildiri açık
    { id: "c", startDate: d("2026-10-01"), abstractDeadline: null, earlyBirdDeadline: d("2026-09-10") },            // erken kayıt bugün
    { id: "d", startDate: d("2026-09-20"), abstractDeadline: null, earlyBirdDeadline: null },                       // tarih yok
  ];

  it("açık son günlüler öne (başlangıç tarihine göre); kalanlar arkada aynı kuralla — kararlı", () => {
    expect(openDeadlineFirst(rows, now).map((r) => r.id)).toEqual(["c", "b", "a", "d"]);
  });

  it("son gün, günün sonuna kadar açık sayılır (CongressList Deadline kuralıyla aynı: at + 24 saat > now)", () => {
    const lastMs = new Date(d("2026-09-10").getTime() + 86_400_000 - 1);
    expect(openDeadlineFirst(rows, lastMs).map((r) => r.id)[0]).toBe("c");
    expect(openDeadlineFirst(rows, d("2026-09-11")).map((r) => r.id)).toEqual(["b", "a", "d", "c"]);
  });

  it("girdiyi değiştirmez", () => {
    const before = rows.map((r) => r.id);
    openDeadlineFirst(rows, now);
    expect(rows.map((r) => r.id)).toEqual(before);
  });
});
