// Hukuk/İçtihat ingest — sözleşme testleri (v6.86). Yargıtay uçları RESMÎ API DEĞİL; buradaki
// zarf/payload örnekleri 2026-08-06 canlı ölçümünden alındı (vault: doctorium-hukuk-plani).
// Ağ/DB gerektiren gerçek akış entegrasyon işidir; burada saf dönüşümler + zarf açma + ingest
// akışının mock'lu davranışı (dedupe, tavan, CAPTCHA'da nazik kesme) kilitlenir.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const dbMock = vi.hoisted(() => ({
  newsArticle: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

import {
  parseKararDate, stripKararHtml, buildKararTitle, searchYargitay, ingestYargitay,
  YARGITAY_QUERIES, queriesForToday,
} from "@/lib/hukuk-ingest";

describe("parseKararDate (dd.MM.yyyy → UTC)", () => {
  it("geçerli tarihi çevirir", () => {
    expect(parseKararDate("02.04.2015")?.toISOString()).toBe("2015-04-02T00:00:00.000Z");
  });
  it("bozuk/eksik tarih null döner — kayıt uydurma tarihle yazılmaz", () => {
    expect(parseKararDate("31.13.2020")).toBeNull(); // geçersiz ay
    expect(parseKararDate("2015-04-02")).toBeNull(); // yanlış biçim
    expect(parseKararDate("")).toBeNull();
    expect(parseKararDate(undefined)).toBeNull();
  });
});

describe("stripKararHtml", () => {
  it("gerçek zarf kesitinden okunur metin çıkarır (taglar, <br>, entity)", () => {
    const html =
      '<html><body><b><font face="Verdana" size="2">12. Ceza Dairesi 2014/9296 E.</font></b>' +
      '<p align="justify"><font>Suç\t: Taksirle öldürme<br>Hüküm\t: mahkumiyet<br><br>' +
      "Karar &amp; gerekçe &quot;malpraktis&quot; olarak değerlendirilir.</font></p></body></html>";
    const out = stripKararHtml(html);
    expect(out).toContain("12. Ceza Dairesi 2014/9296 E.");
    expect(out).toContain("Suç : Taksirle öldürme\nHüküm : mahkumiyet");
    expect(out).toContain('Karar & gerekçe "malpraktis"');
    expect(out).not.toMatch(/<[a-z]/i); // tag kalıntısı yok
  });
  it("ardışık boş satırları teke indirir", () => {
    expect(stripKararHtml("a<br><br><br><br>b")).toBe("a\n\nb");
  });
});

describe("buildKararTitle", () => {
  it("daire + esas + karar numarasını tek satırda kurar", () => {
    expect(buildKararTitle({ daire: "3. Hukuk Dairesi", esasNo: "2024/2458", kararNo: "2025/1975" }))
      .toBe("Yargıtay 3. Hukuk Dairesi · E. 2024/2458, K. 2025/1975");
  });
});

describe("sorgu seti disiplini", () => {
  it("çok kelimeli sorgular TIRNAKLI (tırnaksız gevşek eşleşme 54k+ gürültü getiriyordu)", () => {
    for (const q of YARGITAY_QUERIES) {
      if (q.trim().includes(" ")) expect(q, q).toMatch(/^".+"$/);
    }
  });
});

describe("queriesForToday — cron rotasyonu", () => {
  it("günde 2 sorgu döner ve ardışık günler tam turu kapsar (hiçbir sorgu atlanmaz)", () => {
    const seen = new Set<string>();
    for (let d = 0; d < YARGITAY_QUERIES.length; d++) {
      const qs = queriesForToday(new Date(Date.UTC(2026, 7, 6 + d)));
      expect(qs).toHaveLength(2);
      qs.forEach((q) => seen.add(q));
    }
    expect(seen.size).toBe(YARGITAY_QUERIES.length);
  });
  it("aynı gün içinde deterministtir (cron yeniden koşsa da aynı dilim)", () => {
    const a = queriesForToday(new Date(Date.UTC(2026, 7, 6, 3)));
    const b = queriesForToday(new Date(Date.UTC(2026, 7, 6, 21)));
    expect(a).toEqual(b);
  });
});

// ── Zarf açma + ağ davranışı (fetch mock) ───────────────────────────────────

const OK_PAGE = {
  data: {
    data: [
      { id: "165999800", daire: "12. Ceza Dairesi", esasNo: "2014/9296", kararNo: "2015/5790", kararTarihi: "02.04.2015" },
      { id: "731146300", daire: "10. Hukuk Dairesi", esasNo: "2021/1187", kararNo: "2021/16741", kararTarihi: "28.12.2021" },
    ],
    recordsTotal: 2,
  },
  metadata: { FMTY: "SUCCESS" },
};

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

