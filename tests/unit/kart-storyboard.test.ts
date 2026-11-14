import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { storyboardFilter, youtubeStoryboard } from "../../infra/kart/lib/rubrik-storyboard.mjs";
import { renderYoutubeReview } from "../../infra/kart/lib/review-video.mjs";

describe("YouTube readable-card storyboard", () => {
  const slides = [{ title: "Başlık", body: "Onaylı kaynak metni." }, { title: "Koşullar", body: "İkinci kart", bullets: ["Başvuru şartı", "Resmî bağlantı"] }];
  it("keeps exact slide order/text, generates deterministic SRT and starts full frame", () => {
    const plan = youtubeStoryboard(slides);
    expect(plan.cues[0]).toMatchObject({ start: 0, end: 5, text: "Başlık\nOnaylı kaynak metni." });
    expect(plan.duration).toBe(10); expect(plan.audio).toBe("none");
    expect(plan.srt).toContain("00:00:05,000 --> 00:00:10,000");
    expect(youtubeStoryboard(slides).captionHash).toBe(plan.captionHash);
    expect(storyboardFilter(plan)).toContain("concat=n=2:v=1:a=0[v]");
    expect(storyboardFilter(plan)).not.toMatch(/drawtext|fade=/);
  });
  it("gives dense cards more time and refuses truncation or speed-up", () => {
    const plan = youtubeStoryboard([{ title: "Başlık", body: "kelime ".repeat(60) }]);
    expect(plan.duration).toBeGreaterThan(20);
    expect(() => youtubeStoryboard([{ title: "Başlık", body: "kelime ".repeat(180) }])).toThrow(/exceeds/);
    expect(() => youtubeStoryboard(slides, { wordsPerSecond: 10 })).toThrow(/Unsafe/);
  });
  it("refuses malformed or injected captions", () => {
    expect(() => youtubeStoryboard([])).toThrow();
    expect(() => youtubeStoryboard([{ title: "x", body: "00:00:00 --> 00:00:01" }])).toThrow();
    expect(() => youtubeStoryboard([{ title: "x", body: "", bullets: [5] }])).toThrow();
  });
});

describe("offline video review renderer", () => {
  it("renders a draft using the existing runner and writes matching asset hashes", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "doctorium-review-"));
    try {
      const png = path.join(root, "card.png");
      fs.writeFileSync(png, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]));
      const outDir = path.join(root, "out");
      const calls: unknown[][] = [];
      const result = await renderYoutubeReview({ slides: [{ title: "Kart", body: "Kaynak" }], pngPaths: [png], outDir,
        ffImpl: async (args: unknown[]) => { calls.push(args); fs.writeFileSync(String(args.at(-1)), "fake MP4"); return ""; } });
      expect(calls).toHaveLength(1);
      expect(calls[0]).toContain("+faststart");
      expect(result).toMatchObject({ approved: false, published: false, state: "DRAFT_REVIEW_ONLY" });
      expect(result.output.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(fs.readFileSync(path.join(outDir, "youtube-review.srt"), "utf8")).toBe(result.storyboard.srt);
      await expect(renderYoutubeReview({ slides: [{ title: "Kart", body: "Kaynak" }], pngPaths: [png], outDir })).rejects.toThrow(/exist/i);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
  it("rejects wrong images/counts before creating an output directory", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "doctorium-review-"));
    try {
      const png = path.join(root, "not-a-png"); fs.writeFileSync(png, "not PNG");
      const outDir = path.join(root, "out"); const slides = [{ title: "Kart", body: "Kaynak" }];
      await expect(renderYoutubeReview({ slides, pngPaths: [], outDir })).rejects.toThrow(/count/);
      await expect(renderYoutubeReview({ slides, pngPaths: [png], outDir })).rejects.toThrow(/signature/);
      expect(fs.existsSync(outDir)).toBe(false);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
});
