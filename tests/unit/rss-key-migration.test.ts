// Birim — RSS kimliği (v6.307 + v6.309, 2026-10-02).
// v6.307: 1438e05 ingestRss kimliğini link → guid yaptı ama eski satırları taşımadı; 30 Eylül gecesi dernek beslemelerinde
//   pencere içindeki eski kalemler yeniden yaratıldı (üretimde 32 çift). Kilitler: eski link-anahtarlı satır varken YENİ SATIR
//   AÇILMAZ, anahtar guid'e taşınır · guid'siz beslemede fazladan sorgu yok · dry-run yazmaz · ikiz tarayıcı karar kuralı.
// v6.309: (a) guid kimliğinin açtığı boşluk — KLİMİK haftalık bülteni tek yazı, her hafta yeniden adlandırılıp yeniden
//   tarihleniyor → yeni sayı "zaten var" sayılıp akışa düşmüyordu. Kilit: başlık + adres birlikte değişince eski sayı arşivlenir
//   ve yeni kayıt doğar; yalnız adres değişirse (tarih kayması) kayıt çiftlenmez, adresi güncellenir.
//   (b) "aynı başlık / farklı URL" temizliğinin karar kuralı: yalnız üç kanıt sınıfında silinir, başlık tek başına kimlik değildir.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/db", () => ({ db: { newsArticle: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() } } }));
vi.mock("@/lib/translate-news", () => ({ translateTitlesTr: vi.fn(async (t: string[]) => t.map(() => null)) }));

import { db } from "@/lib/db";
import { adoptLegacyRssKey, ingestRss, syncRssEdition, type RssSourceDef } from "@/lib/doctorium-sources";
import {
  archivedRssKey, decideRedated, legacyRssKey, normalizeArticleUrl, rssExternalId, scanRssTwins, scanSameTitle,
  type TwinRow, type UrlResolution,
} from "@/lib/rss-twins";

const findUnique = vi.mocked(db.newsArticle.findUnique);
const update = vi.mocked(db.newsArticle.update);
const create = vi.mocked(db.newsArticle.create);

/** Sahte NewsArticle tablosu: findUnique bileşik anahtarla (select'e saygılı) okur, update/create tabloyu GERÇEKTEN değiştirir. */
type FakeRow = { id: string; source: string; externalId: string; title: string; titleOriginal: string | null; url: string | null };
let table: FakeRow[];
const put = (r: Pick<FakeRow, "id" | "source" | "externalId"> & Partial<FakeRow>) => { table.push({ title: "başlık", titleOriginal: null, url: null, ...r }); };

beforeEach(() => {
  table = [];
  findUnique.mockReset().mockImplementation((async (args: { where: { source_externalId: { source: string; externalId: string } }; select: Record<string, boolean> }) => {
    const { source, externalId } = args.where.source_externalId;
    const r = table.find((x) => x.source === source && x.externalId === externalId);
    return r ? Object.fromEntries(Object.keys(args.select).map((k) => [k, r[k as keyof FakeRow]])) : null;
  }) as never);
  update.mockReset().mockImplementation((async (args: { where: { id: string }; data: Partial<FakeRow> }) => {
    const r = table.find((x) => x.id === args.where.id);
    if (r) Object.assign(r, args.data);
    return r;
  }) as never);
  create.mockReset().mockImplementation((async (args: { data: Omit<FakeRow, "id"> }) => {
    const r = { ...args.data, id: `yeni-${table.length + 1}` };
    table.push(r);
    return r;
  }) as never);
});
afterEach(() => vi.unstubAllGlobals());

const stubFeed = (xml: string) => vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, text: async () => xml })));
const item = (title: string, link: string, guid: string) =>
  `<item><title>${title}</title><link>${link}</link><guid isPermaLink="false">${guid}</guid><pubDate>Mon, 28 Sep 2026 09:00:00 +0000</pubDate><description><![CDATA[Özet metni]]></description></item>`;
const feedOf = (...items: string[]) => `<?xml version="1.0"?><rss><channel>${items.join("")}</channel></rss>`;
const KLIMIK: RssSourceDef = { source: "klimik", sourceName: "KLİMİK Derneği", url: "https://www.klimik.org.tr/feed/", category: "meslek", collectImages: false, filter: () => true };

