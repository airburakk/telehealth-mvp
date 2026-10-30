import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { createHash } from "node:crypto";
import { createWeeklyMediaHandler, writeWeeklyMedia } from "../../infra/kart/lib/weekly-media.mjs";
import { createWeeklyArchive } from "../../infra/kart/lib/weekly-draft-producer.mjs";
import serving from "../../infra/n8n/doctorium-weekly-media-serving-draft.json";
import writer from "../../infra/n8n/doctorium-weekly-media-writer-draft.json";
const hash = (b: Buffer) => createHash("sha256").update(b).digest("hex");
async function fixture(run: (root: string, base: string) => Promise<void>, enabled = true) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "weekly-serving-"));
  const handler = createWeeklyMediaHandler({ root, enabled, draftStagingAllowed: enabled });
  const server = http.createServer(async (req, res) => { if (!await handler(req, res)) { res.writeHead(404); res.end(); } });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try { await run(root, `http://127.0.0.1:${(server.address() as {port: number}).port}`); }
  finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); fs.rmSync(root, { recursive: true, force: true }); }
}
describe("separate weekly media, actual local HTTP and immutable filesystem", () => {
  it("does not serve or touch daily paths and defaults closed", () => fixture(async (_root, base) => {
    expect((await fetch(`${base}/weekly-media/weekly-${"a".repeat(64)}.mp4`)).status).toBe(503);
    expect((await fetch(`${base}/bulten/reels-a-2026-10-18.mp4`)).status).toBe(404);
  }, false));
  it("serves exact sealed bytes with explicit MIME, length, ETag and safe Range/HEAD", () => fixture(async (root, base) => {
    const bytes = Buffer.from('{"caption":"local fixture"}'), name = `weekly-${hash(bytes)}.json`;
    writeWeeklyMedia({ root, name, bytes });
    const url = `${base}/weekly-media/${name}`, r = await fetch(url);
    expect(r.status).toBe(200); expect(r.headers.get("content-type")).toBe("application/json"); expect(r.headers.get("etag")).toContain(hash(bytes)); expect(Buffer.from(await r.arrayBuffer())).toEqual(bytes);
    const head = await fetch(url, { method: "HEAD" }); expect(head.headers.get("content-length")).toBe(String(bytes.length)); expect(await head.text()).toBe("");
    const range = await fetch(url, { headers: { range: "bytes=2-6" } }); expect(range.status).toBe(206); expect(await range.text()).toBe(bytes.subarray(2, 7).toString());
    const suffix = await fetch(url, { headers: { range: "bytes=-4" } }); expect(await suffix.text()).toBe(bytes.subarray(-4).toString());
    expect((await fetch(url, { headers: { range: "bytes=999-1000" } })).status).toBe(416);
    expect((await fetch(url, { method: "POST" })).status).toBe(405);
  }));
  it("refuses hash mismatches, overwrite, unsealed and subsequently corrupted bytes", () => fixture(async (root, base) => {
    const bytes = Buffer.from("fixture"), name = `weekly-${hash(bytes)}.mp4`;
    expect(() => writeWeeklyMedia({ root, name, bytes: Buffer.from("different") })).toThrow("WEEKLY_MEDIA_INVALID");
    fs.writeFileSync(path.join(root, name), "corrupt");
    expect(() => writeWeeklyMedia({ root, name, bytes })).toThrow("WEEKLY_IMMUTABLE_WRITE_CONFLICT");
    expect((await fetch(`${base}/weekly-media/${name}`)).status).toBe(404);
    const other = Buffer.from("other fixture"), otherName = `weekly-${hash(other)}.srt`;
    writeWeeklyMedia({ root, name: otherName, bytes: other });
    fs.writeFileSync(path.join(root, otherName), Buffer.alloc(other.length));
    expect((await fetch(`${base}/weekly-media/${otherName}`)).status).toBe(404);
    expect((await fetch(`${base}/weekly-media/..%2Fsecret.json`)).status).toBe(404);
  }));
  it("roundtrips the archive writer through the real local reader before returning DRAFT media URLs", () => fixture(async (root, base) => {
    const file = path.join(root, "input.json"), bytes = Buffer.from('{"caption":"draft"}'); fs.writeFileSync(file, bytes);
    const archive = createWeeklyArchive({ root, publicBaseUrl: "https://weekly.example.test/", mappingVerified: true,
      fetchImpl: async (url: string | URL | Request) => fetch(`${base}/weekly-media/${new URL(String(url)).pathname.slice(1)}`) });
    const receipt = await archive([{ channel: "x", name: "post.json", sha256: hash(bytes), localPath: file }]);
    expect(receipt[0].url).toBe(`https://weekly.example.test/weekly-${hash(bytes)}.json`);
    expect(receipt[0].sha256).toBe(hash(bytes));
  }));
  it("keeps serving/writer exports inactive with blocked candidate nodes and no daily workflow access", () => {
    for (const flow of [serving, writer]) {
      expect(flow.active).toBe(false);
      const text = JSON.stringify(flow);
      expect(text).not.toMatch(/IjTiPqpVbOktWXBb|\/sosyal\/uret|\/data\/bulten\/\{\{|createPost|media_publish|access_token|Bearer/);
      const candidate = flow.nodes.find(n => n.id.includes("candidate"))!;
      expect("disabled" in candidate && candidate.disabled).toBe(true);
      expect(JSON.stringify(flow.connections)).not.toContain(candidate.name);
    }
  });
});
