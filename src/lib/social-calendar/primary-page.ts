// Bounded HTTPS reader for curated public primary URLs. No redirects, cookies, credentials, or private IPs.
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";

export function publicAddress(address: string): boolean {
  if (isIP(address) === 6) {
    // Only global unicast; exclude IPv4-mapped, local, multicast, documentation, and transition ranges.
    return /^[23][0-9a-f]{3}:/i.test(address) && !/^(?:2001:|2002:|3fff:)/i.test(address);
  }
  if (isIP(address) !== 4) return false;
  const [a, b, c] = address.split(".").map(Number) as [number, number, number];
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 2)))
    || (a === 192 && b === 88 && c === 99) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)))
    || (a === 203 && b === 0 && c === 113));
}

async function readPrimaryBytes(raw: string, mime: string, maxBytes: number): Promise<Buffer> {
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") || isIP(url.hostname)) {
    throw new Error("primary-url-rejected");
  }
  // Deadline covers DNS, headers AND body. Pin the checked DNS result in the actual TLS request.
  const signal = AbortSignal.timeout(4000);
  const addresses = await Promise.race([
    lookup(url.hostname, { all: true }),
    new Promise<never>((_, reject) => signal.addEventListener("abort", () => reject(new Error("primary-timeout")), { once: true })),
  ]);
  if (!addresses.length || addresses.some((a) => !publicAddress(a.address))) throw new Error("primary-address-rejected");
  const target = addresses[0]!;
  return new Promise((resolve, reject) => {
    const req = request(url, {
      signal, method: "GET", agent: false, family: target.family,
      lookup: (_hostname, _options, callback) => callback(null, target.address, target.family),
      headers: { "User-Agent": "Doctorium-Source-Check/1.0", Accept: mime, "Accept-Encoding": "identity" },
    }, (res) => {
      if (res.statusCode !== 200 || (res.headers["content-type"] ?? "").split(";")[0]!.trim().toLowerCase() !== mime
        || (res.headers["content-encoding"] && res.headers["content-encoding"] !== "identity")) {
        res.destroy(); reject(new Error("primary-response-rejected")); return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) { res.destroy(new Error("primary-page-too-large")); return; }
        chunks.push(chunk);
      });
      res.on("error", reject);
      res.on("end", () => resolve(Buffer.concat(chunks)));
    });
    req.on("error", reject);
    req.end();
  });
}

export async function readPrimaryPage(raw: string): Promise<string> {
  return (await readPrimaryBytes(raw, "text/html", 512_000)).toString("utf8");
}

export async function readPrimaryPdf(raw: string): Promise<Buffer> {
  const bytes = await readPrimaryBytes(raw, "application/pdf", 1_500_000);
  if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("primary-pdf-rejected");
  return bytes;
}
