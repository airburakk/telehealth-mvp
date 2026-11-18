// kart dosya akışı — istemci erken kapanınca süreç DÜŞMEMELİ (2026-11-18, CI "kabul" çöküşü: ERR_STREAM_PREMATURE_CLOSE).
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { dosyaAkit } from "../../infra/kart/lib/dosya-akisi.mjs";

const temizlik: (() => void)[] = [];
afterEach(() => { while (temizlik.length) temizlik.pop()!(); });

function sunucu(yol: string, log: (s: string) => void) {
  const hatalar: unknown[] = [];
  const s = http.createServer(async (_req, res) => {
    res.writeHead(200, { "Content-Type": "application/octet-stream", "Content-Length": fs.statSync(yol).size });
    try { await dosyaAkit(yol, res, log); } catch (e) { hatalar.push(e); }
  });
  temizlik.push(() => s.close());
  return new Promise<{ port: number; hatalar: unknown[] }>((ok) => s.listen(0, () => ok({ port: (s.address() as net.AddressInfo).port, hatalar })));
}

function geciciDosya(boyut: number) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "dosya-akisi-"));
  temizlik.push(() => fs.rmSync(d, { recursive: true, force: true }));
  const yol = path.join(d, "buyuk.bin");
  fs.writeFileSync(yol, Buffer.alloc(boyut, 7));
  return yol;
}

describe("dosyaAkit", () => {
  it("tam indirmede gövde eksiksiz gelir", async () => {
    const yol = geciciDosya(200_000);
    const { port } = await sunucu(yol, () => {});
    const r = await fetch(`http://127.0.0.1:${port}/`);
    expect((await r.arrayBuffer()).byteLength).toBe(200_000);
  });

  it("istemci akışın ortasında kapanınca fırlatmaz, sunucu sonraki isteğe yanıt verir", async () => {
    const yol = geciciDosya(8 * 1024 * 1024);
    const loglar: string[] = [];
    const { port, hatalar } = await sunucu(yol, (s) => loglar.push(s));
    await new Promise<void>((ok) => {
      const c = net.connect(port, "127.0.0.1", () => c.write("GET / HTTP/1.1\r\nHost: x\r\n\r\n"));
      c.once("data", () => { c.destroy(); setTimeout(ok, 100); });   // ilk parçadan sonra bağlantıyı kopar
    });
    expect(hatalar).toEqual([]);
    expect(loglar).toEqual([]);   // erken kapanış olağan → günlüğe yazılmaz
    const r = await fetch(`http://127.0.0.1:${port}/`);
    expect(r.status).toBe(200);
    await r.arrayBuffer();
  });

  it("dosya okunamazsa fırlatmaz, hata kodunu günlüğe yazar", async () => {
    const yol = geciciDosya(10);
    const loglar: string[] = [];
    const s = http.createServer(async (_req, res) => {
      res.writeHead(200);
      await dosyaAkit(path.join(path.dirname(yol), "yok.bin"), res, (m: string) => loglar.push(m));
    });
    temizlik.push(() => s.close());
    await new Promise<void>((ok) => s.listen(0, () => ok()));
    const port = (s.address() as net.AddressInfo).port;
    await fetch(`http://127.0.0.1:${port}/`).then((r) => r.arrayBuffer()).catch(() => null);
    await new Promise((ok) => setTimeout(ok, 50));
    expect(loglar).toEqual(["dosya akışı kesildi: ENOENT"]);
  });
});
