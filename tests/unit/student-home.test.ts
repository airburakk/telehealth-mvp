import { describe, it, expect } from "vitest";
import type { CalendarItem } from "@/lib/calendar";
import { STUDENT_HOME_LINKS, studentAgendaMonths, upcomingStudentAgenda, studentAgendaHref } from "@/lib/student-home";

const item = (key: string, start: string, end = start): CalendarItem => ({ key, start, end, kind: "kisisel", title: key });
describe("Student home agenda", () => {
  it("links to the four existing destinations without duplicating stored data", () => {
    expect(STUDENT_HOME_LINKS.map(link => link.href)).toEqual([
      "/doktor/doctorium/tus", "/doktor/doctorium?m=kariyer&tur=hepsi",
      "/doktor/doctorium/kaydettiklerim", "/doktor/doctorium/takvim",
    ]);
  });
  it("rolls December into the following year", () => {
    expect(studentAgendaMonths(new Date("2026-12-31T23:59:59Z"))).toEqual([{ year: 2026, month: 12 }, { year: 2027, month: 1 }]);
  });
  it("shares the calendar UTC convention at the Turkish midnight boundary", () => {
    expect(studentAgendaMonths(new Date("2026-12-01T01:00:00+03:00"))[0]).toEqual({ year: 2026, month: 11 });
  });
  it("excludes past dates, retains ongoing dates and deduplicates overlapping months", () => {
    const ongoing = item("ongoing", "2026-10-30", "2026-11-12");
    const result = upcomingStudentAgenda([item("past", "2026-11-10"), ongoing, item("future", "2026-11-14"), ongoing], "2026-11-11");
    expect(result.map(row => row.key)).toEqual(["ongoing", "future"]);
  });
  it("keeps today's deadlines, orders deterministically and caps the preview", () => {
    const result = upcomingStudentAgenda([item("b", "2026-11-11"), item("a", "2026-11-11"), item("c", "2026-11-12")], "2026-11-11", 2);
    expect(result.map(row => row.key)).toEqual(["a", "b"]);
  });
  it("handles an empty calendar without fabricated items", () => {
    expect(upcomingStudentAgenda([], "2026-11-11")).toEqual([]);
    expect(upcomingStudentAgenda([item("a", "2026-11-11")], "2026-11-11", 0)).toEqual([]);
  });
  it("opens the precise upcoming or ongoing day", () => {
    expect(studentAgendaHref(item("a", "2026-12-08"), "2026-11-11")).toBe("/doktor/doctorium/takvim?ay=2026-12&gun=2026-12-08");
    expect(studentAgendaHref(item("b", "2026-10-30", "2026-11-12"), "2026-11-11")).toBe("/doktor/doctorium/takvim?ay=2026-11&gun=2026-11-11");
  });
});
