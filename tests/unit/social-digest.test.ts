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
  id: "a1", module: "akademik", kind: "makale", title: "Başlık", sourceName: "JAMA",
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

  it("mevzuat ailesi kind ile üç akışa ayrılır", () => {
    const items = pickSocialDigest([
      art({ id: "m1", module: "mevzuat", kind: "mevzuat" }),
      art({ id: "m2", module: "mevzuat", kind: "ictihat" }),
      art({ id: "m3", module: "mevzuat", kind: "doktrin" }),
    ], rot);
    expect(items.map((i) => i.stream)).toEqual(["mevzuat", "ictihat", "doktrin"]);
  });
});