beforeEach(() => {
  vi.useFakeTimers(); // GAP_MS beklemeleri gerçek zamanda koşmasın
  dbMock.newsArticle.findMany.mockReset();
  dbMock.newsArticle.create.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("searchYargitay", () => {
  it("SUCCESS zarfından kayıtları ve toplamı çıkarır; gövde TAM alan şablonunu taşır", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(OK_PAGE));
    vi.stubGlobal("fetch", fetchMock);

    const r = await searchYargitay('"tıbbi malpraktis"', 1);
    expect(r.total).toBe(2);
    expect(r.records.map((x) => x.id)).toEqual(["165999800", "731146300"]);

    // Ölçülen sözleşme: eksik alan sessizce yok sayılıyor → şablon TAM gitmeli.
    const body = JSON.parse(fetchMock.mock.calls[0][1].body).data;
    for (const k of ["arananKelime", "esasYil", "baslangicTarihi", "birimYrgHukukDaire", "pageSize", "pageNumber"]) {
      expect(body, k).toHaveProperty(k);
    }
  });

  it("ERROR zarfı fırlatır (sessiz boş liste YOK — bayat akış 'güncel' sanılmasın)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ data: null, metadata: { FMTY: "ERROR" } })));
    await expect(searchYargitay("malpraktis", 1)).rejects.toThrow(/FMTY=ERROR/);
  });

  it("DisplayCaptcha sinyali özel mesajla fırlatır (kök detailMessage — site JS'inin okuduğu yer)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      jsonResponse({ data: null, detailMessage: "…DisplayCaptcha…", metadata: { FMTY: "ERROR" } }),
    ));
    await expect(searchYargitay("malpraktis", 1)).rejects.toThrow(/CAPTCHA/);
  });

  it("HTTP 429'da BİR kez soğuyup yineler (2026-08-06 sahası); ikinci 429 fırlar", async () => {
    // 1. senaryo: 429 → (bekleme) → 200 = başarı
    const once = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) } as unknown as Response)
      .mockResolvedValueOnce(jsonResponse(OK_PAGE));
    vi.stubGlobal("fetch", once);
    const p = searchYargitay("malpraktis", 1);
    await vi.runAllTimersAsync();
    expect((await p).total).toBe(2);
    expect(once).toHaveBeenCalledTimes(2);

    // 2. senaryo: 429 + 429 = hata (sonsuz bekleme YOK)
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) } as unknown as Response));
    const p2 = searchYargitay("malpraktis", 1);
    p2.catch(() => {}); // fake-timer ilerletilirken unhandled rejection uyarısı olmasın
    await vi.runAllTimersAsync();
    await expect(p2).rejects.toThrow(/HTTP 429/);
  });
});

