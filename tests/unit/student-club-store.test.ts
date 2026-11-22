import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ query: vi.fn(), execute: vi.fn(), transaction: vi.fn() }));
vi.mock("../../src/lib/db", () => ({ db: { $queryRaw: mock.query, $transaction: mock.transaction } }));
import { ingestStudentClubEvents, upcomingStudentClubEvents, STUDENT_EVENT_FRESHNESS_MS } from "../../src/lib/student-club-store";
import { parseStudentClubEvent, type scanStudentClubEvents } from "../../src/lib/student-club-events";
const now = new Date("2026-11-09T12:00:00Z");
const empty = { checkedAt: now.toISOString(), candidates: [], checked: 1, rejected: 0, errors: [], complete: true, rejectedUrls: [], failedUrls: [] };
beforeEach(() => {
  vi.resetAllMocks(); process.env.STUDENT_CLUB_EVENTS_ENABLED = "true";
  mock.query.mockResolvedValue([]); mock.execute.mockResolvedValue(1);
  mock.transaction.mockImplementation(async fn => fn({ $executeRaw: mock.execute }));
});
describe("student event persistence safety", () => {
  it("disabled feature does not access the database", async () => {
    delete process.env.STUDENT_CLUB_EVENTS_ENABLED;
    expect(await upcomingStudentClubEvents(now)).toEqual([]);
    expect(await ingestStudentClubEvents(now)).toEqual({ skipped: "disabled" });
    expect(mock.query).not.toHaveBeenCalled(); expect(mock.transaction).not.toHaveBeenCalled();
  });
  it("read query enforces verified, fresh and unexpired records", async () => {
    await upcomingStudentClubEvents(now);
    const call = mock.query.mock.calls[0]; const sql = call[0].join("?");
    expect(sql).toContain("'VERIFIED'"); expect(sql).toContain('"endDay" >='); expect(sql).toContain('"checkedAt" <=');
    expect(call).toContainEqual(new Date(now.getTime() - STUDENT_EVENT_FRESHNESS_MS));
  });
  it("transport failure never deletes or changes previous rows", async () => {
    const scan = vi.fn().mockResolvedValue({ ...empty, complete: false, errors: ["student-detail-unavailable"], failedUrls: ["https://sks.ogu.edu.tr/Etkinlik/Detay/1/a"] });
    await ingestStudentClubEvents(now, scan);
    expect(mock.execute).toHaveBeenCalledTimes(1); // lock only
    expect(mock.execute.mock.calls[0][0].join("?")).toContain("pg_advisory_xact_lock");
  });
  it("explicit rejection hides only its own URL, without overwriting a newer run", async () => {
    const url = "https://sks.ogu.edu.tr/Etkinlik/Detay/1/a";
    await ingestStudentClubEvents(now, vi.fn().mockResolvedValue({ ...empty, rejected: 1, rejectedUrls: [url] }));
    const call = mock.execute.mock.calls[1];
    expect(call[0].join("?")).toContain("'HIDDEN'"); expect(call[0].join("?")).toContain('"checkedAt" <='); expect(call).toContain(url);
  });
  it("uses an idempotent upsert and parameterized public source fields", async () => {
    const event = parseStudentClubEvent("Etkinliği Düzenleyen: Tıp Öğrencileri Kulübü Başlangıç-Bitiş Tarihi: 12 Aralık 2026 Etkinlik Adı: Kulüp Konseri Tür: Diğer Yer: Üniversite Salonu Son Güncelleme Tarihi: 9.11.2026", "https://sks.ogu.edu.tr/Etkinlik/Detay/1/a", now)!;
    expect(event).not.toBeNull();
    await ingestStudentClubEvents(now, vi.fn().mockResolvedValue({ ...empty, candidates: [event] }) as typeof scanStudentClubEvents);
    const call = mock.execute.mock.calls[1]; const sql = call[0].join("?");
    expect(sql).toContain('ON CONFLICT ("sourceUrl")'); expect(sql).not.toContain(event.title); expect(call).toContain(event.title);
    expect(sql).toContain('WHERE "StudentClubEvent"."checkedAt" <= EXCLUDED."checkedAt"');
  });
});
