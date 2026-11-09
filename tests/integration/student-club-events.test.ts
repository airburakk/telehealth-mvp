import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "../../src/lib/db";
import { ingestStudentClubEvents, upcomingStudentClubEvents } from "../../src/lib/student-club-store";
import type { StudentClubEvent } from "../../src/lib/student-club-events";

// Only synthetic fixtures in the explicitly configured non-production integration database.
const enabled = Boolean(process.env.TEST_DATABASE_URL) && process.env.DATABASE_URL === process.env.TEST_DATABASE_URL;
const run = `student-club-itest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const now = new Date();
const future = new Date(now.getTime() + 10 * 86400000).toISOString().slice(0, 10);
const fixture: StudentClubEvent = { id: run, title: "SYNTHETIC INTEGRATION TEST - DO NOT PUBLISH", organizer: "Test Tıp Öğrencileri Kulübü", venue: "Test Salonu", city: "Test", startDay: future, endDay: future, sourceUrl: `https://sks.ogu.edu.tr/Etkinlik/Detay/999999999/${run}`, evidenceHash: "test", checkedAt: now.toISOString(), status: "candidate" };
const report = (candidates: StudentClubEvent[] = [fixture]) => ({ checkedAt: now.toISOString(), candidates, checked: 1, rejected: 0, errors: [], complete: true, rejectedUrls: [] as string[], failedUrls: [] as string[] });
const ownRows = () => db.$queryRaw<{ title: string; status: string; checkedAt: Date }[]>`SELECT "title", "status", "checkedAt" FROM "StudentClubEvent" WHERE "id" = ${run}`;

describe.skipIf(!enabled)("student event PostgreSQL integration", () => {
  beforeAll(() => { process.env.STUDENT_CLUB_EVENTS_ENABLED = "true"; });
  afterAll(async () => {
    await db.$executeRaw`DELETE FROM "StudentClubEvent" WHERE "id" = ${run}`;
    await db.$disconnect();
  });
  it("writes the migrated table idempotently and makes fresh upcoming events readable", async () => {
    await ingestStudentClubEvents(now, vi.fn().mockResolvedValue(report()));
    await ingestStudentClubEvents(now, vi.fn().mockResolvedValue(report()));
    expect(await ownRows()).toHaveLength(1);
    expect((await upcomingStudentClubEvents(now)).some(row => row.id === run)).toBe(true);
  });
  it("serializes concurrent updates and prevents an older scan overwriting a newer one", async () => {
    const old = new Date(now.getTime() + 1000), recent = new Date(now.getTime() + 2000);
    await Promise.all([
      ingestStudentClubEvents(recent, vi.fn().mockResolvedValue(report([{ ...fixture, title: "NEWER SYNTHETIC TEST" }]))),
      ingestStudentClubEvents(old, vi.fn().mockResolvedValue(report([{ ...fixture, title: "OLDER SYNTHETIC TEST" }]))),
    ]);
    expect((await ownRows())[0].title).toBe("NEWER SYNTHETIC TEST");
  });
  it("preserves rows on source transport failure but hides expired verification", async () => {
    await ingestStudentClubEvents(new Date(now.getTime() + 3000), vi.fn().mockResolvedValue({ ...report([]), complete: false, errors: ["student-detail-unavailable"], failedUrls: [fixture.sourceUrl] }));
    expect((await ownRows())[0].status).toBe("VERIFIED");
    expect((await upcomingStudentClubEvents(new Date(now.getTime() + 37 * 3600000))).some(row => row.id === run)).toBe(false);
  });
  it("hides explicitly cancelled/unverifiable source records without deleting them", async () => {
    await ingestStudentClubEvents(new Date(now.getTime() + 4000), vi.fn().mockResolvedValue({ ...report([]), rejected: 1, rejectedUrls: [fixture.sourceUrl] }));
    expect((await ownRows())[0].status).toBe("HIDDEN");
    expect((await upcomingStudentClubEvents(new Date(now.getTime() + 5000))).some(row => row.id === run)).toBe(false);
  });
  it("filters dates at read time independently of a cron sweep", async () => {
    await db.$executeRaw`UPDATE "StudentClubEvent" SET "status" = 'VERIFIED', "endDay" = '2000-01-01', "checkedAt" = ${now} WHERE "id" = ${run}`;
    expect((await upcomingStudentClubEvents(now)).some(row => row.id === run)).toBe(false);
  });
});
