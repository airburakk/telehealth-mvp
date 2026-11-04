import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createWeeklyDraftWorker } from "../../infra/kart/lib/weekly-draft-worker.mjs";
const request = (route = "hazirla", method = "POST", token = "fixture") => ({ url: `/rubrik/haftalik/${route}?hafta=2026-10-19`, method, headers: { authorization: `Bearer ${token}` } });
function reply() { return { status: 0, body: "", writeHead(status: number) { this.status = status; }, end(body: string) { this.body = body; } }; }
describe("dormant existing-kart weekly preparation entry point", () => {
  it("stays disabled, authenticates before any state read and never starts a producer", async () => {
    const run = vi.fn(), worker = createWeeklyDraftWorker({ dir: ".", getBrowser: vi.fn(), spherePath: "fixture", token: "fixture", run });
    const denied = reply(); await worker.handle(request("hazirla", "POST", "wrong"), denied); expect(denied.status).toBe(401);
    const disabled = reply(); await worker.handle(request(), disabled); expect(disabled.status).toBe(503); expect(run).not.toHaveBeenCalled();
  });
  it("isolates daily paths and reports persisted status without triggering render", async () => {
    const run = vi.fn(), worker = createWeeklyDraftWorker({ dir: ".", getBrowser: vi.fn(), spherePath: "fixture", token: "fixture", run });
    expect(await worker.handle({ ...request(), url: "/sosyal/uret" }, reply())).toBe(false);
    const res = reply(); await worker.handle(request("durum", "GET"), res); expect(JSON.parse(res.body).state).toBe("NOT_STARTED"); expect(run).not.toHaveBeenCalled();
  });
  it("accepts one background draft job only, rejects overlap and honors the daily rendering window", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "weekly-worker-"));
    try {
      const profileFile = path.join(dir, "profiles.json"); fs.writeFileSync(profileFile, "{}");
      let finish!: () => void;
      const run = vi.fn().mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
      const options = { dir, getBrowser: vi.fn(), spherePath: "fixture", token: "fixture", planToken: "kart-only-fixture", run, profileFile, archiveRoot: path.join(dir, "archive"), archiveBaseUrl: "https://archive.example.test/", archiveMappingVerified: true, enabled: true };
      const worker = createWeeklyDraftWorker({ ...options, now: () => Date.parse("2026-10-18T10:00:00Z") });
      const started = reply(); await worker.handle(request(), started); expect(started.status).toBe(202); expect(worker.busy()).toBe(true);
      const overlap = reply(); await worker.handle(request(), overlap); expect(overlap.status).toBe(409); expect(run).toHaveBeenCalledTimes(1);
      finish(); await new Promise(resolve => setTimeout(resolve, 0)); expect(worker.busy()).toBe(false);
      const morning = createWeeklyDraftWorker({ ...options, now: () => Date.parse("2026-10-18T04:55:00Z") });
      const busy = reply(); await morning.handle(request(), busy); expect(busy.status).toBe(409); expect(run).toHaveBeenCalledTimes(1);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});
