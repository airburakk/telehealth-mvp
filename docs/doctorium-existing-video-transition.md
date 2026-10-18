# Reuse existing video workflows: proposed transition, not activation

Read-only observations supplied by the parent browser worker. No workflow was
executed, saved, published, activated or disabled. No production deployment or
migration occurred. Raw exports/credentials are excluded from this repository.

## Verified existing production/distribution paths

| Target | Observed behavior | Limits of this evidence |
|---|---|---|
| Morning Bulletin TnY74Tf0YUtMXxyR | Daily 07:45 Europe/Istanbul, PNG to X/Facebook and Buffer LinkedIn | Its lack of video/Instagram nodes says nothing about other workflows |
| Shared producer GpyxcDVqHyVWRIU9 | ACIK, daily 07:55 Europe/Istanbul; POST kart:3000/sosyal/uret, poll /sosyal/durum, MP4 validation/download/archive, Instagram stories + Reel; account 17841434415718005 | Includes actual distribution steps; running it is not a harmless render-only preview |
| YouTube 3kCzKihFevRnFgoI | Daily 08:30; takes reels-a-YYYY-MM-DD.mp4, Buffer channel 6ac643bc6a5c39ccb6402870; customScheduled 20:30, public Short, category 27; yayinModu=ACIK | Exact external YouTube channel identity/scopes and successful published results still need independent confirmation |

The producer has preflight/quota checks and a static-data daily duplicate guard.
The YouTube sender uses youtubeShortsGunu daily duplicate state. Inventory also
shows Published LinkedIn video (Buffer), X video (Reel A), Facebook Reels (Reel A)
and Instagram Günlük Kart (feed). Reuse these adapters after inspecting their
actual node contracts; Published labels alone are not end-to-end success evidence.

The media backend therefore already exists. The new offline preview helper is
only a review utility using the existing ffmpeg runner, not a new live video
pipeline. Prefer extending the existing rubric/card renderer with readable timing,
subtitles and optional reviewed narration over building a second backend.

### Existing service contracts observed in the UI

| Request | Observed contract and safe handling |
|---|---|
| GET http://kart:3000/bulten.png | Binary PNG; existing request timeout 90 seconds |
| POST http://kart:3000/sosyal/uret | No explicit body in the existing node. 202/409 mean waiting/busy with gun/durum, not permission to force a second job. 200 bos_gun=true means skip; 200 durum=hazir means prepared, not published. |
| GET http://kart:3000/sosyal/durum | durum, gun, dosyalar, kapsam; optional hata/adim/asama/gecen_sn. The requested Turkey day must match gun. Existing polling interval 15 seconds, total budget about 15 minutes. |
| GET http://kart:3000/sosyal/dosya/{gun}/{ad} | Existing archived MP4 download. Validate day, safe filename, actual MP4 bytes and expected asset hash; do not infer valid video from URL extension alone. |

`dosyalar` entries contain ad, tur, sira and boyut. `kapsam` contains akislar,
ogeSayisi and yedekSayisi. Preserve that established schema and MP4-only contract;
do not add weekly PNG/SRT/JSON files to the daily download list. The old producer
request does not accept an observed weekly payload/body: reuse its implementation
in a separately scoped draft render job rather than pretending that endpoint is
already a generic weekly renderer. Do not expose internal service endpoints or
invent new credentials to reach them.

The observed YouTube Buffer createPost request uses customScheduled dueAt, video
asset, title, category 27, public visibility, madeForKids=false,
notifySubscribers=true and isAiGenerated=false. These are the existing daily
request's values, not automatically approved defaults for every weekly video.
Keep title, audience/visibility, notification, schedule and disclosure choices in
the exact reviewed post.json. If realistic generated/altered AI scenes are later
introduced, assess the disclosure choice against current provider requirements
and include the resulting flag in human review; do not blindly copy false.
No AI scenes or paid generation were created by this change.

The YouTube daily marker youtubeShortsGunu is written after a Buffer post ID and
force can bypass it. This is not an atomic durable delivery ledger and a Buffer
ID does not prove public publication. Preserve it for the existing daily path,
but never use force or reset that marker to push an approved weekly item through.

## Proposed first stage: preserve daily, add reviewed weekly content

