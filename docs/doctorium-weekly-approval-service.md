# Weekly approval service: review-only rollout

Implemented on the PR branch, not production. No production migration or social
upload occurred. The existing dynamic Daily Selection is a different workflow.

## Schema and review

Migration `20261018050000_weekly_content_package` adds WeeklyContentPackage,
WeeklyChannelDelivery and WeeklyDeliveryEvent, plus ContentPlanItem.weeklyPackageId.
The PostgreSQL update trigger revokes an approved package and cancels PENDING
deliveries in the same transaction when an item's payload, source, attestation,
approval hash, slot or editable state changes. Claim transitions preserve the seal.

`/admin/icerik-takvimi/haftalik?hafta=YYYY-MM-DD` shows the reviewed week, Turkey
times, text, explicit target accounts and final media. One checkbox/button approves
that exact package. ADMIN session required; cross-origin writes are rejected.
The page explicitly says the n8n weekly integration has not been activated.

`POST /api/admin/icerik-takvimi/haftalik` actions:

| Action | Input and effect |
|---|---|
| prepare | manifest; store DRAFT only, no approval |
| approve | id/version/hash/confirmed:true; atomic approval of all items |
| revoke | id/version; stop pending jobs and release unattempted items |
| reconcile | delivery id/version, FOUND/NOT_FOUND, evidence and platformId when found |

The manifest must contain the three existing Monday/Wednesday/Friday rubric slots,
item versions/content hashes, five channels, exact future UTC timestamps falling
on each Turkey slot day, target account IDs and final public HTTPS asset URLs/
SHA256 values. Each channel requires `post.json` containing the exact final
caption/title/thread/description request data. YouTube also requires MP4. List all
other files used by the upload: images, PDF, SRT, audio, thumbnail when applicable.
URLs cannot carry query tokens or embedded credentials. The final rendered assets
and their producer/account mapping remain a real integration dependency.

Approval is SERIALIZABLE, locks the package/items, rechecks the preview version
and hash, reads current source texts and runs existing editorial gates. It reserves
and stamps all three items and creates all 15 channel jobs in one transaction.
Any failed gate or concurrent change rolls back the whole approval. Karar masası
still requires its existing identity, exact-quote and human-note gates. A separate
source-literacy alternative cannot silently replace that registered legal item.
The weekly confirmation explicitly attests to identity safety, quotations and the
human review of the note, so an extra per-item approval is unnecessary. Preparation
may preview an unattested draft but never saves an attestation; only that explicit
human confirmation records attestIdentity=true inside the approval transaction.
Automatic identity scanning and source-quote validation still cannot be bypassed.
Definite SERIALIZABLE/deadlock rollbacks may retry the DB-only transaction at most
three times with fresh reads. Connection failures/unknown commit outcomes and
platform upload requests are never automatically retried by this mechanism.

Package receipts survive revocation. A new revision requires revoking the open
package first and reviewing the new item versions/assets/accounts/schedule.
Only items with no attempted channel jobs can be released/repackaged. A unique
item/channel constraint prevents a revised package from repeating a previous
upload. Unattempted cancelled histories are retained when moved to a new revision.

## Dormant worker surface

`POST /api/social-calendar/haftalik` uses the existing kart-held CONTENT_PLAN_TOKEN;
no new secret or OAuth grant is created. It cannot approve. Actions:

| Action | Contract |
|---|---|
| drafts | Read existing unreserved DRAFT payloads/versions/hashes and the current kart render model; no slots or content are created/edited |
| prepare | Save a prepared DRAFT manifest as automation; no approval or attestation, even if the caller supplies such flags |
| inspect | Read an approved week/manifest/jobs; no drafts or claim tokens |
| claim | id, package hash, actual accountId, downloaded assetHashes by filename |
| result | id, attempt claimToken, SUCCEEDED/FAILED/UNKNOWN; platformId for success |

Claims require `WEEKLY_PUBLISH_ENABLED=true`, absent/false by default (503).
Inspection and in-flight result reporting remain available without enabling new
claims. No scheduler, kart bridge or live n8n node invokes this endpoint yet.
Automatic preparation uses that same token-authenticated surface, not a retained
human session. It never records the human identity attestation or creates delivery
jobs. The final-media producer still needs to be connected after real access,
storage and account mapping are verified.
Repeating preparation with the same DRAFT manifest hash returns the existing
package, including after a lost response. Different manifests never overwrite an
open review or an approved package silently.

