import { db } from "./db";
import { todayIsoTr } from "./iso-day";
import { scanStudentClubEvents, studentEventIdentity, type StudentClubEvent } from "./student-club-events";

export const STUDENT_EVENT_FRESHNESS_MS = 36 * 60 * 60 * 1000;
export function studentClubEventsEnabled() { return process.env.STUDENT_CLUB_EVENTS_ENABLED === "true"; }
export type StoredStudentClubEvent = Omit<StudentClubEvent, "checkedAt" | "status"> & { checkedAt: Date; status: string };

// Tagged, parameterized SQL avoids changing the shared development Prisma client during parallel work.
// Prisma schema/migration is included; normal deploy builds still regenerate the client.
export async function upcomingStudentClubEvents(now = new Date()): Promise<StoredStudentClubEvent[]> {
  if (!studentClubEventsEnabled()) return [];
  const fresh = new Date(now.getTime() - STUDENT_EVENT_FRESHNESS_MS);
  const rows = await db.$queryRaw<StoredStudentClubEvent[]>`
    SELECT * FROM "StudentClubEvent" WHERE "status" = 'VERIFIED'
    AND "endDay" >= ${todayIsoTr(now)} AND "checkedAt" >= ${fresh} AND "checkedAt" <= ${now}
    ORDER BY "startDay", "id" LIMIT 60`;
  return [...new Map(rows.map(event => [studentEventIdentity(event), event])).values()].slice(0, 30);
}

export async function ingestStudentClubEvents(now = new Date(), scan = scanStudentClubEvents) {
  if (!studentClubEventsEnabled()) return { skipped: "disabled" };
  const known = await db.$queryRaw<{ sourceUrl: string }[]>`
    SELECT "sourceUrl" FROM "StudentClubEvent" WHERE "endDay" >= ${todayIsoTr(now)}
    ORDER BY "checkedAt", "id" LIMIT 10`;
  const report = await scan(now, undefined, known.map(e => e.sourceUrl));
  await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${0x5354}::int4, ${1}::int4)`;
    for (const e of report.candidates) {
      await tx.$executeRaw`
        INSERT INTO "StudentClubEvent" ("id", "sourceUrl", "title", "organizer", "venue", "city", "startDay", "endDay", "evidenceHash", "status", "checkedAt", "updatedAt")
        VALUES (${e.id}, ${e.sourceUrl}, ${e.title}, ${e.organizer}, ${e.venue}, ${e.city}, ${e.startDay}, ${e.endDay}, ${e.evidenceHash}, 'VERIFIED', ${now}, ${now})
        ON CONFLICT ("sourceUrl") DO UPDATE SET "title" = EXCLUDED."title", "organizer" = EXCLUDED."organizer",
        "venue" = EXCLUDED."venue", "city" = EXCLUDED."city", "startDay" = EXCLUDED."startDay", "endDay" = EXCLUDED."endDay",
        "evidenceHash" = EXCLUDED."evidenceHash", "status" = 'VERIFIED', "checkedAt" = EXCLUDED."checkedAt", "updatedAt" = EXCLUDED."updatedAt"
        WHERE "StudentClubEvent"."checkedAt" <= EXCLUDED."checkedAt"`;
    }
    // An explicit failed verification hides that exact record. Transport failures never become deletions.
    for (const url of report.rejectedUrls) {
      await tx.$executeRaw`UPDATE "StudentClubEvent" SET "status" = 'HIDDEN', "checkedAt" = ${now}, "updatedAt" = ${now}
        WHERE "sourceUrl" = ${url} AND "checkedAt" <= ${now}`;
    }
  }, { timeout: 15000 });
  return { checked: report.checked, verified: report.candidates.length, rejected: report.rejected, complete: report.complete, errors: report.errors };
}

