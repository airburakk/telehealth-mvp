import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { renderVideoReviewAdaptations } from "../../infra/kart/lib/video-adaptations.mjs";
const mp4 = Buffer.concat([Buffer.alloc(4), Buffer.from("ftypisomfixture")]);
describe("one original video, five reviewed native-upload artifacts", () => {
  it("retains the common master, adapts LinkedIn without cropping foreground, and seals separate post data", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "weekly-adapt-"));
    try {
      const master = path.join(dir, "master.mp4"); fs.writeFileSync(master, mp4);
      const posts = Object.fromEntries(["facebook", "instagram", "linkedin", "x", "youtube"].map(c => [c, { caption: `Prepared ${c} caption`, isAiGenerated: false }]));
      const commands: unknown[][] = [];
      const out = await renderVideoReviewAdaptations({ masterPath: master, outDir: path.join(dir, "out"), posts,
        ffImpl: async (args: unknown[]) => { commands.push(args); fs.writeFileSync(String(args.at(-1)), Buffer.concat([mp4, Buffer.from("landscape")])); return ""; } });
      expect(out.assets).toHaveLength(10); expect(out.approved).toBe(false); expect(out.published).toBe(false);
      expect(new Set(out.assets.filter(a => a.name.endsWith(".mp4")).map(a => a.sourceMasterHash))).toEqual(new Set([out.masterVideoHash]));
      expect(commands).toHaveLength(1); expect(JSON.stringify(commands)).toContain("force_original_aspect_ratio=decrease");
      expect(fs.readFileSync(path.join(dir, "out/x/post.json"), "utf8")).toContain("Prepared x caption");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
  it("refuses missing channels and an implicit disclosure decision before creating output", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "weekly-adapt-"));
    try {
      const master = path.join(dir, "master.mp4"); fs.writeFileSync(master, mp4);
      await expect(renderVideoReviewAdaptations({ masterPath: master, outDir: path.join(dir, "out"), posts: {} })).rejects.toThrow();
      const posts = Object.fromEntries(["facebook", "instagram", "linkedin", "x", "youtube"].map(c => [c, { caption: "Prepared" }]));
      await expect(renderVideoReviewAdaptations({ masterPath: master, outDir: path.join(dir, "out"), posts })).rejects.toThrow(/disclosure/);
      expect(fs.existsSync(path.join(dir, "out"))).toBe(false);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});
