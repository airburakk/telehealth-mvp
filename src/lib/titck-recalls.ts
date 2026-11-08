/** TİTCK's public RSS 2.0 feed, linked from its official announcement page.
 * Direct HTTPS validation: 2026-11-08. Only recall/blockage announcement metadata;
 * this is not all TİTCK news, a product database, or an automated clinical instruction.
 */
export const TITCK_RECALL_FEED_URL = "https://www.titck.gov.tr/recallAnnouncementFeeds";
export const TITCK_RECALL_SOURCE = "titck-recalls";
export const TITCK_RECALL_LIMIT = 20;
export const TITCK_RECALL_MAX_BYTES = 2 * 1024 * 1024;
export const TITCK_RECALL_TIMEOUT_MS = 12_000;
export interface TitckRecallItem {
  id: string;
  title: string;
  url: string;
  summary: string;
  publishedAt: Date;
}

function text(value: string): string {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]*>/g, " ")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n: string) => {
      const cp = n[0].toLowerCase() === "x" ? parseInt(n.slice(1), 16) : Number(n);
      return cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff) ? String.fromCodePoint(cp) : " ";
    })
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&")
    .replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/** Pure, fail-closed RSS contract. Never substitutes today's date, infers a recall
 * scope from a headline, follows an item URL, or trusts external XML entities. */
export function parseTitckRecallFeed(xml: string, now = new Date()): TitckRecallItem[] {
  if (new TextEncoder().encode(xml).length > TITCK_RECALL_MAX_BYTES) throw new Error("titck-feed-too-large");
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || !/<rss\b[^>]*version=["']2\.0["']/i.test(xml) ||
    !/<channel\b[^>]*>[\s\S]*<\/channel>\s*<\/rss>\s*$/i.test(xml)) throw new Error("titck-feed-invalid-rss");
  const header = xml.split(/<item\b/i)[0];
  const publisher = text(header.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  if (publisher !== "Türkiye İlaç ve Tıbbi Cihaz Kurumu") throw new Error("titck-feed-wrong-publisher");
  const blocks = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(m => m[1]);
  if (!blocks.length || blocks.length > 2000 || (xml.match(/<item\b/gi)?.length ?? 0) !== blocks.length) throw new Error("titck-feed-invalid-items");
  const items: TitckRecallItem[] = [];
  const seen = new Set<string>();
  for (const block of blocks.slice(0, TITCK_RECALL_LIMIT)) {
    const pick = (tag: string) => {
      const matches = [...block.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi"))];
      if (matches.length !== 1) throw new Error("titck-feed-invalid-item");
      return text(matches[0][1]);
    };
    const title = pick("title"), url = pick("link"), summary = pick("description"), date = pick("pubDate"), category = pick("category");
    // The official feed supplies stable numeric links, verified to resolve to article pages.
    const match = /^https:\/\/www\.titck\.gov\.tr\/duyuru\/([1-9]\d{0,9})$/.exec(url);
    const publishedAt = new Date(date);
    if (!match || !title || title.length > 300 || summary.length > 2000 ||
      category !== "Blokaj ve İlaç Geri Çekme Duyuruları" ||
      !/^[A-Za-z]{3}, \d{1,2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(date) ||
      !Number.isFinite(publishedAt.getTime()) || publishedAt.toUTCString() !== date ||
      publishedAt.getUTCFullYear() < 2000 || publishedAt > now) {
      throw new Error("titck-feed-invalid-item");
    }
    if (seen.has(match[1])) continue;
    seen.add(match[1]);
    items.push({ id: match[1], title, url, summary: summary.slice(0, 500), publishedAt });
  }
  if (!items.length) throw new Error("titck-feed-empty");
  return items;
}

/** Fixed origin, no cookies, no credentials, no redirects or secondary requests.
 * Timeout covers the body as well as headers; declared and streamed sizes are bounded. */
export async function fetchTitckRecallItems(fetcher: typeof fetch = fetch, now = new Date()): Promise<TitckRecallItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TITCK_RECALL_TIMEOUT_MS);
  try {
    const response = await fetcher(TITCK_RECALL_FEED_URL, {
      cache: "no-store", redirect: "manual", credentials: "omit", signal: controller.signal,
      headers: { Accept: "application/rss+xml,application/xml,text/xml", "User-Agent": "Doctorium-Source-Monitor/1.0" },
    });
    if (response.status !== 200) { await response.body?.cancel(); throw new Error(`titck-feed-http-${response.status}`); }
    if (!/^(?:application\/(?:rss\+xml|xml)|text\/xml)(?:;|$)/i.test(response.headers.get("content-type") ?? "")) {
      await response.body?.cancel(); throw new Error("titck-feed-content-type");
    }
    if (Number(response.headers.get("content-length") ?? 0) > TITCK_RECALL_MAX_BYTES) {
      await response.body?.cancel(); throw new Error("titck-feed-too-large");
    }
    if (!response.body) throw new Error("titck-feed-empty");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > TITCK_RECALL_MAX_BYTES) { await reader.cancel(); throw new Error("titck-feed-too-large"); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return parseTitckRecallFeed(new TextDecoder("utf-8", { fatal: true }).decode(bytes), now);
  } finally { clearTimeout(timeout); }
}
