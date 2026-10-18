// State/contract preview only: NO DB, credentials, network, enqueue or post.
// npx tsx scripts/weekly-queue-dry-run.ts [output-directory]
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { stateAfterRevoke, queueAcceptedState, publicationState, publicationEvidence, effectiveQueueState, remoteRisk } from "../src/lib/social-calendar/queue-state";
const due = "2026-10-19T17:30:00.000Z", claim = new Date("2026-10-19T05:30:00Z");
const cases = [
  { scenario: "Buffer acceptance is NOT publication", state: queueAcceptedState(true, due, due), expected: "QUEUED" },
  { scenario: "Twelve-hour early queue", state: effectiveQueueState("QUEUED", claim, new Date(due), new Date("2026-10-19T10:00:00Z")), expected: "QUEUED" },
  { scenario: "Revoke a known queue", state: stateAfterRevoke("QUEUED"), expected: "CANCEL_PENDING" },
  { scenario: "Revoke uncertain acceptance", state: stateAfterRevoke("UNKNOWN"), expected: "CANCEL_UNKNOWN" },
  { scenario: "Publication after revoked approval", state: publicationState(false, "QUEUED"), expected: "PUBLISHED_RISK" },
  { scenario: "Late publication after cancellation confirmation", state: publicationState(false, "CANCELLED"), expected: "PUBLISHED_RISK" },
];
for (const c of cases) assert.equal(c.state, c.expected);
assert.equal(remoteRisk("CANCEL_PENDING", false, "fixture-queue", 1), true);
assert.throws(() => publicationEvidence("youtube", "fixture", "https://buffer.com/post/fixture", due, new Date("2026-10-19T17:31:00Z")));
const report = { mode: "OFFLINE_STATE_DRY_RUN_ONLY", posted: false, queued: false, providerContacted: false, cases,
  limitation: "Fixture state validation, not a real MP4, live n8n or provider read/cancel capability. Unsupported operations require human reconciliation." };
if (process.argv[2]) {
  const dir = path.resolve(process.argv[2]); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "queue-dry-run.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(dir, "queue-dry-run.html"), `<!doctype html><meta charset="utf-8"><title>Weekly queue dry run</title><body style="font:18px system-ui;max-width:900px;margin:40px auto"><h1>DRAFT / OFFLINE / NO POSTS</h1><p>${report.limitation}</p><table border="1" cellpadding="12"><tr><th>Fixture scenario</th><th>State</th></tr>${cases.map(c => `<tr><td>${c.scenario}</td><td>${c.state}</td></tr>`).join("")}</table><p>No credentials or network used.</p></body>`);
}
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
