# Weekly review and YouTube preparation

Status: preparation only. No new approval endpoint, database migration, publisher,
credential, scheduled trigger or live n8n modification is included in this change.
The existing editor and Daily Selection continue to work as before. This PR does
**not** make one-click weekly approval available in the site yet.

## Evidence and access boundary

Inspected against main `81c3cb4948ac049e0e288a350731266178d7af06`.
The repository contains the kart renderer and its n8n API contract, but no export
of the active workflow. The documented `output/n8n-akislari` scripts are absent.
No connected n8n tool or configured `doctorium-n8n` SSH alias was available here.
The user supplied workflow `TnY74Tf0YUtMXxyR` at `otomasyon.doctorium.tr`;
another worker owns its read-only browser inspection. Its actual nodes,
credentials, executions and active state have not been verified by this change.

Daily Selection uses `/bulten.png`, `/sosyal/uret`, `/sosyal/durum` and the
existing MP4-only `dosyalar` field. Rubric publishing has a separate
`/rubrik/bugun`, `/rubrik/dosya`, `/rubrik/sonuc` contract and a separate
`CONTENT_PLAN_TOKEN`. Documentation calls that line dormant; documentation is
not evidence of the current server configuration. Do not re-create or activate
it based solely on this file. Never put PNGs in the Daily Selection `dosyalar`.

## Decision: one authenticated approval for the next week's sealed package

Reuse the source preparation, rubric gates, kart images and platform branches.
Do not turn n8n into the approval authority or accept an `approved: true` value
from a webhook. A package hash alone is not authorization.

`src/lib/social-calendar/weekly-package.ts` provides the tested, side-effect-free
review contract. It requires all three rubric slots, five channels, current item
versions, passing existing editorial gates, future Turkey slot dates and final
asset hashes. It seals content, item version, schedule, platform list and media.
A changed file, voice track, caption, schedule or payload requires another review.
The per-channel delivery key includes package hash, item and channel.

The remaining authenticated service/UI must be implemented after mapping the
actual n8n workflow. In one database transaction it must:

1. Load every item and its current source text; run the existing `evaluateGates`.
   Karar masası still requires its identity attestation, exact source quotations
   and human-reviewed Doctor için çıkarım. No legal-review bypass.
2. Compare the exact preview hash the administrator saw, CAS every item version,
   store an immutable manifest and server-side actor/time receipt, and stamp the
   individual approved hashes. Any failed gate/version rolls back the whole week.
3. Bind managed items to the package and exclude them from the legacy `al` path,
   so old and new workers cannot publish the same item independently.
4. Claim a unique delivery record before each platform request, verify the stored
   approval, current payload/asset hashes and exact scheduled window again.
5. Persist platform IDs and results per channel: PENDING, CLAIMED, SUCCEEDED,
   FAILED, UNKNOWN. An upload timeout is UNKNOWN, never an automatic retry.
   Reconcile platform IDs before a human authorizes retry. A failed YouTube upload
   must not repeat already successful Instagram/X/Facebook/LinkedIn posts.
6. Support package revocation, execution audit and explicit human reconciliation.
   Editing one item revokes its undelivered package jobs. No backdated catch-up.

Source facts should be checked again before dispatch; a withdrawn/changed event or
deadline blocks the affected job and requests a revised review. Do not silently
replace an approved payload. Weekly approval must never authorize unknown future
content or imply that a review-only file is a production database draft.

Alternative rejected: combining the weekly package with Daily Selection's
published news flow. It would couple unrelated approval rules and risk daily posts.
Alternative deferred: a second paid video/SaaS system. Existing ffmpeg is enough
for sourced card videos, with no added recurring charge or token.

## YouTube technique

Start with deterministic 1080×1920, 30 fps H.264 MP4s from the exact reviewed PNGs.
The existing `rubrik-video.mjs` uses five-second slides and is unchanged. The new
offline `rubrik-storyboard.mjs` estimates readable card durations from the exact
slide text (at most three words/second, minimum five seconds). It generates SRT
and a cut-based ffmpeg filter. A dense deck exceeding 58 seconds fails visibly;
never truncate a legal quote or speed it up. It needs either a separately reviewed
short script/deck or a later long-form video profile. SRT is a reading track, not
speech-aligned captions. No speech is synthesized in this change.

`infra/kart/lib/review-video.mjs` renders a local, explicitly unapproved preview
with the existing ffmpeg runner and writes MP4/SRT/input-output SHA256 evidence.
It refuses mismatched slide/PNG counts, bad PNG signatures and overwriting an
existing output directory. It has no network, upload or approval call. Neither
the HTTP server nor Daily Selection imports it.

Next voice step: choose a Turkish voice and generate narration **before** weekly
review, then align captions to the measured audio. Bind MP4, audio, subtitles,
thumbnail, title and description hashes to the same manifest. First preference
is an existing licensed voice/TTS integration if verified; otherwise an offline
voice can be evaluated. Do not create OAuth grants, buy credits, clone a voice,
or assume music rights. Any new credential/payment requires a concrete request.

## n8n review export and safe activation

`infra/n8n/doctorium-rubrik-dry-review.json` is a new **inactive manual-only**
dry-render workflow, not an export of `TnY74Tf0YUtMXxyR`. It calls only the
existing `POST http://kart:3000/rubrik/bugun?kuru=1`; no claim, callback,
schedule, credential or social upload node. This endpoint only reads already
approved items and renders files; it cannot preview new unapproved weekly drafts.
It can return 503 when the existing content-plan token is absent or kart busy.
Its node schema has not been imported into the actual server version yet.

Before any live edit: export the verified target and record workflow ID, active
state, node IDs, connections, schedules and credential **references only** in an
access-controlled backup. Do not commit credential values or execution payloads.
Report the exact node diff and effect to the parent for approval. Preserve the
Daily Selection nodes/schedules/credentials. Create an inactive copy for testing;
disable upload nodes during dry tests. Reuse credentials only after their scope
and authorized accounts are verified. Rollback = deactivate the new rubric copy,
restore the original workflow export/active state and reconcile any CLAIMED or
UNKNOWN delivery records. Never re-run successful platform uploads on rollback.

This change has zero production effect until a separately reviewed integration
and deployment. The first PR46 automatic draft cron run is a separate observation;
these helpers do not trigger it.
