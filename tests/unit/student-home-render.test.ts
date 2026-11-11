import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mocks = vi.hoisted(() => ({ audience: vi.fn(), calendar: vi.fn(), enabled: vi.fn(), clubs: vi.fn() }));
vi.mock("@/lib/doctorium-audience", () => ({ currentDoctoriumAudience: mocks.audience }));
vi.mock("@/lib/calendar", () => ({ doctorCalendarMonth: mocks.calendar, CAL_KIND_LABEL: { tus: "TUS", kisisel: "Kişisel" } }));
vi.mock("@/lib/student-club-store", () => ({ studentClubEventsEnabled: mocks.enabled, upcomingStudentClubEvents: mocks.clubs }));
import { StudentHome } from "@/app/doktor/doctorium/StudentHome";
import { StudentClubEvents } from "@/app/doktor/doctorium/StudentClubEvents";

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-11T09:00:00Z"));
  mocks.audience.mockResolvedValue({ audience: "STUDENT", doctorId: "own-student-id" });
  mocks.calendar.mockResolvedValue([]);
  mocks.enabled.mockReturnValue(true);
  mocks.clubs.mockResolvedValue([]);
});
afterEach(() => vi.useRealTimers());

describe("Student home server rendering", () => {
  it.each([null, { audience: "DOCTOR", doctorId: "doctor" }, { audience: "STUDENT", doctorId: null }])("protects the student surface independently: %j", async ctx => {
    mocks.audience.mockResolvedValue(ctx);
    expect(await StudentHome()).toBeNull();
    expect(mocks.calendar).not.toHaveBeenCalled();
  });
  it("queries only the authenticated student's calendar and includes existing TUS/EDU dates", async () => {
    const html = renderToStaticMarkup(await StudentHome());
    expect(mocks.calendar.mock.calls).toEqual([
      ["own-student-id", 2026, 11, { includeTus: true, includeEdu: true }],
      ["own-student-id", 2026, 12, { includeTus: true, includeEdu: true }],
    ]);
    expect(html).toContain("Öğrenci masan");
    expect(html).toContain("Kaydettiklerim");
    expect(html).toContain("kayıtlı yaklaşan tarih yok");
    expect(html).not.toContain("Aile Hekimliği");
  });
  it("renders real dates once with exact calendar navigation and escapes titles", async () => {
    mocks.calendar.mockResolvedValue([{ key: "t1", kind: "tus", title: "<unsafe> source title", start: "2026-11-14", end: "2026-11-14" }]);
    const html = renderToStaticMarkup(await StudentHome());
    expect(html).toContain("&lt;unsafe&gt;");
    expect(html).toContain("ay=2026-11&amp;gun=2026-11-14");
    expect(html.match(/&lt;unsafe&gt;/g)).toHaveLength(1);
  });
  it("does not disguise a database failure as an empty calendar", async () => {
    mocks.calendar.mockRejectedValue(new Error("test database unavailable"));
    const html = renderToStaticMarkup(await StudentHome());
    expect(html).toContain('role="status"');
    expect(html).toContain("şu anda yüklenemiyor");
    expect(html).not.toContain("kayıtlı yaklaşan tarih yok");
  });
});

describe("Student club home preview", () => {
  it("does not query the database while the rollout flag is disabled", async () => {
    mocks.enabled.mockReturnValue(false);
    expect(await StudentClubEvents({ limit: 3 })).toBeNull();
    expect(mocks.audience).not.toHaveBeenCalled();
    expect(mocks.clubs).not.toHaveBeenCalled();
  });
  it("does not expose student-only events to another audience", async () => {
    mocks.audience.mockResolvedValue({ audience: "DOCTOR", doctorId: "doctor" });
    expect(await StudentClubEvents()).toBeNull();
    expect(mocks.clubs).not.toHaveBeenCalled();
  });
  it("limits the home preview and retains the full event listing", async () => {
    mocks.clubs.mockResolvedValue(Array.from({ length: 4 }, (_, i) => ({
      id: String(i), title: "Club event " + i, sourceUrl: "https://sks.ogu.edu.tr/Etkinlik/Detay/" + i,
      startDay: "2026-11-20", city: "Eskişehir", organizer: "Medical club", venue: "Hall", checkedAt: new Date(),
    })));
    const preview = renderToStaticMarkup(await StudentClubEvents({ limit: 3 }));
    expect(preview).toContain("Club event 2");
    expect(preview).not.toContain("Club event 3");
    expect(preview).toContain("/doktor/doctorium?m=etkinlik");
    expect(preview).toContain('rel="noopener noreferrer"');
    const full = renderToStaticMarkup(await StudentClubEvents());
    expect(full).toContain("Club event 3");
  });
});
