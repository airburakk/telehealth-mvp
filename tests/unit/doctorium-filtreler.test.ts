// v6.99 (2026-08-15) — Doctorium içerik süzgeçlerinin SÖZLEŞMESİ.
//
// Üç kullanıcı kararı burada kilitlenir (2026-08-15):
//   1) Doktrin YALNIZ doktor+hukuk alanı — klinik/sosyal çalışmalar akıştan çıkar.
//   2) Akademik YALNIZ seçkin dergi + kanıt üreten yayın tipi.
//   3) Sektörel akış "doktorlarla ilgili" haberlerle genişler; reklam/tüketici içeriği girmez.
//
// Vakaların ÇOĞU canlı veriden alınmıştır (dev DB'deki 192 doktrin kaydı + kaynakların 2026-08-15
// tarihli gerçek başlıkları) — kurgusal örnekle geçen süzgeç sahada kalıyordu.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scoreLegalRelevance } from "@/lib/doktrin-filter";
import { tier1Query, tier2Query, BRANCH_JOURNALS, GENERAL_JOURNALS } from "@/lib/academic-journals";
import {
  isProfessionallyRelevant, categorize, parseItoDate,
  NEWS_IMAGE_HOSTS, allowedImageUrl, extractOgImage, RSS_SOURCES,
} from "@/lib/doctorium-sources";
import { SECTOR_SOURCE_SCOPES } from "@/lib/doctorium";

describe("Doktrin — hukuk alaka süzgeci (v6.99)", () => {
  it("özetteki RUTİN onam cümlesi tek başına doktrin yapmaz (kirliliğin ana kaynağı)", () => {
    const v = scoreLegalRelevance({
      title: "Ankilozan Spondilitli İki Olguda Zor Havayolu Yönetimi",
      abstract: "Olgularımızda işlem öncesi hastalardan aydınlatılmış onam alınmıştır. Havayolu…",
      journal: "Anestezi Dergisi",
    });
    expect(v.accepted).toBe(false);
    expect(v.reason).toMatch(/rutin/);
  });

  it("başlıkta hukuk terimi geçen makale kabul edilir (konum ağırlığı)", () => {
    expect(scoreLegalRelevance({
      title: "Hekimin Hukuki Sorumluluğu",
      abstract: "…", journal: "Hamidiye Medical Journal",
    }).accepted).toBe(true);
  });

  it("hukuk dergisi bağımsız delildir — tıp sözcüğü başlıkta olmasa da geçer", () => {
    expect(scoreLegalRelevance({
      title: "Malpraktis Davalarında Bilirkişilik",
      journal: "Ankara Üniversitesi Hukuk Fakültesi Dergisi",
    }).accepted).toBe(true);
  });

  it("Türkçe ÇEKİM ve çift boşluk süzgeci kırmaz (kök desen + normalizasyon)", () => {
    // "tıbbi uygulama hatası" değil "Hatası" ve iki boşluk — ilk turda bu makale eleniyordu.
    expect(scoreLegalRelevance({
      title: "Fizik Tedavi ve Rehabilitasyon Hekimlerine Yönelik Tıbbi Uygulama  Hatası İddiaları",
      journal: "Fiziksel Tıp ve Rehabilitasyon Bilimleri Dergisi",
    }).accepted).toBe(true);
  });

  it("İngilizce başlık da yakalanır (TR-Dizin kayıtları çift dillidir)", () => {
    expect(scoreLegalRelevance({
      title: "The Effect of Malpractice Education on Attitudes Towards Medical Errors",
      journal: "Türkiye Klinikleri Tıp Etiği-Hukuku Tarihi Dergisi",
    }).accepted).toBe(true);
  });

  it("hukukla ilgisiz klinik/sosyal çalışma elenir", () => {
    for (const t of [
      "Üroloji Hekimlerinin Perkütan Nefrostomi Deneyimleri: Türkiye Verisi",
      "Kadınların Kooperatifleşmesi Sonrası Sosyal Yaşamlarında Değişen Dinamikler",
      "Over Kanseri Tanısı Almış Hastaların Semptomlarının Değerlendirilmesi",
    ]) {
      expect(scoreLegalRelevance({ title: t, journal: "Sağlık Bilimleri Dergisi" }).accepted, t).toBe(false);
    }
  });

  it("veteriner içeriği KESİN dışlanır (insan sağlığı hukuku değil)", () => {
    const v = scoreLegalRelevance({ title: "VETERİNER HEKİMLİĞİNDE MALPRAKTİS", journal: "Van Veterinary Journal" });
    expect(v.accepted).toBe(false);
    expect(v.reason).toMatch(/veteriner/);
  });

  it("saf hukuk metni (tıp bağlamı yok) Doctorium'a girmez", () => {
    const v = scoreLegalRelevance({ title: "Kira Sözleşmesinde Tahliye Davası", journal: "Legal Hukuk Dergisi" });
    expect(v.accepted).toBe(false);
    expect(v.reason).toMatch(/tıp bağlamı/);
  });
});

