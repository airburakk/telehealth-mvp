// Separate weekly media contract. No daily names/paths, upload HTTP or deletion.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pipeline } from "node:stream/promises";
const NAME = /^weekly-([a-f0-9]{64})\.(mp4|json|srt)$/;
const MIME = { mp4: "video/mp4", json: "application/json", srt: "application/x-subrip" };
const digest = b => createHash("sha256").update(b).digest("hex");
function exclusive(file, bytes) {
  try { fs.writeFileSync(file, bytes, { flag: "wx" }); }
  catch (e) { if (e.code !== "EEXIST" || fs.lstatSync(file).isSymbolicLink() || digest(fs.readFileSync(file)) !== digest(bytes)) throw new Error("WEEKLY_IMMUTABLE_WRITE_CONFLICT"); }
}
/** Existing kart process writes only to its separately verified weekly mount.
 * A bare n8n write-file node is not used: it has no observed no-clobber contract.
 */
export function writeWeeklyMedia({ root, name, bytes }) {
  const match = NAME.exec(name);
  if (!match || !Buffer.isBuffer(bytes) || !bytes.length || bytes.length > 100 * 1024 * 1024 || digest(bytes) !== match[1]) throw new Error("WEEKLY_MEDIA_INVALID");
  fs.mkdirSync(root, { recursive: true });
  const file = path.join(root, name);
  exclusive(file, bytes);
  const receipt = { v: 1, state: "DRAFT_REVIEW_ONLY", name, sha256: match[1], mime: MIME[match[2]], bytes: bytes.length };
  exclusive(`${file}.receipt.json`, Buffer.from(JSON.stringify(receipt)));
  return receipt;
}
const error = (res, status, code, extra = {}) => { res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store", ...extra }); res.end(JSON.stringify({ error: code })); };

/** Proposed NEW internal route, absent from the deployed service until approved
 * deployment. Public n8n bridge must be a separate workflow. Both gates default
 * off; no archive is made public by importing this module or deploying defaults.
 */
export function createWeeklyMediaHandler({ root = "", enabled = false, draftStagingAllowed = false } = {}) {
  return async (req, res) => {
    const u = new URL(req.url, "http://kart");
    if (!u.pathname.startsWith("/weekly-media/")) return false;
    if (!enabled || !draftStagingAllowed || !root) { error(res, 503, "WEEKLY_MEDIA_NOT_ACTIVATED"); return true; }
    if (!["GET", "HEAD"].includes(req.method)) { error(res, 405, "READ_ONLY_ROUTE", { allow: "GET, HEAD" }); return true; }
    const name = u.pathname.slice("/weekly-media/".length), match = NAME.exec(name);
    if (!match || u.search || u.hash) { error(res, 404, "WEEKLY_MEDIA_NOT_FOUND"); return true; }
    let fd;
    try {
      const file = path.join(root, name), receiptFile = `${file}.receipt.json`;
      const receiptStat = fs.lstatSync(receiptFile);
      if (fs.lstatSync(file).isSymbolicLink() || receiptStat.isSymbolicLink() || !receiptStat.isFile() || receiptStat.size > 2048) throw new Error("WEEKLY_MEDIA_INVALID");
      const receipt = JSON.parse(fs.readFileSync(receiptFile, "utf8"));
      fd = fs.openSync(file, "r");
      const stat = fs.fstatSync(fd);
      if (!stat.isFile() || stat.size < 1 || stat.size > 100 * 1024 * 1024 || receipt.v !== 1 || receipt.state !== "DRAFT_REVIEW_ONLY" || receipt.name !== name || receipt.sha256 !== match[1] || receipt.mime !== MIME[match[2]] || receipt.bytes !== stat.size) throw new Error("WEEKLY_MEDIA_INVALID");
      // Async bounded reads keep unrelated daily request handling responsive.
      const h = createHash("sha256");
      for await (const chunk of fs.createReadStream(file, { fd, autoClose: false, start: 0 })) h.update(chunk);
      if (h.digest("hex") !== match[1]) throw new Error("WEEKLY_MEDIA_INVALID");
      const after = fs.fstatSync(fd);
      if (after.size !== stat.size || after.mtimeMs !== stat.mtimeMs) throw new Error("WEEKLY_MEDIA_INVALID");
      let start = 0, end = stat.size - 1, status = 200;
      const range = req.headers.range;
      if (range) {
        const r = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!r || (!r[1] && !r[2])) { error(res, 416, "INVALID_RANGE", { "content-range": `bytes */${stat.size}` }); return true; }
        if (!r[1]) start = Math.max(0, stat.size - Number(r[2]));
        else { start = Number(r[1]); if (r[2]) end = Math.min(Number(r[2]), end); }
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= stat.size) { error(res, 416, "INVALID_RANGE", { "content-range": `bytes */${stat.size}` }); return true; }
        status = 206;
      }
      const headers = { "content-type": receipt.mime, "content-length": end - start + 1, "accept-ranges": "bytes", "cache-control": "public, max-age=86400, immutable", etag: `"sha256-${match[1]}"`, "x-content-type-options": "nosniff",
        ...(status === 206 ? { "content-range": `bytes ${start}-${end}/${stat.size}` } : {}) };
      res.writeHead(status, headers);
      if (req.method === "HEAD") res.end();
      else { const stream = fs.createReadStream(file, { fd, autoClose: true, start, end }); fd = undefined; await pipeline(stream, res); }
    } catch { if (!res.headersSent) error(res, 404, "WEEKLY_MEDIA_NOT_FOUND"); else res.destroy(); }
    finally { if (fd !== undefined) fs.closeSync(fd); }
    return true;
  };
}
