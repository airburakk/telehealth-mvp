// Birim — v6.307 (2026-10-02): RSS kimlik geçişi. 1438e05 ingestRss kimliğini link → guid yaptı ama eski satırları taşımadı;
// 30 Eylül gecesi dernek beslemelerinde pencere içindeki eski kalemler yeniden yaratıldı (üretimde KLİMİK 7 çift).
// Kilitler: (1) eski link-anahtarlı satır varken YENİ SATIR AÇILMAZ, anahtar guid'e taşınır; (2) guid'siz beslemede fazladan
// sorgu yok; (3) dry-run yazmaz ama "yeni" de saymaz; (4) ikiz tarayıcı yalnız beklenen kalıbı onarılabilir sayar.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/db", () => ({ db: { newsArticle: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() } } }));
vi.mock("@/lib/translate-news", () => ({ translateTitlesTr: vi.fn(async (t: string[]) => t.map(() => null)) }));

import { db } from "@/lib/db";
import { adoptLegacyRssKey, ingestRss, type RssSourceDef } from "@/lib/doctorium-sources";
import { legacyRssKey, rssExternalId, scanRssTwins, type TwinRow } from "@/lib/rss-twins";

const findUnique = vi.mocked(db.newsArticle.findUnique);
const update = vi.mocked(db.newsArticle.update);
const create = vi.mocked(db.newsArticle.create);

/** Sahte tablo: (source, externalId) → id. findUnique bileşik anahtarı buradan yanıtlar. */
let store: Map<string, string>;
const key = (source: string, externalId: string) => `${source}|${externalId}`;

beforeEach(() => {
  store = new Map();
  findUnique.mockReset().mockImplementation((async (args: { where: { source_externalId: { source: string; externalId: string } } }) => {
    const { source, externalId } = args.where.source_externalId;
    const id = store.get(key(source, externalId));
    return id ? { id } : null;
  }) as never);
  update.mockReset().mockResolvedValue({} as never);
  create.mockReset().mockResolvedValue({} as never);
});
afterEach(() => vi.unstubAllGlobals());

describe("kimlik kuralı (lib/rss-twins)", () => {
  it("güncel kimlik = varsa guid, yoksa link; eski kimlik = link; ikisi de sondan 180 karakter", () => {
    expect(rssExternalId("https://klimik.org.tr/?p=209912", "https://klimik.org.tr/2026/10/02/yazi/")).toBe("https://klimik.org.tr/?p=209912");
    expect(rssExternalId("", "https://www.medscape.com/viewarticle/1")).toBe("https://www.medscape.com/viewarticle/1");
    const uzun = `https://ornek.org/${"a".repeat(300)}`;
    expect(legacyRssKey(uzun)).toHaveLength(180);
    expect(legacyRssKey(uzun)).toBe(uzun.slice(-180));
    expect(rssExternalId("", uzun)).toBe(legacyRssKey(uzun));
  });
});

describe("adoptLegacyRssKey", () => {
  it("guid'siz besleme (eski = güncel anahtar): sorgu ATILMAZ", async () => {
    expect(await adoptLegacyRssKey("medscape", "link-1", "link-1")).toBe("none");
    expect(findUnique).not.toHaveBeenCalled();
  });
  it("guid-anahtarlı satır zaten var → current, taşıma yok", async () => {
    store.set(key("klimik", "guid-1"), "a1").set(key("klimik", "link-1"), "a0");
    expect(await adoptLegacyRssKey("klimik", "link-1", "guid-1")).toBe("current");
    expect(update).not.toHaveBeenCalled();
  });
  it("yalnız link-anahtarlı ESKİ satır var → anahtarı guid'e taşınır", async () => {
    store.set(key("klimik", "link-1"), "a0");
    expect(await adoptLegacyRssKey("klimik", "link-1", "guid-1")).toBe("adopted");
    expect(update).toHaveBeenCalledWith({ where: { id: "a0" }, data: { externalId: "guid-1" } });
  });
  it("dry-run: aynı yanıt, YAZMADAN", async () => {
    store.set(key("klimik", "link-1"), "a0");
    expect(await adoptLegacyRssKey("klimik", "link-1", "guid-1", true)).toBe("adopted");
    expect(update).not.toHaveBeenCalled();
  });
  it("ikisi de yok → none (kalem gerçekten yeni)", async () => {
    expect(await adoptLegacyRssKey("klimik", "link-1", "guid-1")).toBe("none");
    expect(update).not.toHaveBeenCalled();
  });
});