describe("Akademik — seçkin dergi + kanıt düzeyi (v6.99)", () => {
  it("katman 1: beyaz-liste dergi VE kanıt tipi ister, kanıtsız tipleri dışlar", () => {
    const q = tier1Query("cardiovascular diseases[mh]", "kardiyoloji");
    expect(q).toContain('"Circulation"[ta]');
    expect(q).toContain('"N Engl J Med"[ta]'); // genel dergiler her branşa eklenir
    expect(q).toContain('"randomized controlled trial"[pt]');
    expect(q).toContain('NOT ("editorial"[pt]');
    expect(q).toContain("hasabstract");
  });

  it("katman 2 (yedek): dergi serbest ama kanıt tipi ŞART", () => {
    const q = tier2Query("general surgery[mh]");
    expect(q).not.toContain("[ta]");
    expect(q).toContain('"meta-analysis"[pt]');
    expect(q).toContain("NOT (");
  });

  it("branş listesi olmayan slug genel dergilerle çalışır (liste boş kalmaz)", () => {
    const q = tier1Query("x[mh]", "bilinmeyen-brans");
    for (const j of GENERAL_JOURNALS) expect(q).toContain(`"${j}"[ta]`);
  });

  it("her branş listesi dolu ve dergiler tekrarsız", () => {
    for (const [slug, list] of Object.entries(BRANCH_JOURNALS)) {
      expect(list.length, slug).toBeGreaterThan(0);
      expect(new Set(list).size, slug).toBe(list.length);
    }
  });
});

describe("Sektörel — mesleki alaka süzgeci (v6.99)", () => {
  it("reklam/advertorial ve tüketici içeriği elenir", () => {
    for (const t of [
      "Türkiye'nin En İyi 10 Saç Ekimi Kliniği (2026): Teknik, Akreditasyon ve Greft Analizi",
      "Ekşi Mayalı Ekmek Hakkında Bilim İnsanlarından Tüketicilere Önemli Uyarılar",
      "Masseter Botoks İstanbul: Çene Bölgesinde Estetik ve Fonksiyonel Çözüm",
    ]) {
      expect(isProfessionallyRelevant(t), t).toBe(false);
    }
  });

  it("mesleki ve klinik haberler alınır (TR + EN)", () => {
    for (const t of [
      "Why Physicians Are Losing Their Friends",
      "US CDC Records More Than 2,500 Measles Cases So Far in 2026",
      "Erzurum İl Sağlık Müdürlüğünde Görev Değişimi: Uzm. Dr. Mehmet Meral Yeni Müdür Oldu",
      "Genç Hekim İntiharları Çalıştayı Raporu Yayımlandı",
    ]) {
      expect(isProfessionallyRelevant(t), t).toBe(true);
    }
  });

  it("kurum içi etkinlik duyurusu akışa girmez (iç bülten gürültüsü)", () => {
    expect(isProfessionallyRelevant("LÖSEV Odamızı Ziyaret Etti")).toBe(false);
    expect(isProfessionallyRelevant("İstanbul Tabip Odası'ndan Satış İlanı")).toBe(false);
  });

  it("kategori ataması: mesleki gündem yönetime karışmaz", () => {
    expect(categorize("Asistan hekimlerin nöbet ücreti düzenlemesi")).toBe("meslek");
    expect(categorize("Özel Hastaneler Yönetmeliğinde Değişiklik")).toBe("yonetim");
  });
});