describe("kimlik kuralı (lib/rss-twins)", () => {
  it("güncel kimlik = varsa guid, yoksa link; eski kimlik = link; ikisi de sondan 180 karakter", () => {
    expect(rssExternalId("https://klimik.org.tr/?p=209912", "https://klimik.org.tr/2026/10/02/yazi/")).toBe("https://klimik.org.tr/?p=209912");
    expect(rssExternalId("", "https://www.medscape.com/viewarticle/1")).toBe("https://www.medscape.com/viewarticle/1");
    const uzun = `https://ornek.org/${"a".repeat(300)}`;
    expect(legacyRssKey(uzun)).toHaveLength(180);
    expect(legacyRssKey(uzun)).toBe(uzun.slice(-180));
    expect(rssExternalId("", uzun)).toBe(legacyRssKey(uzun));
  });
  it("arşiv anahtarı satır id'sini taşır → ne guid ne link anahtarıyla çakışır", () => {
    expect(archivedRssKey("https://www.klimik.org.tr/?p=118339", "ckx1")).toBe("https://www.klimik.org.tr/?p=118339#ckx1");
  });
});

describe("adoptLegacyRssKey", () => {
  it("guid'siz besleme (eski = güncel anahtar): sorgu ATILMAZ", async () => {
    expect(await adoptLegacyRssKey("medscape", "link-1", "link-1")).toBe("none");
    expect(findUnique).not.toHaveBeenCalled();
  });
  it("guid-anahtarlı satır zaten var → current, taşıma yok", async () => {
    put({ id: "a1", source: "klimik", externalId: "guid-1" });
    put({ id: "a0", source: "klimik", externalId: "link-1" });
    expect(await adoptLegacyRssKey("klimik", "link-1", "guid-1")).toBe("current");
    expect(update).not.toHaveBeenCalled();
  });
  it("yalnız link-anahtarlı ESKİ satır var → anahtarı guid'e taşınır", async () => {
    put({ id: "a0", source: "klimik", externalId: "link-1" });
    expect(await adoptLegacyRssKey("klimik", "link-1", "guid-1")).toBe("adopted");
    expect(update).toHaveBeenCalledWith({ where: { id: "a0" }, data: { externalId: "guid-1" } });
  });
  it("dry-run: aynı yanıt, YAZMADAN", async () => {
    put({ id: "a0", source: "klimik", externalId: "link-1" });
    expect(await adoptLegacyRssKey("klimik", "link-1", "guid-1", true)).toBe("adopted");
    expect(update).not.toHaveBeenCalled();
  });
  it("ikisi de yok → none (kalem gerçekten yeni)", async () => {
    expect(await adoptLegacyRssKey("klimik", "link-1", "guid-1")).toBe("none");
    expect(update).not.toHaveBeenCalled();
  });
});

describe("ingestRss — eski kalem yeniden YARATILMAZ (v6.307)", () => {
  const ESKI = { title: "Bugün 28 Eylül 2026 Dünya Kuduz Günü", link: "https://www.klimik.org.tr/2026/09/28/dunya-kuduz-gunu/", guid: "https://www.klimik.org.tr/?p=209001" };
  const YENI = { title: "KLİMİK Dergisi’nin Eylül 2026 Sayısı Yayında!", link: "https://www.klimik.org.tr/2026/09/29/dergi-eylul/", guid: "https://www.klimik.org.tr/?p=209500" };
  const feed = feedOf(item(YENI.title, YENI.link, YENI.guid), item(ESKI.title, ESKI.link, ESKI.guid));

  it("link-anahtarlı eski satır guid'e taşınır; yalnız gerçekten yeni kalem yazılır", async () => {
    put({ id: "eski-satir", source: "klimik", externalId: legacyRssKey(ESKI.link), title: ESKI.title, url: ESKI.link });
    stubFeed(feed);
    expect(await ingestRss(KLIMIK)).toEqual([2, 1]);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({ where: { id: "eski-satir" }, data: { externalId: ESKI.guid } });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].data).toMatchObject({ source: "klimik", externalId: YENI.guid, url: YENI.link, title: YENI.title });
  });
  it("ikinci gece: iki kalem de guid'le bulunur → ne taşıma ne yeni kayıt", async () => {
    put({ id: "eski-satir", source: "klimik", externalId: ESKI.guid, title: ESKI.title, url: ESKI.link });
    put({ id: "yeni-satir", source: "klimik", externalId: YENI.guid, title: YENI.title, url: YENI.link });
    stubFeed(feed);
    expect(await ingestRss(KLIMIK)).toEqual([2, 0]);
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
  it("dry-run: eski kalem 'yeni' SAYILMAZ, hiçbir şey yazılmaz", async () => {
    put({ id: "eski-satir", source: "klimik", externalId: legacyRssKey(ESKI.link), title: ESKI.title, url: ESKI.link });
    stubFeed(feed);
    const lines: string[] = [];
    expect(await ingestRss(KLIMIK, { dryRun: true, onItem: (l) => lines.push(l) })).toEqual([2, 1]);
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("KLİMİK Dergisi");
  });
});