describe("ingestYargitay", () => {
  const DOC = { data: "<html><body>" + "Karar gerekçesi ".repeat(30) + "</body></html>", metadata: { FMTY: "SUCCESS" } };

  it("bilinen kayıt atlanır, yenisi metniyle yazılır (idempotent fark alma)", async () => {
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(jsonResponse(String(url).includes("getDokuman") ? DOC : OK_PAGE)));
    vi.stubGlobal("fetch", fetchMock);
    dbMock.newsArticle.findMany.mockResolvedValue([{ externalId: "165999800" }]); // biri zaten var
    dbMock.newsArticle.create.mockResolvedValue({});

    const p = ingestYargitay({ queries: ["malpraktis"] });
    await vi.runAllTimersAsync();
    const r = await p;

    expect(r.found).toBe(2);
    expect(r.created).toBe(1);
    expect(r.deferred).toBe(0);
    expect(r.errors).toEqual([]);
    expect(dbMock.newsArticle.create).toHaveBeenCalledTimes(1);
    const data = dbMock.newsArticle.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      source: "yargitay",
      externalId: "731146300",
      module: "mevzuat", // iç anahtar — kullanıcı yüzü "Hukuk"
      category: "ictihat",
      kind: "ictihat",
      url: null, // SPA'da derin link yok — arayüz E./K. doğrulama yönergesi gösterir
      title: "Yargıtay 10. Hukuk Dairesi · E. 2021/1187, K. 2021/16741",
    });
    expect(data.publishedAt.toISOString()).toBe("2021-12-28T00:00:00.000Z");
    expect(data.summary).toContain("Karar gerekçesi");
  });

  it("maxDocFetch tavanı aşan yeniler deferred sayılır (cron bütçesi; ertesi koşu devralır)", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) =>
      Promise.resolve(jsonResponse(String(url).includes("getDokuman") ? DOC : OK_PAGE))));
    dbMock.newsArticle.findMany.mockResolvedValue([]); // ikisi de yeni
    dbMock.newsArticle.create.mockResolvedValue({});

    const p = ingestYargitay({ queries: ["malpraktis"], maxDocFetch: 1 });
    await vi.runAllTimersAsync();
    const r = await p;

    expect(r.created).toBe(1);
    expect(r.deferred).toBe(1);
  });

  it("aramada CAPTCHA/hata koşuyu NAZİKÇE keser: o ana dek bulunanlar yine işlenir", async () => {
    let call = 0;
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (String(url).includes("getDokuman")) return Promise.resolve(jsonResponse(DOC));
      call++;
      return Promise.resolve(call === 1
        ? jsonResponse(OK_PAGE)
        : jsonResponse({ data: null, detailMessage: "DisplayCaptcha", metadata: { FMTY: "ERROR" } }));
    }));
    dbMock.newsArticle.findMany.mockResolvedValue([]);
    dbMock.newsArticle.create.mockResolvedValue({});

    const p = ingestYargitay({ queries: ["malpraktis", '"ikinci sorgu"'] });
    await vi.runAllTimersAsync();
    const r = await p;

    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/CAPTCHA/);
    expect(r.found).toBe(2); // ilk sorgunun havuzu korunur
    expect(r.created).toBe(2); // kesme ARAMA aşamasında — eldeki havuzun metinleri yine alınır
  });

  it("TEK metin hatası koşuyu KESMEZ (2026-08-06 sahası: 493'te 17'de kalmıştı); ardışık 3 keser", async () => {
    // 4 kayıtlı arama sayfası; 1. ve 3. kararın belge isteği patlar, 2. ve 4. başarılı.
    const FOUR = {
      data: {
        data: [1, 2, 3, 4].map((i) => ({
          id: `${i}00`, daire: "3. Hukuk Dairesi", esasNo: `2024/${i}`, kararNo: `2025/${i}`, kararTarihi: "08.04.2025",
        })),
        recordsTotal: 4,
      },
      metadata: { FMTY: "SUCCESS" },
    };
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      const u = String(url);
      if (!u.includes("getDokuman")) return Promise.resolve(jsonResponse(FOUR));
      if (u.includes("id=100") || u.includes("id=300")) return Promise.reject(new Error("The operation was aborted due to timeout"));
      return Promise.resolve(jsonResponse(DOC));
    }));
    dbMock.newsArticle.findMany.mockResolvedValue([]);
    dbMock.newsArticle.create.mockResolvedValue({});

    const p = ingestYargitay({ queries: ["malpraktis"] });
    await vi.runAllTimersAsync();
    const r = await p;

    expect(r.created).toBe(2); // 2. ve 4. yazıldı — tekil hatalar koşuyu öldürmedi
    expect(r.errors).toHaveLength(2);

    // Ardışık 3 hata = gerçek kesinti → koşu durur (sonsuz 30sn beklemeler zinciri olmasın).
    vi.stubGlobal("fetch", vi.fn((url: string) =>
      String(url).includes("getDokuman")
        ? Promise.reject(new Error("timeout"))
        : Promise.resolve(jsonResponse(FOUR))));
    const p2 = ingestYargitay({ queries: ["malpraktis"] });
    await vi.runAllTimersAsync();
    const r2 = await p2;
    expect(r2.created).toBe(0);
    expect(r2.errors).toHaveLength(3); // 4. karara hiç gidilmedi
  });

  it("kısa/boş metinli karar YAZILMAZ (uydurma içerik yok ilkesi)", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) =>
      Promise.resolve(jsonResponse(String(url).includes("getDokuman")
        ? { data: "<html><body>kısa</body></html>", metadata: { FMTY: "SUCCESS" } }
        : OK_PAGE))));
    dbMock.newsArticle.findMany.mockResolvedValue([]);
    dbMock.newsArticle.create.mockResolvedValue({});

    const p = ingestYargitay({ queries: ["malpraktis"] });
    await vi.runAllTimersAsync();
    const r = await p;

    expect(r.created).toBe(0);
    expect(r.errors.filter((e) => e.includes("boş/kısa"))).toHaveLength(2);
    expect(dbMock.newsArticle.create).not.toHaveBeenCalled();
  });
});