describe("ingestRss — eski kalem yeniden YARATILMAZ", () => {
  const DEF: RssSourceDef = { source: "klimik", sourceName: "KLİMİK Derneği", url: "https://www.klimik.org.tr/feed/", category: "meslek", collectImages: false, filter: () => true };
  const item = (title: string, link: string, guid: string) =>
    `<item><title>${title}</title><link>${link}</link><guid isPermaLink="false">${guid}</guid><pubDate>Mon, 28 Sep 2026 09:00:00 +0000</pubDate><description><![CDATA[Özet metni]]></description></item>`;
  const ESKI = { title: "Bugün 28 Eylül 2026 Dünya Kuduz Günü", link: "https://www.klimik.org.tr/2026/09/28/dunya-kuduz-gunu/", guid: "https://www.klimik.org.tr/?p=209001" };
  const YENI = { title: "KLİMİK Dergisi’nin Eylül 2026 Sayısı Yayında!", link: "https://www.klimik.org.tr/2026/09/29/dergi-eylul/", guid: "https://www.klimik.org.tr/?p=209500" };
  const feed = `<?xml version="1.0"?><rss><channel>${item(YENI.title, YENI.link, YENI.guid)}${item(ESKI.title, ESKI.link, ESKI.guid)}</channel></rss>`;
  const stubFeed = () => vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, text: async () => feed })));

  it("link-anahtarlı eski satır guid'e taşınır; yalnız gerçekten yeni kalem yazılır", async () => {
    store.set(key("klimik", legacyRssKey(ESKI.link)), "eski-satir");
    stubFeed();
    const [scanned, created] = await ingestRss(DEF);
    expect([scanned, created]).toEqual([2, 1]);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({ where: { id: "eski-satir" }, data: { externalId: ESKI.guid } });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].data).toMatchObject({ source: "klimik", externalId: YENI.guid, url: YENI.link, title: YENI.title });
  });
  it("ikinci gece: iki kalem de guid'le bulunur → ne taşıma ne yeni kayıt", async () => {
    store.set(key("klimik", ESKI.guid), "eski-satir").set(key("klimik", YENI.guid), "yeni-satir");
    stubFeed();
    expect(await ingestRss(DEF)).toEqual([2, 0]);
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
  it("dry-run: eski kalem 'yeni' SAYILMAZ, hiçbir şey yazılmaz", async () => {
    store.set(key("klimik", legacyRssKey(ESKI.link)), "eski-satir");
    stubFeed();
    const lines: string[] = [];
    expect(await ingestRss(DEF, { dryRun: true, onItem: (l) => lines.push(l) })).toEqual([2, 1]);
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("KLİMİK Dergisi");
  });
});

describe("scanRssTwins — tek seferlik temizliğin karar kuralı", () => {
  const URL_A = "https://www.klimik.org.tr/2026/09/25/asi-takvimi/";
  const row = (id: string, externalId: string, url: string | null, day: string, source = "klimik"): TwinRow =>
    ({ id, source, externalId, url, createdAt: new Date(`${day}T02:35:00Z`) });

  it("link-anahtarlı eski + guid-anahtarlı yeni = onarılabilir çift (eski kalır, ikiz düşer)", () => {
    const scan = scanRssTwins([row("eski", legacyRssKey(URL_A), URL_A, "2026-09-26"), row("ikiz", "https://www.klimik.org.tr/?p=1", URL_A, "2026-09-30")]);
    expect(scan.odd).toEqual([]);
    expect(scan.pairs).toHaveLength(1);
    expect(scan.pairs[0].keep.id).toBe("eski");
    expect(scan.pairs[0].drop.id).toBe("ikiz");
  });
  it("tekil satırlar, URL'siz satırlar ve farklı kaynaktaki aynı URL çift SAYILMAZ", () => {
    const scan = scanRssTwins([
      row("a", legacyRssKey(URL_A), URL_A, "2026-09-26"),
      row("b", "https://www.klimik.org.tr/?p=2", "https://www.klimik.org.tr/2026/09/29/baska/", "2026-09-30"),
      row("c", "x", null, "2026-09-30"),
      row("d", "https://tjod.org/?p=9", URL_A, "2026-09-30", "tjod"),
    ]);
    expect(scan).toEqual({ pairs: [], odd: [] });
  });
  it("kalıp dışı gruplar DOKUNULMAZ listesine düşer (üç satır · link-anahtarlısı yok · sıra ters)", () => {
    const uc = scanRssTwins([row("1", legacyRssKey(URL_A), URL_A, "2026-09-26"), row("2", "g2", URL_A, "2026-09-30"), row("3", "g3", URL_A, "2026-10-01")]);
    expect(uc.pairs).toEqual([]);
    expect(uc.odd[0].reason).toContain("3 satır");
    const yok = scanRssTwins([row("1", "g1", URL_A, "2026-09-26"), row("2", "g2", URL_A, "2026-09-30")]);
    expect(yok.pairs).toEqual([]);
    expect(yok.odd[0].reason).toContain("link-anahtarlı satır yok");
    const ters = scanRssTwins([row("1", legacyRssKey(URL_A), URL_A, "2026-10-01"), row("2", "g2", URL_A, "2026-09-30")]);
    expect(ters.pairs).toEqual([]);
    expect(ters.odd[0].reason).toContain("daha YENİ");
  });
});