// v6.99.2 — haber görseli (kullanıcı isteği 2026-08-16): allowlist + og:image çıkarımı + CSP sözleşmesi
describe("Haber görseli — allowlist & og:image (v6.99.2)", () => {
  it("yalnız allowlist'li https host'lar geçer", () => {
    expect(allowedImageUrl("https://www.istabip.org.tr/site_icerik/2026/agustos/x.png")).toBeTruthy();
    expect(allowedImageUrl("https://cdn.who.int/media/images/y.jpg?sfvrsn=1")).toBeTruthy();
    expect(allowedImageUrl("https://evil.example.com/x.png")).toBeNull(); // listede yok
    expect(allowedImageUrl("http://www.ohsad.org/x.jpg")).toBeNull(); // https değil
    expect(allowedImageUrl("not-a-url")).toBeNull();
    expect(allowedImageUrl(null)).toBeNull();
  });

  it("og:image meta'sı iki öznitelik sırasında da çıkarılır; allowlist dışı URL yok sayılır", () => {
    const a = `<meta property="og:image" content="https://www.ohsad.org/wp-content/uploads/2026/07/HC_manset.jpg" />`;
    const b = `<meta content="https://cdn.who.int/media/z.jpg" property="og:image" />`;
    const c = `<meta property="og:image" content="https://cdn.evil.com/z.jpg" />`;
    expect(extractOgImage(a)).toContain("ohsad.org");
    expect(extractOgImage(b)).toContain("cdn.who.int");
    expect(extractOgImage(c)).toBeNull();
    expect(extractOgImage("<html>görselsiz</html>")).toBeNull();
  });

  it("SÖZLEŞME: NEWS_IMAGE_HOSTS'un her host'u CSP img-src'ta listeli (next.config.ts)", () => {
    // Allowlist ile CSP el ele değişmeli — biri güncellenip diğeri unutulursa görseller
    // tarayıcıda sessizce engellenir (CSP ihlali konsola düşer, kullanıcı kırık görsel görür).
    const config = readFileSync(join(process.cwd(), "next.config.ts"), "utf-8");
    const imgSrc = /"img-src [^"]+"/.exec(config)?.[0] ?? "";
    expect(imgSrc, "img-src satırı bulunamadı").not.toBe("");
    for (const host of NEWS_IMAGE_HOSTS) {
      expect(imgSrc, `CSP img-src '${host}' içermiyor — next.config.ts'i güncelle`).toContain(`https://${host}`);
    }
  });
});

// v6.99.3 — sektörel "Kaynak" filtresi (kullanıcı isteği 2026-08-16)
describe("Sektörel kaynak kapsamı (v6.99.3)", () => {
  it("ulusal/uluslararası listeleri kesişmez", () => {
    const u = new Set(SECTOR_SOURCE_SCOPES.ulusal);
    for (const s of SECTOR_SOURCE_SCOPES.uluslararasi) expect(u.has(s), s).toBe(false);
  });

  it("SÖZLEŞME: sektörel modüle yazan HER kaynak iki listeden birinde (sessiz kayıp olmasın)", () => {
    // Sektörel modüle yazan kaynaklar: sabit toplayıcılar (ttb/ohsad/istabip/who) + RSS_SOURCES.
    // Yeni kaynak eklenip kapsam listesi unutulursa o kaynak "Tümü"nde görünür ama Ulusal/
    // Uluslararası filtrelerinin İKİSİNDE de kaybolur — bu test onu yakalar.
    const covered = new Set([...SECTOR_SOURCE_SCOPES.ulusal, ...SECTOR_SOURCE_SCOPES.uluslararasi]);
    const sectorSources = ["ttb", "ohsad", "istabip", "who", ...RSS_SOURCES.map((s) => s.source)];
    for (const s of sectorSources) {
      expect(covered.has(s), `'${s}' kaynağı SECTOR_SOURCE_SCOPES'ta yok — lib/doctorium.ts'e ekle`).toBe(true);
    }
  });
});

describe("İstanbul Tabip Odası tarih ayrıştırma (v6.99)", () => {
  const block = (d: string, mo: string, y: string) =>
    `<span class="g-color-primary g-font-size-50 g-line-height-1 mr-3">${d}</span>` +
    `<div><span class="d-block">${mo}</span><span class="d-block">${y}</span></div>`;

  it("sitenin kendi kısaltmalarını çözer (AUĞ. gibi)", () => {
    expect(parseItoDate(block("14", "AUĞ.", "2026"))?.toISOString().slice(0, 10)).toBe("2026-08-14");
    expect(parseItoDate(block("3", "OCA.", "2026"))?.toISOString().slice(0, 10)).toBe("2026-01-03");
  });

  it("çözülemeyen tarih null döner (uydurulmaz — çağıran bugüne düşer)", () => {
    expect(parseItoDate(block("14", "XYZ", "2026"))).toBeNull();
    expect(parseItoDate("<div>tarihsiz blok</div>")).toBeNull();
  });
});
