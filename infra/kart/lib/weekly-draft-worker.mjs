import fs from "node:fs";
import path from "node:path";
import { yetkili } from "./social-rubrik.mjs";
import { createWeeklyArchive, createWeeklyDraftClient, createWeeklyVideoRenderer, prepareWeeklyDraft } from "./weekly-draft-producer.mjs";

const monday = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s && new Date(`${s}T00:00:00Z`).getUTCDay() === 1;
const json = (res, status, value) => { res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); res.end(JSON.stringify(value)); };

/** Dormant internal kart entry point. No timers or automatic production routing.
 * Reads one operational account/time/policy file, not HTTP-provided credentials.
 * Reuses kart's existing browser and token. Complete receipts/errors stay on disk.
 */
export function createWeeklyDraftWorker({ dir, getBrowser, spherePath, token, planToken = "", enabled = false, profileFile = "",
  archiveRoot = "", archiveBaseUrl = "", archiveMappingVerified = false, mesgul = () => false, now = Date.now,
  run = prepareWeeklyDraft, fetchImpl = fetch }) {
  let running = false;
  return {
    busy: () => running,
    async handle(req, res) {
      const u = new URL(req.url, "http://kart");
      if (!["/rubrik/haftalik/hazirla", "/rubrik/haftalik/durum"].includes(u.pathname)) return false;
      if (!token || !yetkili(req.headers.authorization, token)) { json(res, 401, { error: "UNAUTHORIZED" }); return true; }
      const week = u.searchParams.get("hafta") ?? "";
      if (!monday(week)) { json(res, 400, { error: "MONDAY_REQUIRED" }); return true; }
      const runDir = path.join(dir, "weekly-draft", week), stateFile = path.join(runDir, "state.json");
      if (u.pathname.endsWith("/durum")) {
        if (req.method !== "GET") { json(res, 405, { error: "GET_REQUIRED" }); return true; }
        let state = { state: "NOT_STARTED", approved: false, published: false };
        try { state = JSON.parse(fs.readFileSync(stateFile, "utf8")); } catch { if (fs.existsSync(runDir)) state.state = "INCOMPLETE_RUN_CHECK_FILES"; }
        json(res, 200, state); return true;
      }
      if (req.method !== "POST") { json(res, 405, { error: "POST_REQUIRED" }); return true; }
      if (!enabled || !planToken || !archiveMappingVerified || !archiveRoot || !archiveBaseUrl || !profileFile) { json(res, 503, { error: "DRAFT_PREPARATION_DEPENDENCIES_NOT_VERIFIED" }); return true; }
      // Explicit safe rendering window outside the 07:45/07:55/08:30 daily jobs.
      const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Istanbul", hour: "2-digit", hourCycle: "h23" }).format(new Date(now())));
      if (hour < 10 || hour >= 20 || mesgul() || running) { json(res, 409, { error: "RENDER_RESOURCE_BUSY_OR_OUTSIDE_WINDOW" }); return true; }
      if (fs.existsSync(runDir)) { json(res, 409, { error: "RUN_ALREADY_EXISTS_CHECK_RECEIPT" }); return true; }
      let profiles;
      try { profiles = JSON.parse(fs.readFileSync(profileFile, "utf8")); } catch { json(res, 503, { error: "OPERATIONAL_PROFILE_REQUIRED" }); return true; }
      fs.mkdirSync(path.dirname(runDir), { recursive: true });
      running = true;
      // Reserve synchronously before 202 to prevent concurrent starts/processes.
      // prepareWeeklyDraft owns the mkdir lock; no await occurs before it runs.
      const job = run({ week, runDir, profiles,
        client: createWeeklyDraftClient({ token: planToken, fetchImpl }),
        renderer: createWeeklyVideoRenderer({ getBrowser, spherePath }),
        archive: createWeeklyArchive({ root: archiveRoot, publicBaseUrl: archiveBaseUrl, mappingVerified: archiveMappingVerified, fetchImpl }) });
      void job.catch(() => { /* sanitized durable error is written by producer */ }).finally(() => { running = false; });
      json(res, 202, { state: "DRAFT_PREPARATION_STARTED", week, approved: false, published: false }); return true;
    },
  };
}
