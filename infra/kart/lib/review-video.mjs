import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { ff } from "./social-video.mjs";
import { youtubeStoryboard, storyboardFilter } from "./rubrik-storyboard.mjs";

/** Offline preview only. Caller supplies the already rendered slide PNGs in payload order.
 * Never called by the Daily Selection renderer, HTTP server, cron or publishing worker.
 */
export async function renderYoutubeReview({ slides, pngPaths, outDir, ffImpl = ff }) {
  const storyboard = youtubeStoryboard(slides);
  if (!Array.isArray(pngPaths) || pngPaths.length !== slides.length) throw new Error("PNG/slide count mismatch");
  const pngMagic = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const assets = pngPaths.map(file => {
    const bytes = fs.readFileSync(file);
    if (!bytes.subarray(0, 8).equals(pngMagic)) throw new Error("Invalid PNG signature");
    return { name: path.basename(file), sha256: createHash("sha256").update(bytes).digest("hex") };
  });
  // Refuse overwriting another review; partial/failed jobs remain visible for diagnosis.
  fs.mkdirSync(outDir, { recursive: false });
  const output = path.join(outDir, "youtube-review.mp4");
  const inputs = pngPaths.flatMap((file, i) => ["-loop", 1, "-framerate", 30, "-t", storyboard.cues[i].end - storyboard.cues[i].start, "-i", path.resolve(file)]);
  await ffImpl([...inputs, "-filter_complex", storyboardFilter(storyboard), "-map", "[v]", "-c:v", "libx264", "-preset", process.env.X264_PRESET || "medium", "-crf", 18,
    "-pix_fmt", "yuv420p", "-r", 30, "-an", "-t", storyboard.duration, "-movflags", "+faststart", output]);
  const result = { state: "DRAFT_REVIEW_ONLY", approved: false, published: false, storyboard, inputs: assets,
    output: { name: path.basename(output), sha256: createHash("sha256").update(fs.readFileSync(output)).digest("hex") } };
  fs.writeFileSync(path.join(outDir, "youtube-review.srt"), storyboard.srt);
  fs.writeFileSync(path.join(outDir, "review.json"), JSON.stringify(result, null, 2));
  return result;
}