describe("yeni sayı / tarih kayması — syncRssEdition + ingestRss (v6.309)", () => {
  // KLİMİK haftalık bülteni: TEK yazı (guid sabit), her hafta başlığı + tarihi (dolayısıyla adresi) değişir.
  const GUID = "https://www.klimik.org.tr/?p=118339";
  const SLUG = "haftalik-klimik-bulteninin-son-sayisi-14-haziran-2022-yayimlandi/";
  const ONCEKI = { title: "Haftalık KLİMİK Bülteni’nin Son Sayısı (29 Eylül 2026) Yayımlandı", link: `https://www.klimik.org.tr/2026/09/30/${SLUG}` };
  const KAYMIS = `https://www.klimik.org.tr/2026/10/01/${SLUG}`;
  const SONRAKI = { title: "Haftalık KLİMİK Bülteni’nin Son Sayısı (6 Ekim 2026) Yayımlandı", link: `https://www.klimik.org.tr/2026/10/07/${SLUG}` };
  const onceki = () => put({ id: "sayi-29", source: "klimik", externalId: GUID, title: ONCEKI.title, url: ONCEKI.link });

  it("YENİ SAYI: başlık + adres birlikte değişti → eski sayı arşiv anahtarına taşınır, yeni sayı guid'le yeni kayıt doğar", async () => {
    onceki();
    stubFeed(feedOf(item(SONRAKI.title, SONRAKI.link, GUID)));
    expect(await ingestRss(KLIMIK)).toEqual([1, 1]);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({ where: { id: "sayi-29" }, data: { externalId: `${GUID}#sayi-29` } });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].data).toMatchObject({ source: "klimik", externalId: GUID, title: SONRAKI.title, url: SONRAKI.link });
    // Eski sayı SİLİNMEDİ: kendi başlığı ve adresiyle, arşiv anahtarı altında duruyor.
    expect(table.find((r) => r.id === "sayi-29")).toMatchObject({ externalId: `${GUID}#sayi-29`, title: ONCEKI.title, url: ONCEKI.link });
    expect(table).toHaveLength(2);
  });
  it("ertesi gece aynı sayı: guid satırı yeni sayıyı taşıyor → ne arşivleme ne yeni kayıt", async () => {
    onceki();
    stubFeed(feedOf(item(SONRAKI.title, SONRAKI.link, GUID)));
    await ingestRss(KLIMIK);
    update.mockClear(); create.mockClear();
    expect(await ingestRss(KLIMIK)).toEqual([1, 0]);
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
  it("TARİH KAYMASI: yalnız adres değişti → adres güncellenir, yeni kayıt AÇILMAZ (çift başlık doğmaz)", async () => {
    onceki();
    stubFeed(feedOf(item(ONCEKI.title, KAYMIS, GUID)));
    expect(await ingestRss(KLIMIK)).toEqual([1, 0]);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({ where: { id: "sayi-29" }, data: { url: KAYMIS } });
    expect(create).not.toHaveBeenCalled();
  });
  it("yalnız başlık değişti (adres aynı) → yazım düzeltmesi sayılır, dokunulmaz", async () => {
    onceki();
    stubFeed(feedOf(item(`${ONCEKI.title} (düzeltme)`, ONCEKI.link, GUID)));
    expect(await ingestRss(KLIMIK)).toEqual([1, 0]);
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
  it("dry-run: yeni sayı 'yeni' sayılır ama hiçbir şey yazılmaz", async () => {
    onceki();
    stubFeed(feedOf(item(SONRAKI.title, SONRAKI.link, GUID)));
    const lines: string[] = [];
    expect(await ingestRss(KLIMIK, { dryRun: true, onItem: (l) => lines.push(l) })).toEqual([1, 1]);
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("6 Ekim 2026");
  });
  it("syncRssEdition: satır yoksa absent · adres aynıysa same · çevrilmiş kaynakta KAYNAK başlığı (titleOriginal) karşılaştırılır", async () => {
    expect(await syncRssEdition("klimik", GUID, { title: "x", link: ONCEKI.link })).toBe("absent");
    onceki();
    expect(await syncRssEdition("klimik", GUID, { title: "başka başlık", link: ONCEKI.link.replace("https://www.", "http://") })).toBe("same");
    // Medical Xpress sınıfı: gösterim başlığı Türkçe, kaynak başlığı titleOriginal'de → başlık "değişmiş" SAYILMAZ, yalnız adres kaymıştır.
    put({ id: "mx", source: "medicalxpress", externalId: "news1", title: "Türkçe çeviri", titleOriginal: "English headline", url: "https://medicalxpress.com/news/a.html" });
    expect(await syncRssEdition("medicalxpress", "news1", { title: "English headline", link: "https://medicalxpress.com/news/b.html" })).toBe("moved");
    expect(update).toHaveBeenLastCalledWith({ where: { id: "mx" }, data: { url: "https://medicalxpress.com/news/b.html" } });
  });
});

describe("scanRssTwins — kimlik geçişi temizliğinin karar kuralı (v6.307)", () => {
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

// Başlık kimlik değildir: "aynı başlık / farklı URL" temizliği yalnız üç kanıt sınıfında siler (üretim ölçümü 2026-10-02).
describe("tarihi değişen yazı — normalizeArticleUrl · scanSameTitle · decideRedated (v6.309)", () => {
  const ESKI_URL = "https://www.klimik.org.tr/2026/08/17/yeterlik-sinavi/";
  const YENI_URL = "https://www.klimik.org.tr/2026/08/20/yeterlik-sinavi/";
  const UCUNCU = "https://www.klimik.org.tr/2026/10/01/haftalik-bulten/";
  type T = TwinRow & { title: string };
  const row = (id: string, url: string | null, day: string, title = "23. Yeterlik Sınavına Başvurular Başladı", source = "klimik"): T =>
    ({ id, source, externalId: `x-${id}`, url, createdAt: new Date(`${day}T02:35:00Z`), title });
  const eski = row("eski", ESKI_URL, "2026-08-18");
  const yeni = row("yeni", YENI_URL, "2026-08-21");
  const live = (final: string): UrlResolution => ({ kind: "live", final });
  const DEAD: UrlResolution = { kind: "dead" };
  const reasonOf = (d: ReturnType<typeof decideRedated>) => ("reason" in d ? d.reason : "");

  it("adres yalınlaştırma: şema, www, sondaki bölü ve yüzde-kodu büyük/küçük harfi fark sayılmaz; yol ve sorgu sayılır", () => {
    expect(normalizeArticleUrl("https://www.klimik.org.tr/2026/09/28/yazi/")).toBe(normalizeArticleUrl("http://klimik.org.tr/2026/09/28/yazi"));
    expect(normalizeArticleUrl("https://ornek.org/%C3%A7ocuk-a%C5%9F%C4%B1/")).toBe(normalizeArticleUrl("https://ornek.org/%c3%a7ocuk-a%c5%9f%c4%b1"));
    expect(normalizeArticleUrl("https://ornek.org/?p=1")).not.toBe(normalizeArticleUrl("https://ornek.org/?p=2"));
    expect(normalizeArticleUrl(ESKI_URL)).not.toBe(normalizeArticleUrl(YENI_URL));
    expect(normalizeArticleUrl("adres değil")).toBe("adres değil");
  });

  it("scanSameTitle: yalnız aynı kaynak + aynı başlık + FARKLI adres küme sayılır; satırlar eski → yeni", () => {
    const clusters = scanSameTitle([
      yeni, eski,
      row("tek", "https://www.klimik.org.tr/2026/09/29/baska/", "2026-09-29", "Başka Başlık"),
      row("ayniurl-1", YENI_URL, "2026-09-26", "Aynı Adresli"), row("ayniurl-2", YENI_URL.slice(0, -1), "2026-09-30", "Aynı Adresli"),
      row("baskakaynak", ESKI_URL, "2026-08-18", "23. Yeterlik Sınavına Başvurular Başladı", "tjod"),
      row("urlsiz", null, "2026-08-18"),
    ]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].rows.map((r) => r.id)).toEqual(["eski", "yeni"]);
  });

  it("KANIT yonlendirme: eski adres yeniye varıyor, yeni kendine çözülüyor → eski adresli satır düşer (sıra bağımsız)", () => {
    const resolve = (u: string) => live(u === ESKI_URL ? YENI_URL : u);
    expect(decideRedated(eski, yeni, resolve)).toEqual({ keep: yeni, drop: eski, evidence: "redirect" });
    expect(decideRedated(yeni, eski, resolve)).toEqual({ keep: yeni, drop: eski, evidence: "redirect" });
  });

  it("KANIT ayni-hedef: iki adres de aynı üçüncü adrese varıyor (tek yazı yeniden tarihlenmiş) → İLK görülen kalır", () => {
    const resolve = () => live(UCUNCU);
    expect(decideRedated(eski, yeni, resolve)).toEqual({ keep: eski, drop: yeni, evidence: "same-target" });
    expect(decideRedated(yeni, eski, resolve)).toEqual({ keep: eski, drop: yeni, evidence: "same-target" });
  });

  it("KANIT olu-adres: bir adres 404/410, diğeri canlı ve kendine çözülüyor → kırık bağlantılı satır düşer", () => {
    const resolve = (u: string) => (u === ESKI_URL ? DEAD : live(u));
    expect(decideRedated(eski, yeni, resolve)).toEqual({ keep: yeni, drop: eski, evidence: "dead-link" });
    expect(decideRedated(yeni, eski, resolve)).toEqual({ keep: yeni, drop: eski, evidence: "dead-link" });
  });

  it("kanıt yoksa DOKUNULMAZ: iki ayrı canlı yazı · erişilemedi · iki adres de ölü · ölü + başka yere giden · farklı hedefler · aynı adres", () => {
    expect(reasonOf(decideRedated(eski, yeni, (u) => live(u)))).toContain("canlı ve ayrı");
    const bilinmiyor = decideRedated(eski, yeni, (u) => (u === ESKI_URL ? { kind: "unknown", note: "HTTP 503" } : live(u)));
    expect(reasonOf(bilinmiyor)).toContain("kanıt sayılmaz");
    expect(reasonOf(bilinmiyor)).toContain("HTTP 503");
    expect(reasonOf(decideRedated(eski, yeni, () => DEAD))).toContain("iki adres de ölü");
    expect(reasonOf(decideRedated(eski, yeni, (u) => (u === ESKI_URL ? DEAD : live(UCUNCU))))).toContain("başka bir adrese");
    expect(reasonOf(decideRedated(eski, yeni, (u) => live(u === ESKI_URL ? UCUNCU : "https://www.klimik.org.tr/arsiv/")))).toContain("farklı yerlere");
    // Yönlendirme zinciri canlı adreste BİTMİYORSA (yeni adres de başka yere gidiyorsa) "yonlendirme" kanıtı sayılmaz.
    expect(reasonOf(decideRedated(eski, yeni, (u) => live(u === ESKI_URL ? YENI_URL : UCUNCU)))).toContain("farklı yerlere");
    expect(reasonOf(decideRedated(yeni, row("ikiz", YENI_URL, "2026-09-30"), (u) => live(u)))).toContain("adresler aynı");
    expect(reasonOf(decideRedated(eski, row("urlsiz", null, "2026-09-30"), (u) => live(u)))).toContain("URL'siz");
  });
});
