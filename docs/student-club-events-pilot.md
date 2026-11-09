# Student club event discovery: verified pilot, not a live feed

Run `npx tsx scripts/scan-student-club-events.ts` from this checkout. It only reads public pages and prints a JSON report. It does not read a database, student profile, email, phone number, cookies or authentication tokens. It never posts, sends, approves or publishes anything.

## Implemented

- Official source: https://sks.ogu.edu.tr/Etkinlik/Index (ESOGU university SKS).
- Discover same-origin event details, maximum 20 bounded HTTPS reads. Reuses the existing DNS-pinned public-only reader with size/time limits and no redirects.
- Require medical student club organizer, explicit valid date, event title and venue. No language model infers facts.
- Reject past dates in Europe/Istanbul, cancellation/postponement in event fields, missing fields, unrelated clubs, malformed and currently unsupported multi-day dates.
- Canonical URL identity plus within-run event deduplication. Output contains source link, verification time and evidence hash.
- Failures are stable reason codes; partial scans explicitly report `complete: false`. They must NEVER be treated as a deletion instruction for existing records.
- Output status is always `candidate`; parsing is not editor approval or proof the organizer has not made a last-minute change.

## Verified 9 November 2026

10 focused Vitest tests pass and focused ESLint passes. Live read: 16 details checked, 2 future candidates, 13 rejected, 1 detail fetch failed (partial result). Two successfully parsed examples: European Medical Students Club half-year general assembly (12 December 2026), TEDx Osmangazi University (8 May 2027). No records inserted or published. This source's dates do not establish event eligibility, admission price, public attendance or registration status.

## Remaining before activation

1. Add a dedicated StudentClubEvent store with source identity unique key, checkedAt, state (candidate/approved/withdrawn), reviewer and expiration. Do not overload professional MedicalCongress defaults (congress/accreditation) or the existing TÜBİTAK social publishing flow.
2. Add an editor review surface. Require current source review and preserve approvals only while the content/evidence hash remains unchanged. Changed, cancelled or missing details must hide the affected item until reviewed. An infrastructure failure must not delete events, but stale verification must not stay publicly visible indefinitely.
3. Add a student-only view with approved-only query, Istanbul end-date filtering at read time, source/check-time disclosure and a report-correction link. No calendar invitations, email subscription or sponsor advertising as a side effect.
4. Add a guarded cron route using existing cronGate/audit/alerts and a transaction/advisory lock. Update vercel.json and CRON_SCHEDULES together; confirm only AURA's shared-DB ingestion deploy runs it. Use total request budget below route maxDuration.
5. Test persistence/idempotency, overlapping scans, stale source updates, date expiry, cancellation withdrawal, empty and partial scans, access controls and actual Student UI. Run aggregate checks against the integration branch before deployment.
6. Broaden sources using source-specific tested adapters, not broad-domain scraping or search-snippet publication. Candidate research sources: https://www.turkmsic.org/ and https://kulup.sbu.edu.tr/Home/KTakvim . No adapters or claims of coverage for these yet.

The scanner is deliberately a reviewable pilot. No daily schedule, production deployment or completed student product is claimed.
