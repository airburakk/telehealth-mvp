# Durable Buffer queue lifecycle and all-platform review

Implemented on PR48 only. No production schema, credential, n8n activation,
provider request, enqueue, cancellation or social post was performed.

The dormant renderer-to-DRAFT worker, existing archive dependency and official
Buffer read/delete contract adapter are documented in
[doctorium-draft-producer.md](doctorium-draft-producer.md). Their presence does
not enable live provider reads/cancellations or weekly preparation.

## Queue acceptance versus public publication

Additive migration `20261018060000_weekly_provider_queue` stores provider/queue ID,
provider dueAt, accepted/observed/cancellation timestamps, actual public URL/time,
per-channel enqueue time and additional-queue risk. Queue IDs are unique per
provider. The existing item/channel uniqueness still prevents duplicate uploads.

| State | Meaning |
|---|---|
| CLAIMED | One upload/enqueue attempt reserved; not publication |
| QUEUED | Buffer accepted a known queue ID and matching reviewed dueAt |
| PUBLICATION_UNKNOWN | Known queue, actual publication not confirmed; no reupload |
| CANCEL_PENDING | Revoked or mismatched queue needs confirmed remote unsend |
| CANCEL_UNKNOWN | Acceptance/cancellation uncertain; human verification required |
| CANCELLED | Local unattempted job stopped, or remote absence/cancellation explicitly verified |
| SUCCEEDED | Actual public platform ID, platform URL and publication time recorded |
| PUBLISHED_RISK | Actual publication observed after revocation/cancellation, or early/unapproved timing |

Early enqueue is separately approved per channel in `enqueueTimes`; public times
are `publishTimes`, falling back to the existing scheduledAt. An early YouTube
enqueue cannot accidentally authorize an early Facebook/X/Instagram upload. The
enqueue window is 15 minutes, at most 24 hours before its reviewed public time.
A twelve-hour accepted queue does not expire as a twenty-minute lost claim.

Revocation cancels untouched local jobs and moves known queues to CANCEL_PENDING;
claimed/uncertain jobs become CANCEL_UNKNOWN. The content-edit PostgreSQL trigger
performs this invalidation atomically too. Local revocation does not claim remote
cancellation. The admin page keeps queue ID, dueAt, cancellation state and a remote
risk warning visible. Queued jobs from revoked packages remain in the recovery feed.

An acknowledgement arriving after revocation still records its remote ID and
requires cancellation. A conflicting second queue ID is retained in event history,
sets additionalQueueRisk and cannot be cleared by confirming only the first ID.
Human clearance requires explicit all-remote-jobs confirmation and evidence.

## Machine observations: no invented provider API

The existing CONTENT_PLAN_TOKEN surface adds:

- `queued`: id, attempt claimToken, providerQueueId, dueAt; records acceptance only.
- `queue-tasks`: week; read recovery jobs including revoked packages, without tokens.
- `queue-observation`: id, matching providerQueueId, observation and observedAt.
  QUEUED also requires the actual observed dueAt; a changed remote schedule
  becomes CANCEL_PENDING. PUBLISHED requires platformId, publishedUrl and publishedAt.

These are internal recording contracts, not Buffer API methods. No provider SDK
or read/delete endpoint is invented or called. Definitive machine CANCELLED or
PUBLISHED observations return 503 unless WEEKLY_REMOTE_OBSERVER_VERIFIED=true;
that flag remains unset until a supported observer contract/account access is
verified and separately approved. UNKNOWN observations remain recordable, even
after disabling new claims. Existing publish activation remains independently off.

The direct result endpoint cannot turn a known scheduled queue into success;
queued publication must use the observation path or an ADMIN platform check.
A queue ID/Buffer URL, future scheduled timestamp, stale observation or wrong
public platform link is insufficient. URL/time validation is not an assertion of
an independent network fetch. Actual public observations must come from the
verified adapter or human inspection. Raw provider responses/tokens are not stored.

If cancellation/confirmation capabilities are unavailable, record UNKNOWN and use
human reconciliation. Public NOT_FOUND does not establish that no scheduled job
remains, and cannot reset a queued job. NO_REMOTE_JOB requires explicit all-job
confirmation, queue ID match where known and a written platform/queue check.
It is terminal and does not authorize a fresh upload. Uncertain attempts cannot
be downgraded to safe-to-retry failure by a later noRequestSent assertion.

Late public evidence after cancellation/revocation is retained as PUBLISHED_RISK,
not silently discarded or relabelled normal success. Provider unscheduling does
not delete an already public post; no delete-publication operation is implemented.

## One original video, all five platforms

The user requested prepared original videos and other content across Doctorium
Instagram/Facebook/X/LinkedIn/YouTube. The existing five-channel requirement is
retained. `mediaKind:video` additionally requires MP4 in **every** channel with
sourceMasterHash matching the reviewed masterVideoHash; post.json and all final
bytes, accounts, per-channel times and enqueue times are sealed together. Missing
one adaptation fails review instead of silently skipping that platform.

`infra/kart/lib/video-adaptations.mjs` is a draft-only helper around the existing
ffmpeg runner. It reuses the existing master for IG/FB/X/YouTube and prefers the
existing native LinkedIn output. If that is unavailable it can retain the full
portrait foreground on a blurred 16:9 background; actual readability still needs
review. No automatic foreground cropping, caption truncation, account selection,
new API credentials or disclosure default is introduced. Five prepared public
post objects are required, with an explicit YouTube AI-disclosure decision.
The helper writes only local DRAFT artifacts and never invokes a live producer,
sender, daily duplicate guard or upload API. Existing daily Reel-A paths remain
untouched. The original card-to-Short path remains available for other content.

Final codec/duration/dimensions/provider acceptance must be checked on real
renderer outputs before integration. Command/signature tests with a fake encoder
are not real video encoding or provider validation. The all-platform data model
does not imply credentials/accounts are independently verified.

## Runnable no-post dry-run and checks

`npx tsx scripts/weekly-queue-dry-run.ts ../weekly-queue-preview`

This emits a labelled JSON/HTML state preview and asserts acceptance, twelve-hour
queue retention, revoke/unknown cancellation and late-publication risk using
fixtures. It imports no DB/provider/client/network code and cannot enqueue/post.
It is not a live n8n or actual MP4 preview. Real TEST_DATABASE_URL integration
tests separately cover service persistence, late acknowledgements, multiple IDs,
revocation, confirmed cancellation and publication evidence. No test falls back
to a production DB. Existing daily workflows remain separate pending a reviewed
adapter diff and safe test-copy validation.

Rollback: stop new weekly claims first, retain queued/risk rows and callbacks,
reconcile remote jobs before restoring routing, and keep schema/evidence. Never
reset queue IDs/successes or daily static-data guards to force a replay.
