// Kamuya açık gazete seçkisi — saf mantık sözleşmeleri (2026-08-30, belge §2.2).
//
// Kilitlenenler:
//   1) Rotasyon deterministik: aynı gün aynı branş; ardışık günler dizide ilerler (mod 35).
//   2) Teaser kuralı: akış başına EN FAZLA 1 başlık; boş akış düşer (boş kart üretilmez).
//   3) Branş tetikleyicisi: akademikte rotasyon branşı öncelikli, yoksa genel akademik fallback
//      (branch alanı yalnız gerçek branş eşleşmesinde dolar — yanlış branş etiketi basılmaz).
import { describe, it, expect } from "vitest";
import { rotationBranchFor, pickSocialDigest, type SocialArticle } from "@/lib/social-digest";
import { BRANCHES } from "@/lib/triage";

const art = (over: Partial<SocialArticle>): SocialArticle => ({
  id: "a1", source: "pubmed", module: "akademik", kind: "makale", title: "Başlık", sourceName: "JAMA",
  summary: "Özet metni.", url: "https://doi.org/x", branchSlugs: "[]",
  publishedAt: new Date("2026-08-30T06:00:00Z"), ...over,
});

describe("rotationBranchFor: gün etiketi → deterministik branş", () => {
  it("aynı gün aynı branş, ardışık günler dizide ilerler", () => {
    expect(rotationBranchFor("2026-01-01")).toBe(BRANCHES[0]);
    expect(rotationBranchFor("2026-01-02")).toBe(BRANCHES[1]);
    expect(rotationBranchFor("2026-08-30")).toBe(rotationBranchFor("2026-08-30"));
  });
  it("dizi boyunu aşan gün başa sarar (mod)", () => {
    const n = BRANCHES.length;
    const d = new Date(Date.UTC(2026, 0, 1 + n));
    const day = d.toISOString().slice(0, 10);
    expect(rotationBranchFor(day)).toBe(BRANCHES[0]);
  });
});

describe("pickSocialDigest: teaser seçkisi", () => {
  const rot = BRANCHES.find((b) => b.key === "kardiyoloji")!;

  it("akış başına 1 başlık, boş akış düşer", () => {
    const items = pickSocialDigest([
      art({ id: "x1" }),
      art({ id: "x2" }), // ikinci akademik — seçkiye giremez
      art({ id: "x3", module: "ilac", kind: "ilac" }),
    ], rot);
    expect(items.map((i) => i.stream)).toEqual(["akademik", "ilac"]);
  });

  it("akademikte rotasyon branşı önceliklidir ve branch alanı dolar", () => {
    const items = pickSocialDigest([
      art({ id: "genel" }), // daha taze ama branşsız
      art({ id: "kardio", branchSlugs: '["kardiyoloji","ic-hastaliklari"]', title: "Kalp çalışması" }),
    ], rot);
    expect(items[0].title).toBe("Kalp çalışması");
    expect(items[0].branch).toEqual({ key: "kardiyoloji", label: rot.label });
  });

  it("rotasyon branşında içerik yoksa genel akademiğe düşer, branch null kalır", () => {
    const items = pickSocialDigest([art({ id: "genel", branchSlugs: '["onkoloji"]' })], rot);
    expect(items[0].stream).toBe("akademik");
    expect(items[0].branch).toBeNull();
  });

  it("sektörelde yerli kaynak, daha taze yabancı haberden önce gelir; yerli yoksa yabancı kalır", () => {
    const yabanci = art({ id: "ms", module: "sektorel", kind: "haber", source: "medscape", title: "Çevrilmiş Medscape haberi" });
    const yerli = art({ id: "ttb", module: "sektorel", kind: "haber", source: "ttb", title: "TTB duyurusu" });
    // yalnız yabancı → akış boş düşmez, yabancı kalır
    expect(pickSocialDigest([yabanci], rot)[0].title).toBe("Çevrilmiş Medscape haberi");
    // yabancı daha taze (dizide önce) olsa da yerli seçilir
    expect(pickSocialDigest([yabanci, yerli], rot)[0].title).toBe("TTB duyurusu");
    // önceliğin akademik/ilaç akışlarına etkisi yok
    const ilac = pickSocialDigest([art({ id: "i", module: "ilac", kind: "ilac", source: "clinicaltrials", title: "Faz 3" })], rot);
    expect(ilac[0].title).toBe("Faz 3");
  });

  it("mevzuat ailesi kind ile üç akışa ayrılır", () => {
    const items = pickSocialDigest([
      art({ id: "m1", module: "mevzuat", kind: "mevzuat" }),
      art({ id: "m2", module: "mevzuat", kind: "ictihat" }),
      art({ id: "m3", module: "mevzuat", kind: "doktrin" }),
    ], rot);
    expect(items.map((i) => i.stream)).toEqual(["mevzuat", "ictihat", "doktrin"]);
  });

  // Bu uç NewsArticle satırını DOĞRUDAN okur (web akışının toFeedItem dönüşümü yok) → varlık
  // temizliği burada ayrıca yapılmalı, yoksa "&#x2009;" sosyal medya gönderisine ham gider.
  it("XML varlıkları çözülür — ham '&#x...' sosyal gönderiye sızmaz", () => {
    const items = pickSocialDigest([
      art({ title: "P&#x2009;&lt;&#x2009;.001 &amp; etki", summary: "Risk &#215; 2 azaldı." }),
    ], rot);
    // Beklenti KAÇIŞ DİZİSİYLE yazılır: &#x2009; ince boşluktur (U+2009), normal boşlukla
    // yazılırsa test görsel olarak doğru görünüp başarısız olur — ayırt edilemez.
    expect(items[0].title).toBe("P\u2009<\u2009.001 & etki");
    expect(items[0].summary).toBe("Risk × 2 azaldı.");
  });

  it("çözme KIRPMADAN önce olur — 160 karakter bütçesi gerçek harfleri sayar", () => {
    // Ham hâlde 8 karakter olan "&#x2009;" çözülünce 1 karaktere iner. Kırpma önce yapılsaydı
    // bütçe varlık koduyla dolar, metin erken kesilir ve kuyrukta yarım varlık kalabilirdi.
    const items = pickSocialDigest([art({ summary: `${"a".repeat(150)}&#x2009;${"b".repeat(20)}` })], rot);
    expect(items[0].summary).not.toContain("&#x");
    expect(items[0].summary.startsWith("a".repeat(150))).toBe(true);
  });
});
