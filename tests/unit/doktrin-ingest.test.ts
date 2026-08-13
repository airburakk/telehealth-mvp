// Doktrin (TR-Dizin) ingest — sözleşme testleri (v6.91). Zarf/alan örnekleri 2026-08-12 canlı
// ölçümünden (fizibilite: output/doctorium-hukuk-plani-2026-08-06.md). Telif sınırı burada da
// kilitlenir: yazılan tek metin alanı ÖZET'tir (dizinin herkese açık metadata'sı).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const dbMock = vi.hoisted(() => ({
  newsArticle: { findMany: vi.fn(), create: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

import {
  searchUrl, pickTitleAbstract, authorLine, publicationUrl, ingestDoktrin, DOKTRIN_QUERIES,
  matchesQuery,
} from "@/lib/doktrin-ingest";

describe("searchUrl — ölçülen sözleşme", () => {
  it("`order` paramını DAİMA taşır (yokluğu sunucuda json_parse_exception — fizibilite tuzağı)", () => {
    const u = searchUrl("malpraktis", 2);
    expect(u).toContain("order=publicationYear-DESC");
    expect(u).toContain("page=2");
    expect(u).toContain(encodeURIComponent("malpraktis"));
  });
});

describe("pickTitleAbstract — TR öncelikli seçim", () => {
  it("TUR varsa onu seçer (ENG listede önce olsa bile)", () => {
    const r = pickTitleAbstract([
      { title: "Medical Malpractice", abstract: "EN abstract", language: "ENG" },
      { title: "Tıbbi Malpraktis", abstract: "TR özet", language: "TUR" },
    ]);
    expect(r).toEqual({ title: "Tıbbi Malpraktis", abstract: "TR özet" });
  });
  it("TUR yoksa başlıklı ilk kayda düşer; hiç başlık yoksa null (başlıksız kayıt yazılmaz)", () => {
    expect(pickTitleAbstract([{ title: "Only EN", abstract: "x", language: "ENG" }])?.title).toBe("Only EN");
    expect(pickTitleAbstract([{ abstract: "başlıksız", language: "TUR" }])).toBeNull();
    expect(pickTitleAbstract(undefined)).toBeNull();
  });
});

describe("authorLine", () => {
  it("3'e kadar tam liste, fazlası 've ark.'", () => {
    expect(authorLine([{ inPublicationName: "Hacı KARA" }])).toBe("Hacı KARA");
    expect(authorLine([
      { inPublicationName: "A" }, { inPublicationName: "B" }, { inPublicationName: "C" }, { inPublicationName: "D" },
    ])).toBe("A, B, C ve ark.");
    expect(authorLine([])).toBeNull();
  });
});

describe("publicationUrl — link modeli (telif: daima yayıncıya/dizine)", () => {
  it("DOI varsa doi.org; yoksa TR-Dizin detay sayfası (şablon canlıda 200 doğrulandı)", () => {
    expect(publicationUrl("1407016", "10.1234/abc")).toBe("https://doi.org/10.1234/abc");
    expect(publicationUrl("1407016", null)).toBe("https://search.trdizin.gov.tr/tr/yayin/detay/1407016");
    expect(publicationUrl("9", "  ")).toBe("https://search.trdizin.gov.tr/tr/yayin/detay/9");
  });
});

describe("sorgu seti disiplini", () => {
  it("geniş tek kelime yok (hukuk-keywords sözlüğüyle aynı kural)", () => {
    for (const q of DOKTRIN_QUERIES) expect(q.length, q).toBeGreaterThan(8);
  });
});

describe("matchesQuery — istemci-taraflı tam-ibare doğrulaması (2026-08-12 dry-run dersi)", () => {
  it("ibare başlık/özet/anahtar-kelimede BİREBİR geçmiyorsa kayıt elenir (gevşek ES skoru güvenilmez)", () => {
    const alakasiz = {
      abstracts: [{ title: "Belediyelerin Sahipsiz Hayvanlarla İlgili Sorumluluğu", abstract: "hukuk ve sağlık kelimeleri ayrı ayrı geçiyor", language: "TUR" }],
    };
    expect(matchesQuery(alakasiz, "sağlık hukuku")).toBe(false);
    const ilgili = {
      abstracts: [{ title: "Sağlık Hukuku Açısından Hekim Sorumluluğu", abstract: "…", language: "TUR" }],
    };
    expect(matchesQuery(ilgili, "sağlık hukuku")).toBe(true);
  });
  it("BÜYÜK harf tr-TR katlamayla eşleşir; keywords dizisi de taranır", () => {
    expect(matchesQuery(
      { abstracts: [{ title: "TIBBİ MALPRAKTİS VE SONUÇLARI", language: "TUR" }] },
      "tıbbi malpraktis",
    )).toBe(true);
    expect(matchesQuery(
      { abstracts: [{ title: "Hekim Sorumluluğu", abstract: "…", keywords: ["aydınlatılmış onam", "rıza"], language: "TUR" }] },
      "aydınlatılmış onam",
    )).toBe(true);
  });
});

// ── ingest akışı (fetch + db mock) ──────────────────────────────────────────

const SRC = (id: number, extra: object = {}) => ({
  id,
  // Başlıkta sorgu ibaresi ("malpraktis") — matchesQuery süzgecinden geçsin (gerçek akışla aynı).
  abstracts: [
    { title: `Makale ${id} EN malpractice`, abstract: "en", language: "ENG" },
    { title: `Makale ${id}`, abstract: `Özet ${id} — malpraktis değerlendirmesi`, language: "TUR" },
  ],
  authors: [{ inPublicationName: "Hacı KARA" }],
  journal: { name: "BAU Hukuk Fakültesi Dergisi" },
  publicationYear: 2026,
  doi: null,
  ...extra,
});
const PAGE = (sources: object[], total = sources.length) => ({
  hits: { total: { value: total }, hits: sources.map((s) => ({ _source: s })) },
});

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

beforeEach(() => {
  vi.useFakeTimers();
  dbMock.newsArticle.findMany.mockReset();
  dbMock.newsArticle.create.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("ingestDoktrin", () => {
  it("bilinen atlanır; yenisi TR başlık/özet + dergi + yazar + detay-linkiyle yazılır", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(PAGE([SRC(1), SRC(2)]))));
    dbMock.newsArticle.findMany.mockResolvedValue([{ externalId: "1" }]);
    dbMock.newsArticle.create.mockResolvedValue({});

    const p = ingestDoktrin({ queries: ["malpraktis"] });
    await vi.runAllTimersAsync();
    const r = await p;

    expect(r.found).toBe(2);
    expect(r.created).toBe(1);
    const data = dbMock.newsArticle.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      source: "trdizin",
      externalId: "2",
      module: "mevzuat",
      category: "doktrin",
      kind: "doktrin",
      title: "Makale 2", // TR öncelik — EN varyant değil
      summary: "Özet 2 — malpraktis değerlendirmesi", // TELİF: yalnız dizin özeti
      sourceName: "BAU Hukuk Fakültesi Dergisi",
      authors: "Hacı KARA",
      url: "https://search.trdizin.gov.tr/tr/yayin/detay/2",
      doi: null,
    });
    expect(data.publishedAt.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("API'nin 200-gövdeli `error` zarfı sessiz boş liste SANILMAZ — koşu kesilir, hata raporlanır", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: { reason: "json_parse_exception ..." } })));
    dbMock.newsArticle.findMany.mockResolvedValue([]);

    const p = ingestDoktrin({ queries: ["malpraktis", "sağlık hukuku"] });
    await vi.runAllTimersAsync();
    const r = await p;

    expect(r.found).toBe(0);
    expect(r.errors).toHaveLength(1); // ilk sorguda kesildi — ikinciye gidilmedi (nazik geri çekilme)
    expect(r.errors[0]).toMatch(/json_parse_exception/);
  });

  it("başlıksız/yılsız kayıt yazılmaz (uydurma yok); ardışık-hata sayacına da girmez", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(PAGE([
      SRC(1, { abstracts: [{ abstract: "malpraktis üzerine başlıksız kayıt", language: "TUR" }] }),
      SRC(2, { publicationYear: "bozuk" }),
      SRC(3),
    ]))));
    dbMock.newsArticle.findMany.mockResolvedValue([]);
    dbMock.newsArticle.create.mockResolvedValue({});

    const p = ingestDoktrin({ queries: ["malpraktis"] });
    await vi.runAllTimersAsync();
    const r = await p;

    expect(r.created).toBe(1); // yalnız 3 yazıldı
    expect(r.errors).toHaveLength(2);
    expect(dbMock.newsArticle.create).toHaveBeenCalledTimes(1);
  });

  it("maxPages sayfalamayı sınırlar (arşiv değil akış: en yeni dilim)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(PAGE([SRC(1)], 500))); // 500 sonuç var
    vi.stubGlobal("fetch", fetchMock);
    dbMock.newsArticle.findMany.mockResolvedValue([]);
    dbMock.newsArticle.create.mockResolvedValue({});

    const p = ingestDoktrin({ queries: ["malpraktis"], maxPages: 2 });
    await vi.runAllTimersAsync();
    await p;

    expect(fetchMock).toHaveBeenCalledTimes(2); // 500/24≈21 sayfa değil, 2 sayfa
  });
});
