// Doctorium — saf mantık sözleşmeleri (v6.48). Ağ/DB gerektiren yollar entegrasyon işidir;
// burada kişiselleştirme + veri temizliği + mevzuat filtresi kilitlenir.
import { describe, it, expect } from "vitest";
import {
  parseBranchPrefs, normalizeBranchPrefs, effectiveBranches, branchLabel, slugForLabel,
  parseClinicalSummary, BRANCH_OPTIONS, DOCTORIUM_MODULES,
  RANGE_OPTIONS, DEFAULT_RANGE, rangeDays, normalizeAlertDays, ALERT_DAY_OPTIONS,
} from "@/lib/doctorium";
import { isHealthRelated } from "@/lib/doctorium-ingest";
import { BRANCHES } from "@/lib/triage";

describe("branş tercihleri", () => {
  it("bilinmeyen slug elenir, tekrar temizlenir", () => {
    expect(normalizeBranchPrefs(["onkoloji", "onkoloji", "yok-boyle", "kardiyoloji"]))
      .toEqual(["onkoloji", "kardiyoloji"]);
  });

  it("dizi olmayan girdi boş döner (bozuk POST gövdesi akışı düşürmez)", () => {
    expect(normalizeBranchPrefs("onkoloji")).toEqual([]);
    expect(normalizeBranchPrefs(null)).toEqual([]);
    expect(normalizeBranchPrefs([1, 2, {}])).toEqual([]);
  });

  it("bozuk JSON saklanmışsa çökmez, boş döner", () => {
    expect(parseBranchPrefs("{bozuk")).toEqual([]);
    expect(parseBranchPrefs(null)).toEqual([]);
    expect(parseBranchPrefs('["onkoloji","yok"]')).toEqual(["onkoloji"]);
  });

  it("tercih yoksa hekimin KENDİ branşına düşer (boş akış gösterilmez)", () => {
    expect(effectiveBranches(null, "Onkoloji")).toEqual(["onkoloji"]);
    expect(effectiveBranches("[]", "Kardiyoloji")).toEqual(["kardiyoloji"]);
  });

  it("tercih varsa kendi branşı ezilir (hekim ne seçtiyse o)", () => {
    expect(effectiveBranches('["noroloji","psikiyatri"]', "Onkoloji")).toEqual(["noroloji", "psikiyatri"]);
  });

  it("branşsız personelde boş = genel akış", () => {
    expect(effectiveBranches(null, null)).toEqual([]);
  });

  it("slug↔etiket çevrimi 30 branşta tutarlı", () => {
    expect(BRANCH_OPTIONS).toHaveLength(BRANCHES.length);
    for (const b of BRANCHES) {
      expect(slugForLabel(b.label)).toBe(b.key);
      expect(branchLabel(b.key)).toBe(b.label);
    }
  });
});

describe("AI klinik özet çözümleme", () => {
  it("geçerli JSON yapıya dönüşür", () => {
    const s = parseClinicalSummary('{"takeaways":["a","b"],"design":"RCT","limits":"küçük örneklem"}');
    expect(s?.takeaways).toEqual(["a", "b"]);
    expect(s?.design).toBe("RCT");
  });

  it("bozuk/eksik veri null döner — yarım özet gösterilmez", () => {
    expect(parseClinicalSummary(null)).toBeNull();
    expect(parseClinicalSummary("{bozuk")).toBeNull();
    expect(parseClinicalSummary('{"design":"RCT"}')).toBeNull(); // takeaways yok
  });

  it("takeaways 4 madde ile sınırlanır ve metin olmayanlar elenir", () => {
    const s = parseClinicalSummary('{"takeaways":["1","2","3","4","5",7],"design":"","limits":""}');
    expect(s?.takeaways).toEqual(["1", "2", "3", "4"]);
  });
});

describe("Resmî Gazete sağlık filtresi (Modül B)", () => {
  it("sağlık düzenlemelerini yakalar", () => {
    for (const t of [
      "Sosyal Güvenlik Kurumu Sağlık Uygulama Tebliğinde Değişiklik Yapılmasına Dair Tebliğ",
      "Özel Hastaneler Yönetmeliğinde Değişiklik Yapılmasına Dair Yönetmelik",
      "Beşeri Tıbbi Ürünlerin Fiyatlandırılmasına Dair Karar",
      "Eczacılar ve Eczaneler Hakkında Yönetmelikte Değişiklik",
    ]) {
      expect(isHealthRelated(t), t).toBe(true);
    }
  });

  it("alakasız düzenlemeleri eler", () => {
    for (const t of [
      "Ankara Hacı Bayram Veli Üniversitesi Lisansüstü Eğitim ve Öğretim Yönetmeliği",
      "Bankacılık Düzenleme ve Denetleme Kurulu Kararı",
      "Birleşmiş Milletler Güvenlik Konseyinin 1267 Sayılı Kararı",
    ]) {
      expect(isHealthRelated(t), t).toBe(false);
    }
  });
});

describe("modül tanımı", () => {
  it("4 modül tanımlı ve anahtarlar benzersiz (D=ilaç PARK, kasıtlı yok)", () => {
    const keys = DOCTORIUM_MODULES.map((m) => m.key);
    expect(keys).toEqual(["akis", "akademik", "sektorel", "kongre"]);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

// ── v6.49: aralık filtresi + alarm eşiği ──
describe("sektörel zaman aralığı", () => {
  it("5 seçenek: günlük→1 yıllık, anahtar=gün sayısı", () => {
    expect(RANGE_OPTIONS.map((r) => r.key)).toEqual(["1", "7", "30", "180", "365"]);
    for (const r of RANGE_OPTIONS) expect(Number(r.key)).toBe(r.days);
  });

  it("bilinmeyen/eksik değer varsayılana (30 gün) düşer — URL kurcalanması akışı bozmaz", () => {
    expect(rangeDays(undefined)).toBe(30);
    expect(rangeDays("999")).toBe(30);
    expect(rangeDays("../../etc")).toBe(30);
    expect(rangeDays(DEFAULT_RANGE)).toBe(30);
  });

  it("geçerli değerler karşılığını verir", () => {
    expect(rangeDays("1")).toBe(1);
    expect(rangeDays("365")).toBe(365);
  });
});

describe("kongre alarm eşiği", () => {
  it("yalnız tanımlı seçenekler kabul edilir, gerisi KAPALI (null)", () => {
    expect(normalizeAlertDays(7)).toBe(7);
    expect(normalizeAlertDays("14")).toBe(14);
    expect(normalizeAlertDays(5)).toBeNull(); // listede yok
    expect(normalizeAlertDays(null)).toBeNull();
    expect(normalizeAlertDays("abc")).toBeNull();
    expect(normalizeAlertDays(-7)).toBeNull();
  });

  it("seçenekler gün cinsinden artan sırada", () => {
    const d = ALERT_DAY_OPTIONS.map((o) => o.days);
    expect(d).toEqual([...d].sort((a, b) => a - b));
  });
});
