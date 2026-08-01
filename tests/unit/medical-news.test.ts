// Haberler motoru — canlı PubMed katmanının AĞSIZ sınanabilir yüzeyi (v6.47).
// fetchBranchNews ağ + DB ister (entegrasyon işi); burada sözleşmeleri kilitliyoruz:
//   1) branş sorgu haritası gerçek BRANCHES etiketleriyle eşleşiyor (yazım hatası = sessiz "branş kapsanmıyor")
//   2) stub kartlar ASLA url/doi taşımaz (uydurma içerik gerçek bağlantı gibi görünmemeli)
//   3) newsForBranch branş kartlarını öne alır (sıralama sözleşmesi)
import { describe, it, expect } from "vitest";
import { NEWS_QUERIES, newsForBranch, NEWS_KIND_LABEL } from "@/lib/medical-news";
import { BRANCHES } from "@/lib/triage";

describe("NEWS_QUERIES", () => {
  it("her anahtar gerçek bir branş etiketidir (yazım hatası tuzağı)", () => {
    const labels = new Set(BRANCHES.map((b) => b.label));
    const unknown = Object.keys(NEWS_QUERIES).filter((k) => !labels.has(k));
    expect(unknown).toEqual([]);
  });

  it("sorgular MeSH/tiab niteleyicisi taşır — serbest metin sorgu yok", () => {
    for (const [branch, q] of Object.entries(NEWS_QUERIES)) {
      expect(q, branch).toMatch(/\[(mh|tiab|sh)\]/);
    }
  });

  it("demo doktor branşları (Onkoloji/Kardiyoloji) kapsanır", () => {
    expect(NEWS_QUERIES["Onkoloji"]).toBeTruthy();
    expect(NEWS_QUERIES["Kardiyoloji"]).toBeTruthy();
  });
});

describe("newsForBranch (stub katmanı — partner şeridi)", () => {
  it("stub kartlarda url/doi ALANI YOK — uydurma içerik gerçek bağlantı gibi görünemez", () => {
    // v6.48: alan tipten kaldırıldı (runtime kontrolü yerine derleme-zamanı garanti).
    for (const item of newsForBranch("Onkoloji")) {
      expect(item).not.toHaveProperty("url");
      expect(item).not.toHaveProperty("doi");
    }
  });

  it("branş kartları genel gündemden ÖNCE gelir", () => {
    const items = newsForBranch("Kardiyoloji");
    const general = items.findIndex((i) => i.id.startsWith("gen-"));
    const branchIdx = items.findIndex((i) => i.id.startsWith("kar-"));
    expect(branchIdx).toBeGreaterThanOrEqual(0);
    expect(branchIdx).toBeLessThan(general);
  });

  it("bilinmeyen branş = yalnız genel gündem (uydurma eşleşme yok)", () => {
    const items = newsForBranch("Yok Böyle Branş");
    expect(items.every((i) => i.id.startsWith("gen-"))).toBe(true);
  });

  it("her kart türü etiketlenebilir", () => {
    for (const item of newsForBranch("Onkoloji")) {
      expect(NEWS_KIND_LABEL[item.kind]).toBeTruthy();
    }
  });
});
