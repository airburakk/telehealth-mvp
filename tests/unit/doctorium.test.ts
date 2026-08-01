// Doctorium — saf mantık sözleşmeleri (v6.48). Ağ/DB gerektiren yollar entegrasyon işidir;
// burada kişiselleştirme + veri temizliği + mevzuat filtresi kilitlenir.
import { describe, it, expect } from "vitest";
import {
  parseBranchPrefs, normalizeBranchPrefs, effectiveBranches, branchLabel, slugForLabel,
  parseClinicalSummary, BRANCH_OPTIONS, DOCTORIUM_MODULES,
  RANGE_OPTIONS, DEFAULT_RANGE, rangeDays, normalizeAlertDays, ALERT_DAY_OPTIONS,
  SECTOR_CATEGORIES, categoryLabel, parseRegulationSummary,
} from "@/lib/doctorium";
import { isHealthRelated, categorize, parseTurkishDate } from "@/lib/doctorium-sources";
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
  it("6 modül, mevzuat SONDA (v6.51 sıra kararı)", () => {
    const keys = DOCTORIUM_MODULES.map((m) => m.key);
    // Sıra kullanıcı kararı (2026-08-01): mevzuat EN SONDA.
    expect(keys).toEqual(["akis", "akademik", "sektorel", "ilac", "kongre", "mevzuat"]);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("6 sektörel kategori tanımlı ve etiketleri çözülür", () => {
    expect(SECTOR_CATEGORIES).toHaveLength(6);
    for (const c of SECTOR_CATEGORIES) expect(categoryLabel(c.key)).toBe(c.label);
    expect(categoryLabel("yok-boyle")).toBeNull();
    expect(categoryLabel(null)).toBeNull();
  });

  it("kategori anahtarları categorize() çıktılarını KAPSAR (sessiz kayıp olmasın)", () => {
    const keys = new Set(SECTOR_CATEGORIES.map((c) => c.key));
    for (const t of [
      "Sağlık Uygulama Tebliğinde Değişiklik", "Sağlık Turizmi Teşvik Kararı",
      "Beşeri Tıbbi Ürünlerin Ruhsatlandırılması", "Kişisel Sağlık Verileri Yönetmeliği",
      "İşyeri Hekimliği Ücret Tarifeleri", "Özel Hastaneler Yönetmeliği",
    ]) {
      const c = categorize(t);
      expect(c, t).not.toBeNull();
      expect(keys.has(c as string), `${t} -> ${c}`).toBe(true);
    }
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

// ── v6.50: sektörel kategori ataması + tarih ayrıştırma ──
describe("sektörel kategori ataması", () => {
  it("SUT/geri ödeme, genel mevzuattan ÖNCE gelir (sıra kritik)", () => {
    // "SUT Tebliğinde Değişiklik" hem 'tebliğ' hem 'sut' içerir → sut kazanmalı
    expect(categorize("Sağlık Uygulama Tebliğinde Değişiklik Yapılmasına Dair Tebliğ")).toBe("sut");
    expect(categorize("SGK Sağlık Hizmetleri Fiyatlandırma Komisyonu Kararı")).toBe("sut");
    expect(categorize("Muayene Katılım Paylarına İlişkin SUT Değişikliği")).toBe("sut");
  });

  it("her kategori kendi anahtarıyla eşleşir", () => {
    expect(categorize("Sağlık Turizmi Teşvik Kararında Değişiklik")).toBe("turizm");
    expect(categorize("Beşeri Tıbbi Ürünlerin Ruhsatlandırılması Yönetmeliği")).toBe("ilac-cihaz");
    expect(categorize("Kişisel Sağlık Verileri Yönetmeliğinde Değişiklik")).toBe("teknoloji");
    expect(categorize("İşyeri Hekimliği Ücret Tarifeleri açıklandı")).toBe("yonetim");
    expect(categorize("Özel Hastaneler Yönetmeliğinde Değişiklik")).toBe("yonetim");
  });

  it("hiçbiri tutmazsa null (zorla kategori atanmaz)", () => {
    expect(categorize("Hava durumu raporu")).toBeNull();
  });
});

describe("Türkçe tarih ayrıştırma (OHSAD/TTB başlıkları)", () => {
  it("'– 29 Haziran 2026' biçimini çözer", () => {
    const d = parseTurkishDate("Sağlık Uygulama Tebliğinde Değişiklik – 29 Haziran 2026");
    expect(d?.toISOString().slice(0, 10)).toBe("2026-06-29");
  });

  it("noktalı biçimi çözer", () => {
    expect(parseTurkishDate("Duyuru 01.07.2026")?.toISOString().slice(0, 10)).toBe("2026-07-01");
  });

  it("tarih yoksa null döner (bugün varsayımı çağırana bırakılır)", () => {
    expect(parseTurkishDate("Tarihsiz bir başlık")).toBeNull();
  });
});

// ── v6.51: mevzuat özeti çözümleme ──
describe("mevzuat özeti çözümleme", () => {
  it("geçerli JSON yapıya dönüşür", () => {
    const r = parseRegulationSummary('{"summary":"Yönetmelik değişti.","actions":["Poliçe güncelle"],"affected":"özel hastaneler","effective":"yayımı tarihinde"}');
    expect(r?.summary).toBe("Yönetmelik değişti.");
    expect(r?.actions).toEqual(["Poliçe güncelle"]);
    expect(r?.affected).toBe("özel hastaneler");
  });

  it("özet boş/bozuksa null — yarım kart gösterilmez", () => {
    expect(parseRegulationSummary(null)).toBeNull();
    expect(parseRegulationSummary("{bozuk")).toBeNull();
    expect(parseRegulationSummary('{"actions":["x"]}')).toBeNull();
    expect(parseRegulationSummary('{"summary":"   "}')).toBeNull();
  });

  it("aksiyon maddeleri 3 ile sınırlı, metin olmayanlar elenir", () => {
    const r = parseRegulationSummary('{"summary":"x","actions":["a","b","c","d",5],"affected":"","effective":""}');
    expect(r?.actions).toEqual(["a", "b", "c"]);
  });

  it("aksiyon yoksa boş dizi (uydurma aksiyon üretilmez)", () => {
    const r = parseRegulationSummary('{"summary":"x","actions":[],"affected":"","effective":""}');
    expect(r?.actions).toEqual([]);
  });
});
