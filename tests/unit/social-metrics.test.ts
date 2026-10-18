import { describe, expect, it } from "vitest";
import { MAX_ITEMS, parseSocialMetricsPayload, summarizeSocialMetrics, type SocialMetricRow } from "@/lib/social-metrics";

const TODAY = "2026-10-17";

describe("parseSocialMetricsPayload — n8n sözleşmesi", () => {
  it("tek kalem ve toplu biçim kabul edilir; null 'platform vermedi' olarak taşınır", () => {
    const one = parseSocialMetricsPayload({ platform: "x", day: TODAY, metrics: { followers: 51, saves: null } }, TODAY);
    expect(one).toEqual({ ok: true, items: [{ platform: "x", day: TODAY, metrics: { followers: 51, saves: null } }] });
    const many = parseSocialMetricsPayload({ items: [
      { platform: "instagram", day: "2026-10-15", metrics: { reach: 900 } },
      { platform: "facebook", day: "2026-10-16", metrics: { likes: 3 } },
    ] }, TODAY);
    expect(many.ok && many.items).toHaveLength(2);
  });

  it.each([
    [{ platform: "tiktok", day: TODAY, metrics: { likes: 1 } }, "platform"],
    [{ platform: "x", day: "2026-02-30", metrics: { likes: 1 } }, "geçerli gün"],
    [{ platform: "x", day: "2026-10-18", metrics: { likes: 1 } }, "gelecek gün"],
    [{ platform: "x", day: "2025-01-01", metrics: { likes: 1 } }, "günden eski"],
    [{ platform: "x", day: TODAY, metrics: {} }, "en az bir"],
    [{ platform: "x", day: TODAY, metrics: { impressions: 5 } }, "bilinmeyen ölçü"],
    [{ platform: "x", day: TODAY, metrics: { likes: -1 } }, "tam sayı"],
    [{ platform: "x", day: TODAY, metrics: { likes: 1.5 } }, "tam sayı"],
    [{ platform: "x", day: TODAY, metrics: { likes: "3" } }, "tam sayı"],
    [{ platform: "x", day: TODAY, metrics: { likes: 1 }, raw: {} }, null],
  ])("reddeder: %j", (item, msg) => {
    const r = parseSocialMetricsPayload(item, TODAY);
    if (msg === null) {
      // Kalem düzeyinde fazladan alan (raw) dikkate alınmaz, yazılmaz — yalnız `metrics` taşınır.
      expect(r.ok && r.items[0]).toEqual({ platform: "x", day: TODAY, metrics: { likes: 1 } });
    } else {
      expect(r.ok).toBe(false);
      expect(!r.ok && r.error).toContain(msg);
    }
  });

  it("aynı platform+gün iki kez gelirse ve sınır aşılırsa reddeder", () => {
    const dup = parseSocialMetricsPayload({ items: [
      { platform: "x", day: TODAY, metrics: { likes: 1 } },
      { platform: "x", day: TODAY, metrics: { saves: 1 } },
    ] }, TODAY);
    expect(!dup.ok && dup.error).toContain("iki kez");
    const big = parseSocialMetricsPayload({ items: Array.from({ length: MAX_ITEMS + 1 }, () => ({})) }, TODAY);
    expect(!big.ok && big.error).toContain(`${MAX_ITEMS}`);
    expect(parseSocialMetricsPayload({ items: [] }, TODAY).ok).toBe(false);
    expect(parseSocialMetricsPayload("metin", TODAY).ok).toBe(false);
  });
});

const row = (platform: string, day: string, m: Partial<SocialMetricRow> = {}): SocialMetricRow => ({
  platform, day, followers: null, reach: null, views: null, likes: null, comments: null, saves: null, shares: null, profileClicks: null, posts: null, ...m,
});

describe("summarizeSocialMetrics — pano dönem özeti", () => {
  it("7 günlük pencere: toplamlar, son takipçi ve fark; pencere dışı satır girmez", () => {
    const s = summarizeSocialMetrics([
      row("x", "2026-10-17", { followers: 55, reach: 40, likes: 2 }),
      row("x", "2026-10-11", { followers: 51, reach: 30, likes: null }),
      row("x", "2026-10-10", { followers: 40, reach: 999 }), // pencere dışı (8 gün önce)
    ], TODAY);
    expect(s.x).toMatchObject({ connected: true, lastDay: "2026-10-17", followers: 55, followersDelta: 4 });
    expect(s.x.totals).toMatchObject({ reach: 70, likes: 2, saves: null });
  });

  it("verisi olmayan platform bağlı değil ve tüm alanları null; tek takipçi değerinde fark null", () => {
    const s = summarizeSocialMetrics([row("instagram", TODAY, { followers: 80 })], TODAY);
    expect(s.instagram).toMatchObject({ connected: true, followers: 80, followersDelta: null });
    expect(s.youtube).toMatchObject({ connected: false, lastDay: null, followers: null });
    expect(Object.values(s.youtube.totals).every((v) => v === null)).toBe(true);
  });

  it("bilinmeyen platform satırı yok sayılır; gelecek gün satırı pencereye girmez", () => {
    const s = summarizeSocialMetrics([row("tiktok", TODAY, { likes: 5 }), row("facebook", "2026-10-18", { likes: 9 })], TODAY);
    expect(s.facebook.connected).toBe(false);
  });
});