The connected worker must resolve the actual credential's account and hash every
downloaded final file, including post.json, before claiming once. The server checks
the stored human approval, current content/gates, account and exact media hashes.
Claims are limited to 15 minutes after the approved timestamp: no early posts or
backdated catch-up. Items owned by weekly packages are excluded from legacy bak/al,
manual publish, legacy result/failure and retry paths to prevent two publishers.

SUCCEEDED needs a real platform ID, is terminal and cannot be reset by retry.
Identical callbacks are idempotent; conflicting results are rejected. FAILED
without explicit noRequestSent:true becomes UNKNOWN. A lost CLAIMED result is
displayed UNKNOWN after 20 minutes but never automatically recycled. A human must
inspect the platform and record evidence before reset; UNKNOWN/CLAIMED NOT_FOUND
requires at least 20 minutes. FOUND records the existing platform ID without an
upload. FAILED also requires human verification. New claims must still match the
original account/files/time window; missed windows need a new operational review.
One failed channel never requeues another successful channel. Events persist in
WeeklyDeliveryEvent; raw platform responses/tokens are not stored.

These source gates do not fetch fresh internet facts. The producer/worker must
recheck externally changing dates/withdrawals and stop for revised review rather
than silently rewriting approved content.

## Live boundary and rollback

Run the migration and concurrency/trigger tests only on TEST_DATABASE_URL first.
Apply additive schema before code only after production approval; keep the publish
flag disabled. Test explicit review, stale edits, rollback of all item approvals,
legacy exclusion, concurrent claims, uncertain callbacks and human reconciliation.

The parent worker's subsequent read-only UI-export comparison verified:

| Observation | Evidence and boundary |
|---|---|
| Workflow | TnY74Tf0YUtMXxyR, active=true |
| Active revision | d6d0014a-aaeb-42ad-8d0c-b6a92357f771, 16 October |
| Draft revision | b4f9265a-432d-4e70-9a87-dd27a146ded7 |
| Revision comparison | All 24 complete node objects and connections identical; toolbar difference is version metadata |
| X | Credential display name “X (Twitter) - Doctorium”; exact handle not independently established |
| Facebook | Destination page ID 1324715560732735; do not infer independent account ownership/scope validation |
| Buffer | Channel 6abf7282ea19ca0bde516274; workflow-code label “Doctorium (LinkedIn Page)”; external account identity not independently verified |

These identifiers/display labels are nonsecret mapping evidence, not proof that
the credentials target the intended accounts or have all required permissions.
No save, publish, execution, deployment or live change was performed. Raw exports
may contain credentials: keep them out of Git, user artifacts and logs.

The subsequent read-only inventory contains 13 workflows. Published entries
include YouTube Shorts (Buffer), LinkedIn video (Buffer), X video (Reel A),
Facebook Reels (Reel A), Instagram Günlük Kart (feed), and Sabah Hikâye + Reels
(üret + arşivle + yayın). The earlier absence of video/Instagram nodes applies
only to TnY74Tf0YUtMXxyR, not the entire n8n installation. Inspect the existing
YouTube workflow and shared producer before deciding where to attach the weekly
approval/claim boundary. Reuse those existing production/distribution branches;
do not create a parallel video publisher. Detailed node wiring, execution evidence
and independent target-account verification are still pending. No live pipeline
was created or replaced by the offline preview code in this PR.

Before any live n8n edit, retain the actual backup in access-controlled storage and
recheck that these revision IDs, active state and node/connection equality still
hold. Do not rewire the dynamic daily news workflow into a weekly package. Build
a separate inactive rubric flow and report the exact diff/
effect for approval. Verify actual platform account scopes and test failures before
separately approving activation. The manual dry-review JSON is not a live backup.

Rollback starts by disabling new weekly claims; leave result reporting available
for in-flight reconciliation. Revoke packages and ensure unattempted items are
DRAFT before reverting to code that lacks weekly ownership checks. Preserve all
attempted/uncertain evidence; never reset or repost successful deliveries. Restore
n8n's original verified published revision if needed. Retain the additive schema/
trigger and ledger: no destructive database rollback is necessary or authorized.
