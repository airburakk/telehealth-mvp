// Draft-only adaptation utility using the EXISTING ffmpeg runner, never a publisher.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { ff } from "./social-video.mjs";
const CHANNELS = ["facebook", "instagram", "linkedin", "x", "youtube"];
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
function mp4(file) {
  const b = fs.readFileSync(file);
  if (b.length < 12 || b.subarray(4, 8).toString() !== "ftyp") throw new Error("Validated existing-renderer MP4 required");
  return b;
}

/** The input is the existing renderer's reviewed-content master, not a daily
 * workflow invocation. Posts must already be adapted; no automatic truncation,
 * title invention, account choice or disclosure default is introduced here.
 * Native existing LinkedIn output is preferred; otherwise retain the full portrait
 * frame on a blurred 16:9 background and require review of that actual output.
 */
export async function renderVideoReviewAdaptations({ masterPath, linkedinPath = null, outDir, posts, ffImpl = ff }) {
  const master = mp4(masterPath), masterVideoHash = hash(master);
  if (!posts || CHANNELS.some(c => !posts[c] || typeof posts[c] !== "object" || Array.isArray(posts[c]))) throw new Error("Final post data required for every channel");
  if (typeof posts.youtube.isAiGenerated !== "boolean") throw new Error("YouTube disclosure decision must be explicit before review");
  const publicFields = new Set(["title", "caption", "description", "text", "thread", "hashtags", "sourceUrls", "visibility", "madeForKids", "notifySubscribers", "isAiGenerated", "dueAt", "accountId", "categoryId"]);
  for (const c of CHANNELS) if (Object.entries(posts[c]).some(([k, v]) => !publicFields.has(k) || !(typeof v === "string" || typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v)) || (Array.isArray(v) && v.every(x => typeof x === "string"))))) throw new Error("Only public final post fields are allowed; no credentials or nested request objects");
  fs.mkdirSync(outDir, { recursive: false });
  const assets = [];
  for (const channel of CHANNELS) {
    const dir = path.join(outDir, channel); fs.mkdirSync(dir);
    const video = path.join(dir, "video.mp4");
    if (channel !== "linkedin") fs.copyFileSync(masterPath, video);
    else if (linkedinPath) { mp4(linkedinPath); fs.copyFileSync(linkedinPath, video); }
    else await ffImpl(["-i", path.resolve(masterPath), "-filter_complex",
      "[0:v]split[bg][fg];[bg]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,boxblur=40:3[back];[fg]scale=1920:1080:force_original_aspect_ratio=decrease[front];[back][front]overlay=(W-w)/2:(H-h)/2,setsar=1,format=yuv420p[v]",
      "-map", "[v]", "-map", "0:a?", "-c:v", "libx264", "-crf", 18, "-c:a", "aac", "-movflags", "+faststart", video]);
    const videoHash = hash(mp4(video));
    const post = path.join(dir, "post.json"); fs.writeFileSync(post, JSON.stringify(posts[channel], null, 2));
    assets.push({ channel, name: "video.mp4", sha256: videoHash, sourceMasterHash: masterVideoHash, localPath: video });
    assets.push({ channel, name: "post.json", sha256: hash(fs.readFileSync(post)), localPath: post });
  }
  const report = { state: "DRAFT_REVIEW_ONLY", approved: false, published: false, masterVideoHash, assets };
  fs.writeFileSync(path.join(outDir, "review.json"), JSON.stringify(report, null, 2));
  return report;
}