This is a proposal for an explicit transition decision, not permission to toggle
anything. Keep all existing daily schedules, credentials, static-data guards and
daily publishing behavior unchanged in the first stage:

- 07:45 Morning Bulletin image distribution.
- 07:55 daily video production/archive and current Instagram distribution.
- 08:30 daily YouTube enqueue for 20:30 publication.
- Existing daily LinkedIn/X/Facebook video and Instagram feed senders.

The weekly package contains additional reviewed rubric content, not replacements
for whatever dynamic daily news is selected. Reuse the existing sender adapters
with an explicit WEEKLY context, exact account binding and a server-side delivery
claim. Do not duplicate credentials or create a parallel publisher.

Concrete sender shape to review: retain the existing YouTube daily input and
guard, add an approval-checked weekly input, and converge both on its existing
Buffer media/createPost adapter. DAILY keeps its current asset/schedule and
youtubeShortsGunu behavior; WEEKLY uses the sealed package asset/time/account and
durable delivery/provider-queue state. The weekly input must never fall through
to a daily file/date fallback. Prove this routing in an inactive test copy before
any approved change to the existing published sender. Apply the same principle
to the inspected IG/LinkedIn/X/Facebook adapters rather than recreating their APIs.

Current weekly calendar suggestions are Monday/Wednesday/Friday 12:00 Turkey time;
these are not approved live schedules. Review actual dates/account IDs/times and
platform capacity together in the package. Do not infer approval to move or remove
the existing 20:30 daily YouTube post. If the desired outcome is instead to replace
daily videos with weekly-approved Shorts, list each affected workflow/schedule
and obtain that explicit content-policy/transition decision first; an additional
weekly slot and replacement of a daily slot are different effects.

## Isolation requirements before connecting senders

1. Preserve daily asset keys such as reels-a-YYYY-MM-DD.mp4. Weekly render/archive
   paths must use a package/content hash and item ID in a separate namespace. Do
   not overwrite daily media, its status response, completion marker or archive.
2. Never invoke the shared producer workflow as a review operation: it contains
   Instagram publishing and changes daily duplicate state. Reuse its existing
   renderer/validation/archive functions through a draft-only path that cannot
   reach publishing nodes. Do not feed weekly payloads into the current-day
   /sosyal/uret contract and assume it accepts that different source model.
3. Keep existing preflight, quota and MP4 checks. Produce/upload the exact weekly
   PNG/PDF/MP4/SRT and post.json assets before human review; seal all final bytes.
   A narration, thumbnail, title or schedule change requires a revised review.
4. Keep the current daily static-data guards in their own DAILY scope. A WEEKLY
   job must not set youtubeShortsGunu or consume the daily producer guard. A daily
   marker must not suppress a different approved weekly item on the same day.
   Weekly item/channel claims use the persistent server ledger, not a renamed
   day-only flag. Never reset daily guards to force a weekly run.
5. The same approved item may have only one sender owner per channel. Do not send
   it through both the existing unguarded daily branch and the weekly branch.
   The weekly server already excludes its items from the legacy rubric path;
   actual n8n routing must also enforce this separation.
6. Independently verify each actual credential account: X handle is still unknown;
   FB destination 1324715560732735 and Buffer LinkedIn 6abf7282ea19ca0bde516274
   are mapping evidence, not ownership/scope verification. The observed IG account
   and YouTube Buffer channel IDs above must also be confirmed externally before
   binding them to approved weekly manifests. No new OAuth/token setup is implied.

## Buffer scheduling is not publication success

The existing YouTube path creates a scheduled Buffer post at 08:30 for 20:30.
A Buffer queue/post ID proves queue acceptance, not public YouTube publication.
Do not call the current weekly result endpoint SUCCEEDED just because Buffer
accepted a customScheduled request, and do not mark the site item PUBLISHED then.

The current PR ledger supports PENDING/CLAIMED/SUCCEEDED/FAILED/UNKNOWN/CANCELLED,
claims only during the 15-minute window after the approved timestamp, and treats
lost claims as visibly UNKNOWN after 20 minutes. Consequently it is **not yet an
adapter for the existing twelve-hour prequeue behavior**. Before connecting that
behavior, choose and implement one reviewed option:

