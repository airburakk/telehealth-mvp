// Doctorium Post — günlük özet sözleşmeleri (2026-08-24).
// Saf katman (bölümleme/kısaltma/token/e-posta render) + koşucu davranışı (idempotens ·
// boş gün baskısızlığı · RFC 8058 başlıkları) db-mock'la kilitlenir.
// Tasarım: vault output/doctorium-gunluk-ozet-tasarimi-2026-08-24.md.
import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = vi.hoisted(() => ({
  doctor: { findMany: vi.fn() },
  dailyDigest: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  user: { findFirst: vi.fn() },
  newsArticle: { findMany: vi.fn() },
}));
const notifyMock = vi.hoisted(() => vi.fn());
const sendEmailMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/notify", () => ({ notifyDoctorById: notifyMock }));
vi.mock("@/lib/email", () => ({ sendEmail: sendEmailMock }));

import {
  buildDigestSections, trimSummary, trDayString, formatTrDate,
  digestUnsubToken, verifyDigestUnsubToken, digestUnsubUrl,
  runDailyDigests, MAX_PER_SECTION,
} from "@/lib/daily-digest";
import { renderDigestEmailHtml, renderDigestEmailText } from "@/lib/digest-email";
import type { FeedItem } from "@/lib/doctorium";

function item(over: Partial<FeedItem>): FeedItem {
  return {
    id: "a1", module: "akademik", kind: "makale", source: "pubmed",
    title: "Başlık", titleOriginal: null, summary: "Özet metni.",
    sourceName: "JAMA", authors: null, url: "https://example.org/x", doi: null,
    publishedAt: new Date("2026-08-24T05:00:00Z"), branchSlugs: [], category: null,
    hasAiSummary: false, imageUrl: null,
    ...over,
  };
}

describe("trimSummary — telif çizgisi (kısa özet)", () => {
  it("kısa metin dokunulmadan geçer, boşluklar düzleşir", () => {
    expect(trimSummary("iki  satır\nözet")).toBe("iki satır özet");
  });
  it("uzun metin kelime sınırında kesilir ve … alır", () => {
    const out = trimSummary("kelime ".repeat(60));
    expect(out.length).toBeLessThanOrEqual(221);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/kelim…$/); // kelime ortasından kesilmedi
  });
});

describe("buildDigestSections — gazete bölümleme", () => {
  it("bölümler = tercihlerdeki 6 ilgi alanı; mevzuat kind ile Mevzuat/İçtihat/Doktrin'e ayrışır", () => {
    const { sections } = buildDigestSections([
      item({ id: "s1", module: "sektorel" }),
      item({ id: "h1", module: "mevzuat", kind: "ictihat" }),
      item({ id: "m1", module: "mevzuat", kind: "mevzuat" }),
      item({ id: "i1", module: "ilac" }),
      item({ id: "a1", module: "akademik" }),
      item({ id: "h2", module: "mevzuat", kind: "doktrin" }),
    ]);
    expect(sections.map((s) => s.key)).toEqual(["akademik", "ilac", "sektorel", "mevzuat", "ictihat", "doktrin"]);
    expect(sections.find((s) => s.key === "ictihat")!.items.map((i) => i.id)).toEqual(["h1"]);
    expect(sections.find((s) => s.key === "doktrin")!.items.map((i) => i.id)).toEqual(["h2"]);
    expect(sections.find((s) => s.key === "mevzuat")!.items.map((i) => i.id)).toEqual(["m1"]);
  });

  it("🔒 alan başına 2 kuralı (2026-08-25): 1 alan → 2, 6 alan → 12 başlık", () => {
    expect(MAX_PER_SECTION).toBe(2);
    const one = buildDigestSections(Array.from({ length: 7 }, (_, i) => item({ id: `a${i}` })));
    expect(one.sections.reduce((n, s) => n + s.items.length, 0)).toBe(2);
    const all = buildDigestSections([
      ...Array.from({ length: 3 }, (_, i) => item({ id: `a${i}`, module: "akademik" })),
      ...Array.from({ length: 3 }, (_, i) => item({ id: `i${i}`, module: "ilac" })),
      ...Array.from({ length: 3 }, (_, i) => item({ id: `s${i}`, module: "sektorel" })),
      ...Array.from({ length: 3 }, (_, i) => item({ id: `m${i}`, module: "mevzuat", kind: "mevzuat" })),
      ...Array.from({ length: 3 }, (_, i) => item({ id: `c${i}`, module: "mevzuat", kind: "ictihat" })),
      ...Array.from({ length: 3 }, (_, i) => item({ id: `d${i}`, module: "mevzuat", kind: "doktrin" })),
    ]);
    expect(all.sections).toHaveLength(6);
    expect(all.sections.reduce((n, s) => n + s.items.length, 0)).toBe(12);
    expect(all.overflow).toBe(6);
  });

  it("bölüm tavanı uygulanır, taşan sayısı overflow'a yazılır; boş bölüm listelenmez", () => {
    const many = Array.from({ length: 9 }, (_, i) => item({ id: `a${i}`, module: "akademik" }));
    const { sections, overflow } = buildDigestSections(many);
    expect(sections).toHaveLength(1);
    expect(sections[0].items).toHaveLength(MAX_PER_SECTION);
    expect(overflow).toBe(9 - MAX_PER_SECTION);
  });

  it("boş girdi = boş baskı (bölüm yok, overflow 0)", () => {
    expect(buildDigestSections([])).toEqual({ sections: [], overflow: 0 });
  });
});

