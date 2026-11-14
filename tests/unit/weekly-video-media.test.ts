import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { validateWeeklyVideo } from "../../infra/kart/lib/weekly-video-media.mjs";
import { renderVideoReviewAdaptations } from "../../infra/kart/lib/video-adaptations.mjs";
import { ff } from "../../infra/kart/lib/social-video.mjs";
const box = (kind: string) => { const b = Buffer.alloc(8); b.writeUInt32BE(8); b.write(kind, 4); return b; };
const metadata = { format: { duration: "5" }, streams: [{ codec_type: "video", codec_name: "h264", width: 1080, height: 1920, pix_fmt: "yuv420p", avg_frame_rate: "30/1" }] };
describe("weekly final media validation", () => {
  it("requires faststart, native geometry and a readable bounded H264 profile", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "weekly-media-"));
    try {
      const file = path.join(dir, "video.mp4"); fs.writeFileSync(file, Buffer.concat([box("ftyp"), box("moov"), box("mdat")]));
      expect(await validateWeeklyVideo(file, "youtube", { probe: async () => metadata })).toMatchObject({ duration: 5, fps: 30, audio: "none" });
      for (const changed of [{ format: { duration: "NaN" } }, { format: { duration: "300" } }, { streams: [{ ...metadata.streams[0], width: 720 }] }, { streams: [{ ...metadata.streams[0], codec_name: "hevc" }] }]) {
        await expect(validateWeeklyVideo(file, "youtube", { probe: async () => ({ ...metadata, ...changed }) })).rejects.toThrow(/PROFILE/);
      }
      fs.writeFileSync(file, Buffer.concat([box("ftyp"), box("mdat"), box("moov")]));
      await expect(validateWeeklyVideo(file, "youtube", { probe: async () => metadata })).rejects.toThrow(/CONTAINER/);
      fs.writeFileSync(file, Buffer.from([0, 0, 0, 1, 102, 116, 121, 112]));
      await expect(validateWeeklyVideo(file, "youtube", { probe: async () => metadata })).rejects.toThrow(/CONTAINER/);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
  const available = spawnSync(process.env.FFMPEG || "ffmpeg", ["-version"], { stdio: "ignore" }).status === 0 && spawnSync(process.env.FFPROBE || "ffprobe", ["-version"], { stdio: "ignore" }).status === 0;
  it.skipIf(!available)("encodes an actual local five-channel MP4 fixture and probes the resulting files (no browser/network)", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "weekly-real-video-"));
    try {
      const master = path.join(dir, "master.mp4");
      await ff(["-f", "lavfi", "-i", "color=c=black:s=1080x1920:r=30:d=5", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", master]);
      const posts = Object.fromEntries(["facebook", "instagram", "linkedin", "x", "youtube"].map(c => [c, { caption: "Local fixture", isAiGenerated: false }]));
      const report = await renderVideoReviewAdaptations({ masterPath: master, outDir: path.join(dir, "channels"), posts });
      for (const a of report.assets.filter(a => a.name === "video.mp4")) expect((await validateWeeklyVideo(a.localPath, a.channel)).duration).toBeCloseTo(5, 0);
      expect(report.approved).toBe(false); expect(report.published).toBe(false);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }, 120000);
});