- Just-in-time weekly dispatch at the exact approved time, with the existing
  sender adapted only after its provider semantics are verified. Persist its
  provider operation ID and poll for real public completion before SUCCEEDED.
  Do not assume YouTube supports Buffer shareNow merely because another channel
  does. Unknown completion must not trigger another upload.
- Retain early enqueue: extend the durable ledger with an explicit scheduled/
  queued state, a separate provider queue ID, cancellation/revocation handling,
  confirmation of the actual public platform ID and correct approval of enqueue
  versus publication times. Persist the queue ID before retries, reconcile the
  provider queue after uncertain responses, and never create a second scheduled
  post while the first queue item's existence is unresolved. A package revocation
  must reconcile/cancel an existing provider queue item, not just cancel PENDING
  database jobs.

The adapter must also compare the actual post.json account and dueAt fields with
the reviewed account/publication time; a matching file hash alone does not make a
different provider schedule the intended schedule. Early enqueue time and actual
publication time need distinct explicit semantics when that option is chosen.

Neither option has been activated or claimed to work by this PR. Queue acceptance
versus actual publication is an integration blocker, not evidence that the current
daily YouTube workflow is missing or broken.

## Reviewable live-change boundary and rollback

### Dry-run and preview acceptance, without posts

Use fixtures or a separately isolated draft render namespace. No request below
authorizes running the full existing producer/sender workflows. In dry-run mode,
the send/enqueue nodes must be unreachable and no daily static-data guard may be
written. Record the exact source/manifest version, safe status/date/asset metadata
and test outcome; keep raw exports, headers and responses out of user artifacts.

| Check | Expected result before any send node |
|---|---|
| 202/409 producer response | Wait/poll within budget; never force or start another overlapping render |
| 200 bos_gun=true | Explicit EMPTY/SKIPPED preparation result; no claim/enqueue/post |
| Waiting status | Poll every 15 seconds, at most about 15 minutes; timeout is visible, not success |
| Wrong/missing gun | Stop; never download or share another day's daily video |
| Error/unknown status, malformed files/scope | Stop and record a safe failure classification; no raw credentials/error response in reports |
| READY with files | Validate file order/type/size, MP4 container/streams/duration, intended day and SHA256 before review |
| Weekly media | Dedicated package-hash/item namespace, not reels-a-YYYY-MM-DD.mp4 or the daily completion marker |
| Review preview | Actual final images, MP4, SRT and any narration, plus exact per-channel post.json/accounts/times; clearly DRAFT/unpublished |
| Modified media/account/time/disclosure | Manifest changes; old approval/claim rejected |
| Missing human approval or disabled weekly flag | No claim or send; automatic preparation remains DRAFT only |
| Duplicate/unknown provider queue or delivery | No second enqueue/upload; reconcile provider ID and ledger first |
| Buffer accepted scheduled post | QUEUED evidence only; never SUCCEEDED/PUBLISHED solely from queue acceptance |

The repository unit/real-testDB tests validate the approval/ledger contracts, not
the live n8n topology or actual MP4/Buffer execution. Actual final-video preview,
isolated renderer validation, provider queue reconciliation and the dry-run branch
mapping remain required integration checks. Do not run the current daily producer
just to obtain a preview, because it also publishes Instagram media.

Before any edit, retain access-controlled exports/revision IDs for the producer,
YouTube and each affected sender; compare their currently published and draft
nodes/connections. Morning Bulletin's active/draft 24 nodes/connections were
identical in the earlier read-only comparison; recheck before any later change.
Report the exact per-workflow node/schedule/asset-path/duplicate-key/account diff.

Dry tests must stop before real send/enqueue nodes and must not consume daily
guards. Then test the weekly gate, changed assets, wrong accounts, duplicate
claim, existing provider queue, partial success and unknown completion with safe
test fixtures. Deploy/migrate/enable/disable/send/enqueue require the separately
approved concrete transition; none occurred in this work.

Rollback preserves the existing daily published revisions and guards. Stop new
weekly claims, retain delivery/queue evidence, and reconcile already accepted
provider jobs before restoring routing. Disabling a workflow does not cancel a
Buffer post already queued for 20:30. Do not reset successes or replay daily posts.
