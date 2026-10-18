# Existing kart producer to weekly DRAFT

Status: code only, default disabled. No production variables, public mount,
cron, n8n workflow, credentials or provider records were changed.

## Implemented and tested boundaries

`weekly-draft-producer.mjs` composes the existing `renderRubrik` card renderer,
readable-card master renderer, five-channel native adaptation and DRAFT-only
application API. It does not invoke `/sosyal/uret`, daily guards or any sender.
Copy is derived deterministically from the current source-checked payload:
IG/FB caption, LinkedIn text, ordered bounded X thread and YouTube title/description.
Nothing is truncated. Over-limit titles/tokens or dense video text block the job.
Original supplied master videos can already use `video-adaptations.mjs`; the
automatic default here creates silent readable videos from the existing cards.
It does not invent original footage, narration or external generation services.

All blocking source, quotation, identity-scan and protected editor-note gates
must pass before rendering/archive. Human identity attestation is reserved for
the single ADMIN weekly approval; preparation cannot set it. The server repeats
the current gates/snapshot checks on DRAFT save and approval.

An operational profile holds existing account IDs, reusable Istanbul clock
times, optional enqueue lead hours (0–24), and explicit YouTube disclosure/kids/
notification/category policy. Dates come from the current rubric slots. The
weekly review still seals actual account IDs, exact UTC times, every final
`post.json`, native MP4, source-master hash and SRT. No second approval is added.

Example profile entry (placeholders; not an account selection or activation):

```json
{
  "etkinlik-radari": {
    "accounts": { "facebook": "EXISTING_ID", "instagram": "EXISTING_ID", "linkedin": "EXISTING_ID", "x": "EXISTING_ID", "youtube": "EXISTING_ID" },
    "publishClockTr": { "facebook": "20:30", "instagram": "20:30", "linkedin": "20:30", "x": "20:30", "youtube": "20:30" },
    "enqueueLeadHours": { "youtube": 12 },
    "youtubePolicy": { "isAiGenerated": false, "madeForKids": false, "notifySubscribers": true, "categoryId": 27 }
  }
}
```

All three registered series need their own verified policy. No policy file is
installed by this PR. The disclosure choice must match the actual final media.
Do not copy `false` to realistic generated footage without review.

## Archive and media

The existing kart image installs ffmpeg/ffprobe. Final files must be faststart
MP4, H264/yuv420p, 23–60 fps, 3–58.1s and native 1080x1920 (LinkedIn 1920x1080),
under 100 MiB; audio is optional, otherwise AAC mono/stereo. This checks the
current readable-card profile, not every social platform's acceptance rules.
`weekly-video-media.test.ts` also encodes/probes a real local fixture when both
existing binaries are available; it explicitly skips when unavailable. No tool
installation or media download occurs.

`createWeeklyArchive` uses only a separately confirmed existing filesystem to
public-HTTPS mapping. It provisions no service and exposes no new file server.
`weekly-<SHA256>` filenames are immutable/exclusive. Existing collisions must have identical
bytes. Every public file is read back without credentials/redirects and compared
before the application receives `prepare`. Hash URLs are not access control:
the operator must confirm that this existing mount is suitable for pre-approval
staging (including confidentiality/retention) before activating it. No such
mapping or policy has been verified in this task; default remains closed.

## Dormant internal entry point

Kart registers `POST /rubrik/haftalik/hazirla?hafta=YYYY-MM-DD` and authenticated
`GET /rubrik/haftalik/durum?hafta=YYYY-MM-DD`. Requests use the existing
SOCIAL_DIGEST_TOKEN; CONTENT_PLAN_TOKEN stays inside kart for the fixed
`https://doctorium.tr/api/social-calendar/haftalik` draft/read client. Redirects
cannot forward that token. No secret is returned in status/errors.

Activation dependencies, all unset/unmodified here:

- `WEEKLY_DRAFT_PREPARE_ENABLED=true` after reviewed activation.
- `WEEKLY_DRAFT_PROFILE_FILE` with verified existing accounts/time/policy.
- Existing `WEEKLY_DRAFT_ARCHIVE_ROOT` and matching HTTPS
  `WEEKLY_DRAFT_ARCHIVE_BASE_URL`, ending with `/`.
- `WEEKLY_DRAFT_ARCHIVE_VERIFIED=true` only after storage/public staging checks.
- Existing application code/schema and both existing tokens.

Requests return 503 while dependencies are unverified. Jobs run only 10:00–20:00
Istanbul, refuse an already-running daily render and reserve a dedicated
`SOSYAL_DIR/weekly-draft/<week>` directory. Concurrent/manual duplicate starts
fail. Existing daily routes, triggers and daily duplicate guards are unchanged.
The weekly worker does not add a busy gate to any existing daily/rubric handler.
It checks existing daily activity only before starting its own work.

The worker returns 202 and persists state. Only after all three complete
render/archive receipts does it call the existing idempotent `prepare` action.
It cannot call approve/claim/result. Failed runs keep partial files plus a
sanitized BLOCKED code; uncertain saves keep the exact manifest for human
reconciliation. No automatic force/reset/retry or deletion of an existing run.

## Official Buffer contract, dormant adapter

Checked 2026-10-18 against [Buffer Quick Start](https://developers.buffer.com/guides/getting-started.html)
and [API Reference](https://developers.buffer.com/reference.html).
`buffer-queue-adapter.mjs` uses their fixed GraphQL endpoint and documented
`post(input: PostInput!)` / `deletePost(input: DeletePostInput!)` operations.
It is not imported by a route, timer or n8n workflow. No credentials are read.

The adapter defaults read/cancel capability to false. A queued observation must
match both post and expected channel IDs and an automatic scheduled state/time.
Sent/reminder states do not automatically prove actual platform publication.
Cancel requires an explicit existing cancellation request, separately verified
capabilities, fresh same-channel scheduled state, future due time and the allowed
delete action. It never retries a timeout/error. Even a deletion acknowledgment
returns UNKNOWN requiring human reconciliation: deleting a Buffer record alone
does not disprove a concurrent platform dispatch. App cancellation/publication
gates and ledger remain the authority. No endpoints are invented for direct
Meta/X senders; those continue to require human/provider-specific verification.

## Remaining dependency classification

Implemented/tested: producer composition, automatic copy/time adaptation,
card overflow/media guards, immutable archive/readback, exclusive job receipts,
DRAFT API client, dormant internal worker, official Buffer contract adapter and
fail-closed behavior. Test fixtures never contact providers.

External dependencies: actual kart container rendering/probing, verified existing
HTTPS staging mapping, existing account ownership/scopes and live capability
confirmation, direct Meta/X read/cancel contracts, n8n test-copy integration.
No new paid service or credential is needed by this code.

User/operations approval: actual account/time/disclosure policy, public DRAFT
staging policy if required, production migration/deploy and subsequent explicit
worker/n8n activation. Weekly batch approval remains a separate single human
content decision. None of these operations was performed here.
