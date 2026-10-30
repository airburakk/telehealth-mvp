// Offline YouTube review plan. Uses existing approved slide text verbatim; no AI/TTS call.
// Rendering and upload remain separate. Review the final MP4/captions/audio in the weekly package.
import { createHash } from "node:crypto";

const round = n => Math.round(n * 1000) / 1000;
const timestamp = seconds => {
  const ms = Math.round(seconds * 1000);
  return `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
};

/** Reading estimate, not a claim of speech alignment. Dense legal cards fail closed.
 * No truncation, invented narration or faster playback to squeeze text into a Short.
 */
export function youtubeStoryboard(slides, { wordsPerSecond = 3, maxSeconds = 58 } = {}) {
  if (!Array.isArray(slides) || slides.length < 1 || slides.length > 10) throw new Error("1-10 slides required");
  if (!Number.isFinite(wordsPerSecond) || wordsPerSecond < 1 || wordsPerSecond > 3 || !Number.isFinite(maxSeconds) || maxSeconds < 5 || maxSeconds > 58)
    throw new Error("Unsafe reading profile");
  let start = 0;
  const cues = slides.map((s, index) => {
    if (!s || typeof s.title !== "string" || typeof s.body !== "string" || (s.bullets !== undefined && (!Array.isArray(s.bullets) || s.bullets.some(b => typeof b !== "string"))))
      throw new Error("Invalid slide text");
    // SRT control sequences must not become injected cue boundaries.
    const text = [s.title, s.body, ...(s.bullets ?? [])].filter(Boolean).join("\n");
    if (!text.trim() || text.includes("-->") || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) throw new Error("Invalid caption text");
    const words = text.trim().split(/\s+/u).length;
    const duration = round(Math.max(5, words / wordsPerSecond + 1.5));
    const cue = { slide: index + 1, start: round(start), end: round(start + duration), text };
    start = cue.end;
    return cue;
  });
  if (start > maxSeconds) throw new Error(`Reading time ${start}s exceeds ${maxSeconds}s; review a shorter video script or a long-form video`);
  const srt = cues.map((c, i) => `${i + 1}\n${timestamp(c.start)} --> ${timestamp(c.end)}\n${c.text.replace(/\n\s*\n/g, "\n")}\n`).join("\n");
  return { v: 1, profile: "approved-cards-readable-v1", width: 1080, height: 1920, fps: 30, duration: round(start),
    transition: "cut", audio: "none", cues, srt, captionHash: createHash("sha256").update(srt).digest("hex") };
}

/** Exact cut sequence for existing PNGs. Designed for the existing ffmpeg runner.
 * Audio/TTS are intentionally absent: adding either requires a new reviewed asset hash.
 */
export function storyboardFilter(storyboard) {
  if (!storyboard || storyboard.profile !== "approved-cards-readable-v1" || !Array.isArray(storyboard.cues) || !storyboard.cues.length) throw new Error("Invalid storyboard");
  const parts = storyboard.cues.map((c, i) => {
    if (!Number.isFinite(c.start) || !Number.isFinite(c.end) || c.end <= c.start) throw new Error("Invalid cue timing");
    return `[${i}:v]scale=1080:1350:flags=lanczos,setsar=1,split[a${i}][b${i}];[a${i}]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=40:3[bg${i}];[bg${i}][b${i}]overlay=(W-w)/2:(H-h)/2,trim=duration=${round(c.end - c.start)},setpts=PTS-STARTPTS,fps=30,format=yuv420p[s${i}]`;
  });
  parts.push(`${storyboard.cues.map((_, i) => `[s${i}]`).join("")}concat=n=${storyboard.cues.length}:v=1:a=0[v]`);
  return parts.join(";");
}