describe("gün/tarih yardımcıları", () => {
  it("trDayString TR gününü verir (00:00 TR = 21:00 UTC önceki gün)", () => {
    expect(trDayString(new Date(Date.UTC(2026, 7, 23, 21, 0, 0)))).toBe("2026-08-24");
  });
  it("formatTrDate Türkçe uzun tarih üretir; bozuk girdi olduğu gibi döner", () => {
    expect(formatTrDate("2026-08-24")).toBe("24 Ağustos 2026");
    expect(formatTrDate("bozuk")).toBe("bozuk");
  });
});

describe("tek-tık çıkış token'ı (RFC 8058)", () => {
  beforeEach(() => { process.env.SESSION_SECRET = "test-secret-uzun-ve-sabit"; });
  it("aynı doktor için doğrulanır, başka doktor/tahrif reddedilir", () => {
    const t = digestUnsubToken("dr1");
    expect(verifyDigestUnsubToken("dr1", t)).toBe(true);
    expect(verifyDigestUnsubToken("dr2", t)).toBe(false);
    expect(verifyDigestUnsubToken("dr1", t.slice(0, -1) + (t.endsWith("a") ? "b" : "a"))).toBe(false);
    expect(verifyDigestUnsubToken("dr1", "")).toBe(false);
  });
  it("çıkış URL'i doğru uca gider ve token taşır", () => {
    const u = digestUnsubUrl("dr1");
    expect(u).toContain("/api/digest/unsubscribe?d=dr1&t=");
    expect(u).toContain(digestUnsubToken("dr1"));
  });
});

describe("e-posta baskısı (digest-email)", () => {
  const args = {
    doctorName: "Dr. Deniz",
    day: "2026-08-24",
    sections: [{
      key: "akademik", label: "Akademik",
      items: [{
        id: "a1", title: 'Başlık <script>alert("x")</script>', sourceName: "JAMA & Lancet",
        url: "https://example.org/x", summary: "Kısa özet.", kind: "makale",
        publishedAt: "2026-08-24T05:00:00.000Z",
      }],
    }],
    overflow: 3,
    portalUrl: "https://site.test/doktor/doctorium/ozet",
    unsubUrl: "https://site.test/api/digest/unsubscribe?d=dr1&t=tok",
  };

  it("HTML: masthead + bölüm + çıkış linki var; başlık HTML'i KAÇIRILIR; görsel yok", () => {
    const html = renderDigestEmailHtml(args);
    expect(html).toContain("DOCTORIUM");
    expect(html).toContain("AKADEMİK"); // bölüm etiketi sunucuda tr-locale ile büyür (noktalı İ doğru)
    // URL href'te HTML-kaçırılmış durur (& → &amp;) — doğru davranış budur.
    expect(html).toContain("https://site.test/api/digest/unsubscribe?d=dr1&amp;t=tok");
    expect(html).toContain("&lt;script&gt;"); // XSS kaçırma — ham <script> gömülmez
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain("<img"); // tipografik gazete — e-postada görsel bilinçli YOK (tasarım §5.2)
    // 🔒 İ dersi (2026-08-25): CSS büyütme yasak — Türkçe metin sunucuda tr-locale ile büyür,
    // İngilizce kaynak adı olduğu gibi kalır ("JAMA & Lancet" bozulmaz, "CİRCULATİON" sınıfı hata olmaz).
    expect(html).not.toContain("text-transform");
    expect(html).toContain("KİŞİSEL SABAH ÖZETİNİZ");
    expect(html).toContain("JAMA &amp; Lancet");
    expect(html).toContain("PAZARTESİ, 24 AĞUSTOS 2026");
    expect(html).toContain("3 başlık daha");
  });

  it("düz metin: başlık + kaynak + çıkış URL'i taşır", () => {
    const text = renderDigestEmailText(args);
    expect(text).toContain("DOCTORIUM POST");
    expect(text).toContain("(JAMA & Lancet)");
    expect(text).toContain(args.unsubUrl);
  });
});

