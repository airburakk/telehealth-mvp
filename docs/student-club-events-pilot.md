# Student club event feed: staged implementation

## Scope

Official-source pilot for medical student clubs. The first supported source is ESOGÜ SKS: https://sks.ogu.edu.tr/Etkinlik/Index . No student profile, email, phone, cookies, credentials, clinical record, subscription or outbound message is read or written. No social-media publishing is involved.

## Implementation

- `student-club-events.ts`: bounded official same-origin discovery, strict name/date/venue/medical-student organizer parser, Turkish entity/date handling, past/cancelled/unsupported-data rejection, stable URL identity and event deduplication. Every returned candidate carries source URL, checked time and evidence hash. No inferred dates or fabricated events.
- `student-club-store.ts`: atomic source-verified event upserts, advisory-lock serialization, newer-run protection, explicit rejection hiding, no deletion on transport failure. Queries hide expired records and any verification older than 36 hours. Display also deduplicates equivalent events across URLs.
- New additive `StudentClubEvent` table only. No existing table altered or dropped. All SQL is tagged/parameterized. No database migration has been executed in production or development yet.
- `/api/cron/ingest-student-clubs`: existing `cronGate` authentication and AURA-only shared-DB behavior, aggregate audit and failure alert, 120-second budget. Partial scans return 503 with counts; valid source-verified records can still be updated. No raw personal content in audit.
- Daily schedule is **02:37 UTC / 05:37 Turkey**, consistent between vercel.json and CRON_SCHEDULES and before downstream translation/summary timing. Registration is code-only until deployed.
- Student-only `Kampüsten etkinlikler` section inside the existing Etkinlik shelf, with official source links, organizer, venue, date, last-check time and explicit first-source scope. No registration or free-entry claim. Empty/error states are honest. Existing professional congresses remain untouched.
- Feature is **OFF by default**, gated with `STUDENT_CLUB_EVENTS_ENABLED=true`; until enabled the cron does not query/write the table and UI adds no section.

## Verification

Focused parser/store/cron-contract tests: 24 passed. Focused ESLint passed. TypeScript noEmit passed before final deduplication refactor; final aggregate results should be consulted in the handoff. Prisma schema validation passed with dummy localhost URL, no database connection. Live read checked 16 detail pages and yielded 2 future source-verified candidates, rejected 13, and reported 1 source-read failure as partial. Examples: European Medical Students Club half-year assembly, 12 December 2026; TEDx Osmangazi University, 8 May 2027. No events were inserted or published during research.

## Controlled rollout (not yet performed)

1. Review code and final checks. Apply this additive migration to a dedicated development database first. Do not reuse production credentials for tests.
2. Verify real PostgreSQL idempotent upserts, concurrent runs, source updates, cancellation hiding and expiry, plus authenticated Student page rendering and unrelated doctor-role regression.
3. Coordinate with family-page and weekly-publication changes. This work does not modify prepare-events.ts, prepare-students.ts or social publishing approval gates.
4. Apply the additive migration before enabling the feature. Normal deployment build regenerates Prisma. Keep the feature OFF on failures; no destructive rollback is required because only a new table exists.
5. Enable the flag on the AURA ingestion project and Doctorium display project, deploy the reviewed commit, trigger the guarded cron and inspect aggregate audit. Test Student screen on mobile/desktop, empty/loading/error state and external links. Production rollout requires the parent's deploy coordination.
6. Check the first scheduled run and freshness. Turn the flag off to hide/pause immediately if there is a source/parser/DB problem. Keep the new table; do not drop data as rollback.

## Explicit limitations

One supported official source, no claim of nationwide coverage. Currently only single-day explicit dates; ambiguous/multi-day formats are rejected. Source availability can produce partial scans, and listing capacity is bounded at 20 detail reads per run, with 10 known future records rechecked first. No editor dashboard is needed for automatically source-verified facts, but broader sources or extraction formats require tested adapters before activation. Human curators should review corrections. Upstream may change without notice; 36-hour freshness is a maximum, not a guarantee against changes between checks.

Candidate research sources for later tested adapters: https://www.turkmsic.org/ and https://kulup.sbu.edu.tr/Home/KTakvim . No current adapter or coverage claim for these.
