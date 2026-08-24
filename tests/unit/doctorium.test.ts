// Doctorium — saf mantık sözleşmeleri (v6.48). Ağ/DB gerektiren yollar entegrasyon işidir;
// burada kişiselleştirme + veri temizliği + mevzuat filtresi kilitlenir.
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// doctorium-ingest DB'ye dokunur (import zinciri); saf fonksiyonların yanında moduleFeed'in
// WHERE kurgusu da bu mock üzerinden kilitlenir (v6.87 — findMany'ye giden argüman incelenir).
const feedFindMany = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ db: { newsArticle: { findMany: feedFindMany } } }));
import {
  parseBranchPrefs, normalizeBranchPrefs, effectiveBranches, branchLabel, slugForLabel,
  parseClinicalSummary, BRANCH_OPTIONS, DOCTORIUM_MODULES,
  RANGE_OPTIONS, DEFAULT_RANGE, rangeDays, normalizeAlertDays, ALERT_DAY_OPTIONS,
  SECTOR_CATEGORIES, categoryLabel, parseRegulationSummary,
  LEGAL_TABS, parseLegalTab, LEGAL_ONLY_CATEGORIES, KIND_LABEL, moduleFeed,
  CAREER_TABS, parseCareerTab, parseSteps, parseStringList,
  MODULE_ALIASES, EVENT_TYPES, EVENT_TYPE_BY_TTB, parseEventTypes, parseScope, scopeBadge,
} from "@/lib/doctorium";
import { isHealthRelated, categorize, parseTurkishDate } from "@/lib/doctorium-sources";
import { pubDate } from "@/lib/doctorium-ingest";
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

  it("tercih yoksa doktorun KENDİ branşına düşer (boş akış gösterilmez)", () => {
    expect(effectiveBranches(null, "Onkoloji")).toEqual(["onkoloji"]);
    expect(effectiveBranches("[]", "Kardiyoloji")).toEqual(["kardiyoloji"]);
  });

  it("tercih varsa kendi branşı ezilir (doktor ne seçtiyse o)", () => {
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
  it("7 modül, mevzuat SONDA (v6.51 sıra kararı · v6.89 kariyer eklendi)", () => {
    const keys = DOCTORIUM_MODULES.map((m) => m.key);
    // Sıra kullanıcı kararı (2026-08-01): mevzuat EN SONDA.
    // v6.89: "kariyer" etkinlikten SONRA, hukuktan ÖNCE (kullanıcı kararı 2026-08-12).
    // v6.120: "kongre" anahtarı "etkinlik" oldu (kullanıcı kararı 2026-08-19) — sıra korundu.
    expect(keys).toEqual(["akis", "akademik", "sektorel", "ilac", "etkinlik", "kariyer", "mevzuat"]);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("eski ?m=kongre anahtarı etkinliğe alias'lanır (v6.120 — yer imleri kırılmasın)", () => {
    expect(MODULE_ALIASES.kongre).toBe("etkinlik");
    // Alias yalnız ESKİ anahtarlar içindir: geçerli bir modül anahtarını gölgelememeli.
    const keys = new Set(DOCTORIUM_MODULES.map((m) => m.key));
    for (const eski of Object.keys(MODULE_ALIASES)) expect(keys.has(eski as never)).toBe(false);
  });
});

describe("etkinlik türleri (v6.120 — TTB taksonomisi)", () => {
  it("9 tür, TTB kod önekleri ve slug'lar tekil", () => {
    expect(EVENT_TYPES).toHaveLength(9);
    expect(new Set(EVENT_TYPES.map((t) => t.key)).size).toBe(9);
    expect(new Set(EVENT_TYPES.map((t) => t.ttb)).size).toBe(9);
    // TTB kaydındaki kod önekleri (vault output/ste-kredilendirme-arastirmasi-2026-08-19.md §5.1).
    expect(EVENT_TYPE_BY_TTB.SMP).toBe("sempozyum");
    expect(EVENT_TYPE_BY_TTB.KNG).toBe("kongre");
    expect(EVENT_TYPE_BY_TTB.GRP).toBe("atolye");
  });

  it("varsayılan süzgeç kongre + sempozyum; ?t=hepsi süzgeci kaldırır", () => {
    expect(parseEventTypes(undefined)).toEqual(["kongre", "sempozyum"]);
    expect(parseEventTypes("hepsi")).toBeNull();
    expect(parseEventTypes("sempozyum,kurs")).toEqual(["sempozyum", "kurs"]);
  });

  it("bozuk/bilinmeyen tür VARSAYILANA döner — liste asla boş kalmaz", () => {
    // Fail-safe: URL kurcalanınca doktor boş sekme değil, varsayılan görünüm görür.
    expect(parseEventTypes("uydurma")).toEqual(["kongre", "sempozyum"]);
    expect(parseEventTypes("uydurma,sempozyum")).toEqual(["sempozyum"]);
  });
});

describe("kapsam (v6.120 — üçüncü değer)", () => {
  it("uluslararası KATILIMLI ayrı bir kapsamdır, uluslararası ile karışmaz", () => {
    expect(parseScope("uluslararasi-katilimli")).toBe("uluslararasi-katilimli");
    expect(scopeBadge("uluslararasi-katilimli")).toContain("katılımlı");
    expect(scopeBadge("uluslararasi")).not.toContain("katılımlı");
    expect(parseScope("uydurma")).toBeNull();
  });

  it("8 sektörel kategori tanımlı ve etiketleri çözülür", () => {
    // v6.99 (2026-08-15): "meslek" + "kuresel" eklendi — doktorun kendi mesleki gündemi yönetimden,
    // küresel gündem teknolojiden ayrıldı.
    expect(SECTOR_CATEGORIES).toHaveLength(8);
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

// ── v6.86: Hukuk modülü (Mevzuat · İçtihat alt-sekmeleri) ──
describe("Hukuk modülü sözleşmesi (v6.86)", () => {
  it('modülün kullanıcı-yüzü adı "Hukuk", iç anahtar "mevzuat" (migration\'sız dönüşüm)', () => {
    const m = DOCTORIUM_MODULES.find((x) => x.key === "mevzuat");
    expect(m?.label).toBe("Hukuk");
  });

  it("alt-sekmeler: mevzuat + ictihat + doktrin (v6.91'de Doktrin gerçek içerikle AÇILDI)", () => {
    expect(LEGAL_TABS.map((t) => t.key)).toEqual(["mevzuat", "ictihat", "doktrin"]);
  });

  it("parseLegalTab bilinmeyen/eksik değeri Mevzuat'a düşürür (URL kurcalanması akışı bozmaz)", () => {
    expect(parseLegalTab("ictihat")).toBe("ictihat");
    expect(parseLegalTab("mevzuat")).toBe("mevzuat");
    expect(parseLegalTab("doktrin")).toBe("doktrin"); // v6.91: sekme gerçek içerikle açıldı
    expect(parseLegalTab("yok-boyle")).toBe("mevzuat");
    expect(parseLegalTab(undefined)).toBe("mevzuat");
  });

  it("İçtihat/Doktrin kind etiketleri tanımlı; ikisi de SECTOR_CATEGORIES'e SIZMAZ", () => {
    expect(KIND_LABEL.ictihat).toBe("İçtihat");
    expect(KIND_LABEL.doktrin).toBe("Doktrin");
    expect(SECTOR_CATEGORIES.some((c) => LEGAL_ONLY_CATEGORIES.includes(c.key))).toBe(false);
    expect(categoryLabel("ictihat")).toBeNull(); // kartta çift rozet (kind + kategori) basılmaz
    expect(categoryLabel("doktrin")).toBeNull();
  });

  it("Mevzuat alt-sekmesinin dışlama listesi içtihat+doktrini kapsar", () => {
    expect(LEGAL_ONLY_CATEGORIES).toEqual(expect.arrayContaining(["ictihat", "doktrin"]));
  });
});

// ── v6.87: moduleFeed WHERE kurgusu (mock findMany'ye giden argüman incelenir) ──
describe("moduleFeed sorgu kurgusu (v6.87)", () => {
  it("excludeCategories NULL kategorili satırı KORUR (Prisma NOT tuzağı: notIn null'ı da elerdi)", async () => {
    feedFindMany.mockResolvedValue([]);
    await moduleFeed("mevzuat", [], { excludeCategories: ["ictihat", "doktrin"] });
    const where = feedFindMany.mock.calls.at(-1)![0].where;
    expect(where.AND).toEqual([
      { OR: [{ category: null }, { category: { notIn: ["ictihat", "doktrin"] } }] },
    ]);
  });

  it("textContainsAny desenleri OR-contains olarak AND dizisine girer (insensitive)", async () => {
    feedFindMany.mockResolvedValue([]);
    await moduleFeed("mevzuat", [], { category: "ictihat", textContainsAny: ["malpraktis", "hekim hatası"] });
    const where = feedFindMany.mock.calls.at(-1)![0].where;
    expect(where.category).toBe("ictihat");
    expect(where.AND).toEqual([
      {
        OR: [
          { summary: { contains: "malpraktis", mode: "insensitive" } },
          { summary: { contains: "hekim hatası", mode: "insensitive" } },
        ],
      },
    ]);
  });

  it("akademikte branş OR'u ile filtre AND'i ÇAKIŞMAZ (spread'de OR anahtarı ezilme tuzağı)", async () => {
    feedFindMany.mockResolvedValue([]);
    await moduleFeed("akademik", ["onkoloji"], { textContainsAny: ["x"] });
    const where = feedFindMany.mock.calls.at(-1)![0].where;
    expect(where.OR).toEqual([{ branchSlugs: { contains: '"onkoloji"' } }]); // branş OR'u yerinde
    expect(where.AND).toHaveLength(1); // metin filtresi ayrı eksende yaşıyor
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
    // v6.99: doktorun ÜCRETİ/özlüğü artık "meslek" — kurum işletmesi (hastane) "yonetim" kalır.
    expect(categorize("İşyeri Hekimliği Ücret Tarifeleri açıklandı")).toBe("meslek");
    expect(categorize("Özel Hastaneler Yönetmeliğinde Değişiklik")).toBe("yonetim");
  });

  // v6.99 — "doktorlarla ilgili" genişleme (kullanıcı isteği 2026-08-15)
  it("mesleki gündem 'meslek'e, uluslararası gündem 'kuresel'e düşer", () => {
    expect(categorize("Asistan hekim nöbet ücretlerine ilişkin düzenleme")).toBe("meslek");
    expect(categorize("Sağlıkta şiddet yasası TBMM gündeminde")).toBe("meslek");
    expect(categorize("Physicians Working Excessive Hours More Likely to Quit")).toBe("meslek");
    expect(categorize("WHO declares new outbreak response phase")).toBe("kuresel");
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

// ── v6.89: Kariyer modülü (küratörlü denklik rehberi) ──
describe("Kariyer modülü sözleşmesi (v6.89)", () => {
  it("alt-sekmeler: yurtdisi + turkiye; 'İK Fırsatları' sekmesi YOK (İŞKUR izni gelmeden açılmaz)", () => {
    expect(CAREER_TABS.map((t) => t.key)).toEqual(["yurtdisi", "turkiye"]);
    // İş ilanı/aracılık fazı özel istihdam bürosu izni ister — izinsiz sekme açılamaz.
    expect(CAREER_TABS.some((t) => /ilan|İK|is-firsat/i.test(t.key))).toBe(false);
  });

  it("parseCareerTab bilinmeyen/eksik değeri Yurt Dışı'na düşürür (URL kurcalanması akışı bozmaz)", () => {
    expect(parseCareerTab("turkiye")).toBe("turkiye");
    expect(parseCareerTab("yurtdisi")).toBe("yurtdisi");
    expect(parseCareerTab("ik-firsatlari")).toBe("yurtdisi");
    expect(parseCareerTab(undefined)).toBe("yurtdisi");
    expect(parseCareerTab("../../etc")).toBe("yurtdisi");
  });

  it("parseSteps bozuk/eksik JSON'da çökmez ve adımları order'a göre sıralar", () => {
    expect(parseSteps(null)).toEqual([]);
    expect(parseSteps("{bozuk")).toEqual([]);
    expect(parseSteps('{"order":1}')).toEqual([]); // dizi değil
    const s = parseSteps('[{"order":2,"title":"b","detail":"y"},{"order":1,"title":"a","detail":"x"},{"order":3}]');
    expect(s.map((x) => x.title)).toEqual(["a", "b"]); // eksik alanlı kayıt elenir
  });

  it("parseStringList bozuk JSON'da boş döner, metin olmayanları eler", () => {
    expect(parseStringList(null)).toEqual([]);
    expect(parseStringList("{bozuk")).toEqual([]);
    expect(parseStringList('["a",5,"b",null]')).toEqual(["a", "b"]);
  });
});

// Seed verisinin İÇERİK DÜRÜSTLÜĞÜ sözleşmesi — bu modül idari süreç anlatır, yanlış bilgi
// doktorun gerçek kaybıdır (kaçırılan sınav, eksik belge). Kurallar burada KİLİTLENİR.
describe("Kariyer seed verisi dürüstlük kuralları (v6.89)", () => {
  const rows = JSON.parse(
    readFileSync(join(process.cwd(), "prisma", "seed-data", "career-pathways.json"), "utf8"),
  ) as Record<string, unknown>[];

  it("her kayıtta resmî kaynak var ve https (kaynağı olmayan kayıt YAYINLANMAZ)", () => {
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(String(r.officialUrl), String(r.slug)).toMatch(/^https:\/\//);
    }
  });

  it("her kayıtta doğrulama tarihi var ve GELECEK değil (bayatlık gizlenmez, uydurulmaz)", () => {
    const yarin = new Date();
    yarin.setDate(yarin.getDate() + 1);
    for (const r of rows) {
      const d = new Date(String(r.verifiedAt));
      expect(Number.isNaN(d.getTime()), String(r.slug)).toBe(false);
      expect(d.getTime(), String(r.slug)).toBeLessThan(yarin.getTime());
    }
  });

  it("scope ve confidence yalnız tanımlı değerler; slug tekrar etmez", () => {
    const slugs = new Set<string>();
    for (const r of rows) {
      expect(["yurtdisi", "turkiye"]).toContain(r.scope);
      expect(["dogrulandi", "kismi"]).toContain(r.confidence ?? "dogrulandi");
      expect(slugs.has(String(r.slug)), `tekrar: ${r.slug}`).toBe(false);
      slugs.add(String(r.slug));
    }
  });

  it("adımsız süreç kartı yok — her kayıtta en az bir adım", () => {
    for (const r of rows) {
      expect(Array.isArray(r.steps), String(r.slug)).toBe(true);
      expect((r.steps as unknown[]).length, String(r.slug)).toBeGreaterThan(0);
    }
  });

  it("VAAT DİLİ yok — süre/kesinlik iddiası içeren ifadeler özet ve uyarıda geçmez", () => {
    // "3-6 ayda alırsınız" gibi ifadeler yasak; süre yalnız typicalMonths alanında ve yalnız
    // resmî kaynakta yazıyorsa durur (bugün hepsi null — hiçbiri resmî sayfadan doğrulanamadı).
    const yasak = /\b(garanti|kesinlikle|mutlaka)\b|\bay içinde (alır|tamamlan)/i;
    for (const r of rows) {
      expect(yasak.test(String(r.summary)), `${r.slug} özet`).toBe(false);
      if (r.warning) expect(yasak.test(String(r.warning)), `${r.slug} uyarı`).toBe(false);
    }
  });
});

// v6.85 — PubMed tarihi. Vakalar CANLI esummary çıktısından alındı (2026-08-12 ölçümü):
// kapak tarihi gelecekte, gerçek çevrimiçi yayın epubdate'te.
describe("PubMed yayın tarihi", () => {
  const iso = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;

  it("epubdate kapak tarihini EZER — sürekli-yayın dergisi 31 Aralık'a yığmaz", () => {
    // PMID 42246474 (Oncoimmunology): kapak "2026 Dec 31", çevrimiçi 5 Haziran.
    expect(iso(pubDate("2026 Dec 31", "2026/12/31 00:00", "2026 Jun 5"))).toBe("2026-06-05");
  });

  it("aylık/iki-aylık derginin gelecek sayısı da epubdate'e düşer", () => {
    expect(iso(pubDate("2026 Dec", "2026/12/01 00:00", "2026 Jul 20"))).toBe("2026-07-20");
    expect(iso(pubDate("2026 Sep-Oct 01", "2026/09/01 00:00", "2026 Jun 29"))).toBe("2026-06-29");
  });

  it("epubdate yoksa kapak tarihi kullanılır (geçmişteyse dokunulmaz)", () => {
    expect(iso(pubDate("2025 Mar 14", "2025/03/14 00:00", undefined))).toBe("2025-03-14");
    expect(iso(pubDate("2025 Mar", undefined, undefined))).toBe("2025-03-01");
  });

  it("elde yalnız gelecek tarih varsa BUGÜNE kırpılır — ileri tarih listeyi işgal edemez", () => {
    const r = pubDate("2099 Dec 31", "2099/12/31 00:00", undefined);
    expect(r).not.toBeNull();
    expect(r!.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("epubdate gelecekteyse ona da güvenilmez (kırpma her yola uygulanır)", () => {
    const r = pubDate("2099 Dec 31", undefined, "2099 Nov 1");
    expect(r!.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("tarih yoksa null — kayıt atlanır, uydurma tarih yazılmaz", () => {
    expect(pubDate(undefined, undefined, undefined)).toBeNull();
    expect(pubDate("baskıda", "", "")).toBeNull();
  });
});