describe("runDailyDigests — koşucu davranışı", () => {
  const doctor = {
    id: "dr1", name: "Dr. Deniz", branch: "Onkoloji",
    newsBranches: null, feedModules: null, digestChannel: "app",
  };
  const row = {
    id: "n1", module: "akademik", kind: "makale", source: "pubmed",
    title: "Yeni bulgu", titleOriginal: null, summary: "Özet.", sourceName: "JAMA",
    authors: null, url: "https://example.org", doi: null,
    publishedAt: new Date("2026-08-24T04:00:00Z"), branchSlugs: "[]",
    aiSummary: null, category: null, imageUrl: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.doctor.findMany.mockResolvedValue([doctor]);
    dbMock.dailyDigest.findUnique.mockResolvedValue(null);
    dbMock.dailyDigest.findFirst.mockResolvedValue(null);
    dbMock.dailyDigest.create.mockResolvedValue({ id: "dg1" });
    dbMock.newsArticle.findMany.mockResolvedValue([]);
  });

  it("içerik varsa baskı + bildirim üretir", async () => {
    // personalFeedRaw modül işlerini push sırasıyla çağırır — ilk iş akademiktir.
    dbMock.newsArticle.findMany.mockResolvedValueOnce([row]);
    const r = await runDailyDigests();
    expect(r).toMatchObject({ checked: 1, produced: 1, skippedEmpty: 0, failed: 0 });
    expect(dbMock.dailyDigest.create).toHaveBeenCalledTimes(1);
    const created = dbMock.dailyDigest.create.mock.calls[0][0].data;
    expect(created.doctorId).toBe("dr1");
    expect(created.itemCount).toBe(1);
    expect(JSON.parse(created.itemsJson).sections[0].key).toBe("akademik");
    expect(notifyMock).toHaveBeenCalledWith("dr1", expect.objectContaining({
      type: "DAILY_DIGEST", href: "/doktor/doctorium/ozet",
    }));
  });

  it("boş gün = baskı YOK (satır yazılmaz, bildirim gitmez)", async () => {
    const r = await runDailyDigests();
    expect(r).toMatchObject({ checked: 1, produced: 0, skippedEmpty: 1 });
    expect(dbMock.dailyDigest.create).not.toHaveBeenCalled();
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("bugünkü baskı zaten varsa yeniden üretilmez (cron tekrar koşumu güvenli)", async () => {
    dbMock.dailyDigest.findUnique.mockResolvedValue({ id: "dg-önceki" });
    const r = await runDailyDigests();
    expect(r).toMatchObject({ checked: 1, produced: 0, skippedDone: 1 });
    expect(dbMock.dailyDigest.create).not.toHaveBeenCalled();
  });

  it("email kanalı: doğrulanmış adrese RFC 8058 başlıklarıyla gönderilir (dormant=simülasyon sayacı)", async () => {
    process.env.SESSION_SECRET = "test-secret-uzun-ve-sabit";
    dbMock.doctor.findMany.mockResolvedValue([{ ...doctor, digestChannel: "email" }]);
    dbMock.newsArticle.findMany.mockResolvedValueOnce([row]);
    dbMock.user.findFirst.mockResolvedValue({ email: "dr@example.org", emailVerifiedAt: new Date() });
    sendEmailMock.mockResolvedValue({ sent: false, simulated: true });
    const r = await runDailyDigests();
    expect(r).toMatchObject({ produced: 1, emailed: 0, emailSimulated: 1 });
    const msg = sendEmailMock.mock.calls[0][0];
    expect(msg.to).toBe("dr@example.org");
    expect(msg.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(msg.headers["List-Unsubscribe"]).toContain("/api/digest/unsubscribe");
    expect(dbMock.dailyDigest.update).not.toHaveBeenCalled(); // emailedAt yalnız GERÇEK gönderimde
  });

  it("doğrulanmamış adrese bülten gitmez (teslimat hijyeni) ama baskı üretilir", async () => {
    dbMock.doctor.findMany.mockResolvedValue([{ ...doctor, digestChannel: "email" }]);
    dbMock.newsArticle.findMany.mockResolvedValueOnce([row]);
    dbMock.user.findFirst.mockResolvedValue({ email: "dr@example.org", emailVerifiedAt: null });
    const r = await runDailyDigests();
    expect(r.produced).toBe(1);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("tek doktorun hatası koşuyu düşürmez (fire-safe sayaç)", async () => {
    dbMock.doctor.findMany.mockResolvedValue([doctor, { ...doctor, id: "dr2" }]);
    dbMock.dailyDigest.findUnique
      .mockRejectedValueOnce(new Error("db koptu"))
      .mockResolvedValue(null);
    dbMock.newsArticle.findMany.mockResolvedValueOnce([row]);
    const r = await runDailyDigests();
    expect(r.failed).toBe(1);
    expect(r.produced).toBe(1); // ikinci doktor etkilenmedi
  });
});
