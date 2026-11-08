import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchTitckRecallItems, parseTitckRecallFeed, TITCK_RECALL_FEED_URL,
  TITCK_RECALL_MAX_BYTES, TITCK_RECALL_TIMEOUT_MS,
} from "@/lib/titck-recalls";

const now = new Date("2026-11-08T22:00:00Z");
const item = (id = 5394, extra: Partial<Record<"title" | "url" | "summary" | "date" | "category", string>> = {}) =>
  `<item><title>${extra.title ?? `Kamuoyunun Dikkatine - ${id}`}</title><description>${extra.summary ?? "DUYURU"}</description>
  <pubDate>${extra.date ?? "Tue, 03 Nov 2026 15:24:07 GMT"}</pubDate><link>${extra.url ?? `https://www.titck.gov.tr/duyuru/${id}`}</link>
  <category>${extra.category ?? "Blokaj ve İlaç Geri Çekme Duyuruları"}</category></item>`;
const feed = (...items: string[]) => `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel>
  <title>Türkiye İlaç ve Tıbbi Cihaz Kurumu</title><description>Türkiye İlaç ve Tıbbi Cihaz Kurumu</description>${items.join("")}</channel></rss>`;
const response = (body = feed(item())) => new Response(body, { headers: { "content-type": "application/xml" } });
afterEach(() => vi.useRealTimers());

describe("TİTCK official recall metadata contract", () => {
  it("retains generic official headlines, numeric identity and actual dates without clinical extrapolation", () => {
    const rows = parseTitckRecallFeed(feed(item()), now);
    expect(rows).toEqual([{ id: "5394", title: "Kamuoyunun Dikkatine - 5394", summary: "DUYURU",
      url: "https://www.titck.gov.tr/duyuru/5394", publishedAt: new Date("2026-11-03T15:24:07Z") }]);
    expect(rows[0]).not.toHaveProperty("clinicalReview");
  });
  it("bounds the daily window and deduplicates the stable numeric identity", () => {
    expect(parseTitckRecallFeed(feed(...Array.from({ length: 30 }, (_, i) => item(5000 + i))), now)).toHaveLength(20);
    expect(parseTitckRecallFeed(feed(item(), item()), now)).toHaveLength(1);
  });
  it("strips HTML and decodes safe entities without fetching any links", () => {
    const row = parseTitckRecallFeed(feed(item(1, { title: "<![CDATA[İlaç <b>Geri</b> Çekme &#x130; &amp; Bildirim]]>", summary: "&lt;img src=x onerror=x&gt;Duyuru" })), now)[0];
    expect(row.title).toBe("İlaç Geri Çekme İ & Bildirim");
    expect(row.summary).toBe("Duyuru");
  });
  it("rejects missing/invalid/future publication dates instead of substituting today", () => {
    for (const date of ["", "not a date", "Tue, 03 Nov 2027 15:24:07 GMT", "03.11.2026", "Tue, 31 Feb 2026 15:24:07 GMT"])
      expect(() => parseTitckRecallFeed(feed(item(1, { date })), now)).toThrow("titck-feed-invalid-item");
  });
  it("rejects external URLs, credentials, redirects, malformed items and wrong categories", () => {
    for (const url of ["http://www.titck.gov.tr/duyuru/1", "https://www.titck.gov.tr.evil.invalid/duyuru/1",
      "https://user:pass@www.titck.gov.tr/duyuru/1", "https://www.titck.gov.tr/duyuru/1?next=https://evil.invalid",
      "https://www.titck.gov.tr/duyuru/slug", "javascript:alert(1)"])
      expect(() => parseTitckRecallFeed(feed(item(1, { url })), now)).toThrow("titck-feed-invalid-item");
    expect(() => parseTitckRecallFeed(feed(item(1, { category: "Haber" })), now)).toThrow("titck-feed-invalid-item");
    expect(() => parseTitckRecallFeed(feed(item().replace("</item>", "")), now)).toThrow("titck-feed-invalid-items");
    expect(() => parseTitckRecallFeed(feed(item().replace("<link>", "<link>https://evil.invalid</link><link>")), now)).toThrow("titck-feed-invalid-item");
  });
  it("rejects login/error HTML, empty feeds, unexpected publishers, XML entities and excessive bodies", () => {
    for (const bad of ["<html><title>Login</title></html>", feed(), feed(item()).replace("<title>Türkiye", "<title>Other Türkiye"),
      '<!DOCTYPE rss [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>' + feed(item())])
      expect(() => parseTitckRecallFeed(bad, now)).toThrow(/titck-feed-/);
    expect(() => parseTitckRecallFeed("a".repeat(TITCK_RECALL_MAX_BYTES + 1), now)).toThrow("titck-feed-too-large");
  });
});

describe("bounded fixed-origin fetch", () => {
  it("only requests the verified feed without credentials, redirects or item detail reads", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response());
    expect(await fetchTitckRecallItems(fetcher, now)).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(TITCK_RECALL_FEED_URL, expect.objectContaining({ redirect: "manual", credentials: "omit", cache: "no-store" }));
  });
  it("rejects redirects, non-XML responses, declared oversized and streamed oversized bodies", async () => {
    for (const res of [new Response(null, { status: 302, headers: { location: "https://evil.invalid" } }),
      new Response("not xml", { headers: { "content-type": "text/html" } }),
      new Response("x", { headers: { "content-type": "application/xml", "content-length": String(TITCK_RECALL_MAX_BYTES + 1) } }),
      response("x".repeat(TITCK_RECALL_MAX_BYTES + 1))]) {
      await expect(fetchTitckRecallItems(vi.fn<typeof fetch>().mockResolvedValue(res), now)).rejects.toThrow(/titck-feed-/);
    }
  });
  it("aborts an unresponsive request within its independent time budget", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>().mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
    }));
    const promise = fetchTitckRecallItems(fetcher, now);
    const rejected = expect(promise).rejects.toThrow("aborted");
    await vi.advanceTimersByTimeAsync(TITCK_RECALL_TIMEOUT_MS);
    await rejected;
  });
});
