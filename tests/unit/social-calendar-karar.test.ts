// İçerik takvimi — Yargıtay kararı ayrıştırıcı + aday seçici + taslak üretici sözleşmeleri (v6.328, 2026-10-06).
// Fixture iskeleti 2026-10-06'da DEV'den çekilen GERÇEK 3. HD kararlarının biçimidir (V. TEMYİZ → A. Temyiz Sebepleri → B. gerekçe →
// VI. KARAR; ` ` garip boşluk; "..." anonimleştirme yer tutucuları); içerik kısaltılmış/uydurma — yalnız YAPI gerçektir.
import { describe, expect, it } from "vitest";
import {
  EMPTY_CONTEXT,
  GEREKCE_MAX,
  OUTCOME_LABEL,
  analyzeKarar,
  buildKararDraft,
  cleanParagraphs,
  gerekceOptions,
  parseKarar,
  pickKararCandidates,
  type KararSource,
} from "@/lib/social-calendar/karar";
import { normalizePayload, payloadHash } from "@/lib/social-calendar/payload";
import { ELLIPSIS, verifyQuote } from "@/lib/social-calendar/text";

const NOW = new Date("2026-10-06T10:00:00Z");

const FILLER = "Davacı vekili; müvekkilinin tedavi sürecinde ortaya çıkan sonuçlar nedeniyle zarar gördüğünü, işlemin tüm aşamalarında yeterince bilgilendirilmediğini ileri sürerek maddi ve manevi tazminat talep etmiştir. ".repeat(4);

interface Opts {
  daire?: string;
  esas?: string;
  karar?: string;
  tarih?: string;
  uyus?: string | null;
  bHead?: string;
  gerekce?: string[];
  kararSatirlari?: string[];
  header?: string;
  publishedAt?: string;
  dairesiBasligi?: boolean;
}

const DEFAULT_GEREKCE = [
  "Dosyaya kazandırılan Adli Tıp Kurumu raporunda; uygulanan işlemin endikasyon ve tekniğinin tıbben uygun olduğu, gelişen durumun her türlü dikkat ve özene rağmen ortaya çıkabilecek komplikasyonlardan olduğu belirtilmiştir.",
  "Temyiz edilen kararda belirtilen gerekçeye ve hükme esas alınan raporların birbiriyle uyumlu, denetime elverişli olduğunun anlaşılmasına göre, davacı vekilinin temyiz itirazlarının reddi ile usul ve kanuna uygun olan kararın onanmasına karar verilmiştir.",
];

function karar(o: Opts = {}): KararSource {
  const daire = o.daire ?? "3. Hukuk Dairesi";
  const esas = o.esas ?? "2025/4384";
  const kno = o.karar ?? "2026/1817";
  const uyus =
    o.uyus === null
      ? ""
      : `${o.uyus ?? "Uyuşmazlık, davalı özel sağlık kuruluşu ile davalı doktorun vekalet sözleşmesinden kaynaklanan özen borcuna aykırı davranıldığı iddiasına dayalı maddi ve manevi tazminat istemine ilişkindir."}\n`;
  const summary = `${daire}         ${esas} E.  ,  ${kno} K.

${o.header ?? `"İçtihat Metni"MAHKEMESİ : İzmir Bölge Adliye Mahkemesi 21. Hukuk Dairesi
SAYISI : 2024/1904 E., 2025/1738 K.
İLK DERECE MAHKEMESİ : ... 2. Tüketici Mahkemesi
SAYISI : 2019/386 E., 2023/384 K.`}

Bölge Adliye Mahkemesi kararı davacı vekili tarafından temyiz edilmekle; gereği düşünüldü:
I. DAVA
${FILLER}
II. CEVAP
Davalılar vekili; davacının işlemlerin tüm aşamalarında bilgilendirildiğini ve onam formlarının imzalandığını savunarak davanın reddini istemiştir.
III. İLK DERECE MAHKEMESİ KARARI
İlk Derece Mahkemesinin kararıyla; talebin kısmen kabulüne karar verilmiş; karara karşı istinaf başvurusunda bulunulmuştur.
IV. İSTİNAF
Bölge Adliye Mahkemesinin kararıyla; istinaf başvurusunun esastan reddine karar verilmiş; karara karşı temyiz isteminde bulunulmuştur.
V. TEMYİZ
A. Temyiz Sebepleri
${FILLER}
B. ${o.bHead ?? "Değerlendirme ve Gerekçe"}
${uyus}${(o.gerekce ?? DEFAULT_GEREKCE).join("\n")}
VI. KARAR
Açıklanan sebeplerle;
${(o.kararSatirlari ?? ["Temyiz olunan Bölge Adliye Mahkemesi kararının 6100 sayılı Hukuk Muhakemeleri Kanunu'nun 370/1 maddesi uyarınca ONANMASINA,", "Dosyanın İlk Derece Mahkemesine gönderilmesine,", `${o.tarih ?? "01.04.2026"} tarihinde oy birliğiyle karar verildi.`]).join("\n")}`;
  return {
    id: `id-${esas.replace("/", "-")}`,
    externalId: `ext-${esas}`,
    title: `Yargıtay ${daire} · E. ${esas}, K. ${kno}`,
    summary,
    publishedAt: o.publishedAt ?? "2026-04-01T00:00:00Z",
  };
}

describe("parseKarar — modern iskelet", () => {
  const p = parseKarar(karar());
  it("başlıktan daire/esas/karar; KARAR satırından tarih ve oy", () => {
    expect(p.daire).toBe("3. Hukuk Dairesi");
    expect(p.esas).toBe("2025/4384");
    expect(p.karar).toBe("2026/1817");
    expect(p.tarih).toBe("01.04.2026");
    expect(p.oy).toBe("oy birliği");
    expect(p.modern).toBe(true);
  });
  it("üstbilgi: BAM + ilk derece ve sayıları", () => {
    expect(p.header.mahkeme).toBe("İzmir Bölge Adliye Mahkemesi 21. Hukuk Dairesi");
    expect(p.header.mahkemeSayisi).toBe("2024/1904 E., 2025/1738 K.");
    expect(p.header.ilkDerece).toBe("... 2. Tüketici Mahkemesi");
    expect(p.header.ilkDereceSayisi).toBe("2019/386 E., 2023/384 K.");
  });
  it("uyuşmazlık cümlesi ayrılır; gerekçe paragrafları kalır (başlık satırı karışmaz)", () => {
    expect(p.uyusmazlik).toMatch(/^Uyuşmazlık, davalı özel sağlık kuruluşu/);
    expect(p.uyusmazlik).toMatch(/ilişkindir\.$/);
    expect(p.gerekce).toHaveLength(2);
    expect(p.gerekce.join(" ")).not.toContain("Uyuşmazlık,");
    expect(p.gerekce.some((g) => /^B\./.test(g))).toBe(false);
  });
  it("sonuç: ONANMASINA → onama", () => {
    expect(p.outcome).toBe("onama");
  });
});

describe("parseKarar — varyantlar", () => {
  it("gerekçe başlığı adı farklıysa da (Uyuşmazlık ve Hukuki Nitelendirme / Gerekçe ve Değerlendirme) çalışır", () => {
    for (const bHead of ["Uyuşmazlık ve Hukuki Nitelendirme", "Gerekçe ve Değerlendirme"]) {
      const p = parseKarar(karar({ bHead }));
      expect(p.uyusmazlik, bHead).toBeTruthy();
      expect(p.gerekce.length, bHead).toBeGreaterThan(0);
    }
  });
  it("sonuç türleri: bozma · düzelterek onama · kısmi (bozma+onama) · bulunamadı", () => {
    const sonuc = (satirlar: string[]) => parseKarar(karar({ kararSatirlari: satirlar })).outcome;
    expect(sonuc(["Temyiz olunan kararın HMK'nın 371. maddesi uyarınca BOZULMASINA,"])).toBe("bozma");
    expect(sonuc(["Temyiz olunan kararın DÜZELTİLEREK ONANMASINA,"])).toBe("duzelterek-onama");
    expect(sonuc(["1. Davacı yönünden BOZULMASINA,", "2. Davalı yönünden ONANMASINA,"])).toBe("kismi");
    expect(sonuc(["Dosyanın gönderilmesine,"])).toBeNull();
  });
  it("büyük harfli 'OY ÇOKLUĞUYLA' da okunur", () => {
    const p = parseKarar(karar({ kararSatirlari: ["Karar ONANMASINA,", "13.05.2026 tarihinde OY ÇOKLUĞUYLA karar verildi."] }));
    expect(p.oy).toBe("oy çokluğu");
    expect(p.tarih).toBe("13.05.2026");
  });
  it("eski biçim (TEMYİZ/KARAR başlığı yok) modern sayılmaz", () => {
    const eski: KararSource = { id: "e", title: "Yargıtay 13. Hukuk Dairesi · E. 2014/1, K. 2015/2", summary: "Davacı vekili; dava dilekçesinde ... ".repeat(200), publishedAt: "2015-01-01T00:00:00Z" };
    const p = parseKarar(eski);
    expect(p.modern).toBe(false);
    expect(p.outcome).toBeNull();
  });
});

describe("analyzeKarar — uygunluk ve eleme nedenleri", () => {
  it("normal modern karar uygundur", () => {
    const a = analyzeKarar(karar(), EMPTY_CONTEXT, NOW);
    expect(a.eligible).toBe(true);
    expect(a.why).toEqual([]);
    expect(a.excerpts?.gerekce).toContain("onanmasına karar verilmiştir");
  });
  it("her eleme nedeni doğru kodla çıkar", () => {
    expect(analyzeKarar(karar({ uyus: null }), EMPTY_CONTEXT, NOW).why).toContain("uyusmazlik");
    expect(analyzeKarar(karar({ kararSatirlari: ["Dosyanın gönderilmesine,"] }), EMPTY_CONTEXT, NOW).why).toContain("sonuc");
    expect(analyzeKarar(karar({ daire: "12. Ceza Dairesi" }), EMPTY_CONTEXT, NOW).why).toContain("dava-turu");
    const eski: KararSource = { id: "e", title: "Yargıtay 3. Hukuk Dairesi · E. 2014/1, K. 2015/2", summary: "x".repeat(5000), publishedAt: "2015-01-01T00:00:00Z" };
    expect(analyzeKarar(eski, EMPTY_CONTEXT, NOW).why).toContain("iskelet");
    const kisa = karar();
    expect(analyzeKarar({ ...kisa, summary: kisa.summary.slice(0, 1500) }, EMPTY_CONTEXT, NOW).why).toContain("kisa");
  });
  it("20.000 karakterde kesilmiş metin (KARAR bölümü yok) aday olmaz", () => {
    const k = karar();
    const kesik = { ...k, summary: k.summary.slice(0, k.summary.indexOf("VI. KARAR")) };
    expect(analyzeKarar(kesik, EMPTY_CONTEXT, NOW).eligible).toBe(false);
  });
  it("alıntıya girecek metinde sızan ad varsa aday OLMAZ (kimlik)", () => {
    const a = analyzeKarar(
      karar({
        gerekce: [
          "Dosyaya göre davacının Mina'nın erken taburcu edilmesinin komplikasyonun tespitini geciktirdiği, uygulanan işlemin tıbben uygun olduğu ve dosyadaki belgelerle uyumlu bulunduğu, bu nedenle temyiz itirazlarının reddi ile kararın onanmasına karar verilmiştir.",
        ],
      }),
      EMPTY_CONTEXT,
      NOW,
    );
    expect(a.eligible).toBe(false);
    expect(a.why).toContain("kimlik");
    expect(a.identityHits.map((h) => h.kind)).toContain("taraf-adi");
  });
  it("tek paragrafta sızıntı varsa başka temiz paragraf seçilir (aday kurtulur)", () => {
    const a = analyzeKarar(
      karar({
        gerekce: [
          "Davacının Mina'nın erken taburcu edilmesi işleminin tıbben uygun olmadığı, bu hususun uyuşmazlığa etkili olduğu ve dosyadaki belgelerle uyumlu bulunduğu anlaşılmıştır.",
          "Temyiz edilen kararda belirtilen gerekçeye ve raporların denetime elverişli olduğunun anlaşılmasına göre, davacı vekilinin temyiz itirazlarının reddi ile usul ve kanuna uygun olan kararın onanmasına karar verilmiştir.",
        ],
      }),
      EMPTY_CONTEXT,
      NOW,
    );
    expect(a.eligible).toBe(true);
    expect(a.excerpts?.gerekce).not.toContain("Mina");
  });
});

describe("analyzeKarar — tema ve puan", () => {
  it("tema: uyuşmazlık/gerekçedeki baskın terim (aydınlatılmış onam)", () => {
    const a = analyzeKarar(
      karar({
        gerekce: [
          "Aydınlatılmış onam belgesinin davacıya imzalatılmadığı, aydınlatma yükümlülüğünün yerine getirilmediği anlaşıldığından davalı doktorlara aydınlatılmış onam konusunda ispat fırsatı tanınmalıdır; eksik inceleme ile hüküm kurulması bozmayı gerektirmiştir.",
        ],
        kararSatirlari: ["Kararın BOZULMASINA,", "01.04.2026 tarihinde oy birliğiyle karar verildi."],
      }),
      EMPTY_CONTEXT,
      NOW,
    );
    expect(a.themeKey).toBe("aydinlatilmis-onam");
  });
  it("belirgin tema yoksa 'genel'", () => {
    const a = analyzeKarar(karar({ gerekce: ["Dosya içeriğine göre usul ve kanuna uygun olan kararın onanmasına karar verilmiştir ve başka bir husus bulunmamaktadır, bu nedenle temyiz itirazları yerinde görülmemiştir."], uyus: "Uyuşmazlık, taraflar arasındaki sözleşmeden kaynaklanan alacak istemine ilişkindir." }), EMPTY_CONTEXT, NOW);
    expect(a.themeKey).toBe("genel");
  });
  it("yakın zamanda işlenen tema cezalandırılır, aynı sonuç türü hafif cezalandırılır", () => {
    const base = analyzeKarar(karar(), EMPTY_CONTEXT, NOW);
    const ceza = analyzeKarar(karar(), { recentThemes: [base.themeKey], recentOutcomes: ["onama"] }, NOW);
    expect(ceza.score).toBeLessThan(base.score);
    expect(ceza.reasons.join(" ")).toContain("yakın zamanda işlendi");
  });
  it("güncellik puanı: son 30 gün > 1 yıl öncesi", () => {
    const yeni = analyzeKarar(karar({ publishedAt: "2026-09-20T00:00:00Z" }), EMPTY_CONTEXT, NOW);
    const eski = analyzeKarar(karar({ publishedAt: "2025-12-01T00:00:00Z" }), EMPTY_CONTEXT, NOW);
    expect(yeni.score).toBeGreaterThan(eski.score);
  });
});

describe("pickKararCandidates", () => {
  const pool = [
    karar({ esas: "2025/1001", karar: "2026/1", publishedAt: "2026-09-01T00:00:00Z" }),
    karar({ esas: "2025/1002", karar: "2026/2", publishedAt: "2026-08-20T00:00:00Z" }),
    karar({
      esas: "2025/1003",
      karar: "2026/3",
      publishedAt: "2026-07-01T00:00:00Z",
      gerekce: ["Estetik amaçlı yapılan müdahalede sonuç borcu bulunduğu, estetik cerrahi işleminde hastanın beklentisinin karşılanmadığı, bu nedenle eser sözleşmesi hükümlerinin uygulanması gerektiği anlaşılmakla temyiz itirazlarının reddi ile kararın onanmasına karar verilmiştir."],
      uyus: "Uyuşmazlık, estetik müdahaleden kaynaklanan maddi ve manevi tazminat istemine ilişkindir.",
    }),
    karar({ esas: "2025/1004", karar: "2026/4", daire: "12. Ceza Dairesi" }),
    karar({ esas: "2025/1005", karar: "2026/5", uyus: null }),
  ];

  it("uygun olmayanları eler ve nedenlerini sayar", () => {
    const r = pickKararCandidates(pool, EMPTY_CONTEXT, NOW, 3);
    expect(r.stats.total).toBe(5);
    expect(r.stats.eligible).toBe(3);
    expect(r.stats.rejected["dava-turu"]).toBe(1);
    expect(r.stats.rejected.uyusmazlik).toBe(1);
  });
  it("en çok limit kadar aday; mümkünse farklı temalardan; puan sırası", () => {
    const r = pickKararCandidates(pool, EMPTY_CONTEXT, NOW, 2);
    expect(r.candidates).toHaveLength(2);
    expect(new Set(r.candidates.map((c) => c.themeKey)).size).toBe(2);
    // aynı temalı iki karardan yalnız biri ilk turda girer; farklı temalı estetik karar ikinci adaydır
    expect(r.candidates.some((c) => c.themeKey === "estetik")).toBe(true);
  });
  it("aday özeti ekranda göstermelik alanları taşır", () => {
    const [c] = pickKararCandidates(pool, EMPTY_CONTEXT, NOW, 1).candidates;
    expect(c).toBeDefined();
    expect(c?.outcomeLabel).toBe(OUTCOME_LABEL.onama);
    expect(c?.daire).toBe("3. Hukuk Dairesi");
    expect(c?.uyusmazlik).toMatch(/^Uyuşmazlık,/);
    expect(c?.preview.length).toBeGreaterThan(20);
    expect(c?.reasons.length).toBeGreaterThan(0);
  });
  it("deterministik: aynı girdi → aynı sıra", () => {
    const a = pickKararCandidates(pool, EMPTY_CONTEXT, NOW, 3).candidates.map((c) => c.id);
    const b = pickKararCandidates([...pool].reverse(), EMPTY_CONTEXT, NOW, 3).candidates.map((c) => c.id);
    expect(b).toEqual(a);
  });
  it("hiç uygun aday yoksa boş liste (hata değil)", () => {
    const r = pickKararCandidates([karar({ uyus: null })], EMPTY_CONTEXT, NOW, 3);
    expect(r.candidates).toEqual([]);
    expect(r.stats.eligible).toBe(0);
  });
});

describe("buildKararDraft", () => {
  const src = karar({ tarih: "13.05.2026" });
  const draft = buildKararDraft(src, NOW);

  it("yedi slayt, doğru roller ve sıra", () => {
    expect(draft?.slides.map((s) => s.role)).toEqual(["kapak", "uyusmazlik", "mahkeme", "gerekce", "sonuc", "cikarim", "kaynak"]);
  });
  it("uyuşmazlık + gerekçe BİREBİR alıntı (quote) ve kaynakta doğrulanır — garip boşluk dahil", () => {
    const quotes = draft?.slides.filter((s) => s.quote) ?? [];
    expect(quotes.map((s) => s.role)).toEqual(["uyusmazlik", "gerekce"]);
    for (const q of quotes) expect(verifyQuote(q.body, src.summary).ok, q.role).toBe(true);
  });
  it("kendi metnimiz alıntı DEĞİL; 'Doktor için çıkarım' BOŞ (insan yazar)", () => {
    const own = draft?.slides.filter((s) => !s.quote) ?? [];
    expect(own.every((s) => s.auto)).toBe(true);
    const cikarim = draft?.slides.find((s) => s.role === "cikarim");
    expect(cikarim?.bullets ?? []).toEqual([]);
    expect(cikarim?.body).toBe("");
  });
  it("mahkeme zinciri: yer tutucu şehir adı ('...') atılır, üç kademe sırayla", () => {
    const chain = draft?.slides.find((s) => s.role === "mahkeme")?.bullets ?? [];
    expect(chain).toEqual([
      "İlk derece: 2. Tüketici Mahkemesi · 2019/386 E., 2023/384 K.",
      "İstinaf: İzmir Bölge Adliye Mahkemesi 21. Hukuk Dairesi · 2024/1904 E., 2025/1738 K.",
      "Temyiz: Yargıtay 3. Hukuk Dairesi · E. 2025/4384, K. 2026/1817",
    ]);
  });
  it("sonuç slaytı: etiket + sabit tanım + karar tarihi/oy; 'kim kazandı' iddiası yok", () => {
    const s = draft?.slides.find((x) => x.role === "sonuc");
    expect(s?.title).toBe("Karar onandı");
    expect(s?.body).toContain("Onama: Yargıtay, temyiz edilen kararı yerinde bulmuştur.");
    expect(s?.body).toContain("Karar tarihi: 13.05.2026 · oy birliği");
    expect(s?.body.toLowerCase()).not.toMatch(/kazand|kaybet/);
  });
  it("kaynak slaytı uyarıyı, altyazı da uyarıyı taşır; kaynak künyesi dolu", () => {
    const k = draft?.slides.find((s) => s.role === "kaynak");
    expect(k?.body).toContain("bilgilendirme amaçlıdır");
    expect(k?.body).toContain("hukuki görüş değildir");
    expect(draft?.caption).toContain("hukuki görüş değildir");
    expect(draft?.sources).toEqual([{ label: "Yargıtay 3. Hukuk Dairesi", ref: "E. 2025/4384, K. 2026/1817, T. 13.05.2026" }]);
  });
  it("etiketler en çok 5, '#' ile başlar; meta dolu", () => {
    expect(draft?.hashtags.length).toBeLessThanOrEqual(5);
    expect(draft?.hashtags.every((h) => h.startsWith("#"))).toBe(true);
    expect(draft?.meta).toMatchObject({ court: "Yargıtay", daire: "3. Hukuk Dairesi", esas: "2025/4384", karar: "2026/1817", tarih: "13.05.2026", sonuc: "onama" });
  });
  it("kendi metnimizde 'hekim' geçmez (terim kuralı)", () => {
    const own = (draft?.slides.filter((s) => !s.quote) ?? []).map((s) => `${s.title} ${s.body} ${(s.bullets ?? []).join(" ")}`).join(" ") + (draft?.caption ?? "");
    expect(own.toLowerCase()).not.toContain("hekim");
  });
  it("uygun olmayan karar için null", () => {
    expect(buildKararDraft(karar({ uyus: null }), NOW)).toBeNull();
    expect(buildKararDraft(karar({ daire: "12. Ceza Dairesi" }), NOW)).toBeNull();
  });
  it("uzun gerekçe paragrafı alıntı sınırına indirilir ve yine kaynakta birebir geçer", () => {
    const uzun = `${"Mahkemece hükme esas alınan raporlarda hastanın muayenesinde hasar saptanmadığı, uygulanan işlemin endikasyon ve tekniğinin uygun olduğu, ".repeat(14)}davacı vekilinin temyiz itirazlarının reddi ile kararın onanmasına karar verilmiştir.`;
    const s2 = karar({ gerekce: [uzun] });
    const d = buildKararDraft(s2, NOW);
    const g = d?.slides.find((s) => s.role === "gerekce");
    expect(g?.body.length ?? 0).toBeLessThanOrEqual(780);
    expect(g?.body).toContain(ELLIPSIS);
    expect(g?.body.endsWith("onanmasına karar verilmiştir.")).toBe(true);
    expect(verifyQuote(g?.body ?? "", s2.summary).ok).toBe(true);
  });
});

// ── v6.328 gerçek-veri turu (DEV, 246 karar): paragraf temizliği + gerekçe kesit seçimi + alternatifler ─────────────────────────────
describe("cleanParagraphs — gerçek metin düzensizlikleri", () => {
  it("numaralı alt başlıklar atılır; paragraf numaraları kırpılır", () => {
    const out = cleanParagraphs([
      "1. Uyuşmazlık ve Hukuki Nitelendirme",
      "2. İlgili Hukuk",
      "3. Değerlendirme",
      "1.Tarafların iddia ve savunmalarına göre dosya incelenmiş ve karar verilmiştir.",
      "2. Dosya kapsamındaki raporlar birbiriyle uyumludur ve denetime elverişlidir.",
      "b) Hükme esas alınan raporda belirtilen hususlar yerindedir.",
      "2.1. Taraflar arasındaki iş ve işlemler incelenmiştir.",
    ]);
    expect(out).toEqual([
      "Tarafların iddia ve savunmalarına göre dosya incelenmiş ve karar verilmiştir.",
      "Dosya kapsamındaki raporlar birbiriyle uyumludur ve denetime elverişlidir.",
      "Hükme esas alınan raporda belirtilen hususlar yerindedir.",
      "Taraflar arasındaki iş ve işlemler incelenmiştir.",
    ]);
  });
  it("tarih, kanun numarası ve tutar paragraf başında KORUNUR (numara sanılmaz)", () => {
    const out = cleanParagraphs(["31.08.2012 tarihli onam belgesi dosyada mevcuttur.", "1.000,00 TL manevi tazminat talep edilmiştir.", "6098 sayılı Kanun'un 49. maddesi uyarınca incelenmiştir."]);
    expect(out[0]).toMatch(/^31\.08\.2012 tarihli/);
    expect(out[1]).toMatch(/^1\.000,00 TL/);
    expect(out[2]).toMatch(/^6098 sayılı/);
  });
  it("satır kırığı: küçük harfle başlayan satır, noktalamasız biten önceki paragrafa eklenir; noktalı biteni BÖLMEZ", () => {
    expect(cleanParagraphs(["Rapora göre müdahalenin", "uygun olduğu anlaşılmıştır."])).toEqual(["Rapora göre müdahalenin uygun olduğu anlaşılmıştır."]);
    expect(cleanParagraphs(["Birinci paragraf bitti.", "ikinci satır küçük harfle başlıyor."])).toHaveLength(2);
  });
});

describe("gerekceOptions — kesit seçimi ve alternatifler", () => {
  const GENEL = "Bilindiği üzere zarar kavramı, hukuk düzeninde zarar verici fiilin sonucu olarak malvarlığında meydana gelen azalmadır ve zarar ile fiil arasındaki bağ aranır; ayrıca zararın kapsamı yargılama sırasında belirlenir ve gerekçede açıklanır.";
  const OLGU = "Dosyaya kazandırılan bilirkişi raporlarında, uygulanan tıbbi müdahalenin endikasyon ve tekniğinin uygun olduğu, ortaya çıkan komplikasyonun özen yükümlülüğüne aykırılıktan değil işlemin doğasından kaynaklandığı, hasta aydınlatma ve onam belgesinin ise dosyada bulunduğu belirtilmiştir.";
  const HUKUM = "Bu nedenle davacı vekilinin temyiz itirazlarının reddi ile usul ve kanuna uygun olan kararın onanmasına karar verilmiştir.";

  it("olgu yoğunluğu yüksek paragraf, genel hukuk anlatımının ÖNÜNE geçer; hüküm cümlesi sığıyorsa altına eklenir", () => {
    const opts = gerekceOptions([GENEL, OLGU, HUKUM]);
    expect(opts[0]).toContain("bilirkişi raporlarında");
    expect(opts[0]).toContain("\n\n");
    expect(opts[0]?.endsWith("onanmasına karar verilmiştir.")).toBe(true);
    expect(opts[0]).not.toContain("Bilindiği üzere");
  });
  it("seçenekler TEKRARSIZ, en çok 5, uzunluk sınırında; her biri kaynak paragraflarında BİREBİR doğrulanır", () => {
    const paras = [GENEL, OLGU, HUKUM, `${OLGU} ${OLGU}`];
    const opts = gerekceOptions(paras);
    expect(new Set(opts).size).toBe(opts.length);
    expect(opts.length).toBeLessThanOrEqual(5);
    const kaynak = paras.join("\n");
    for (const o of opts) {
      expect(o.length, o).toBeLessThanOrEqual(GEREKCE_MAX);
      expect(verifyQuote(o, kaynak).ok, o).toBe(true);
    }
  });
  it("cümle ortasından başlayan kesit baştan, noktalamasız biten sondan '[…]' ile işaretlenir", () => {
    const [bas] = gerekceOptions(["uygun olduğu tespiti dikkate alındığında bilirkişi raporu denetime elverişli bulunmuş ve karar verilmiştir ve bu rapor tıbbi açıdan değerlendirilmiştir."]);
    expect(bas?.startsWith(`${ELLIPSIS} uygun olduğu`)).toBe(true);
    const [son] = gerekceOptions(["Bilirkişi raporunda tıbbi müdahalenin uygun olduğu, komplikasyonun özen kusurundan kaynaklanmadığı ve aydınlatma belgesinin bulunduğu belirtilmiş olup bu hususlar 5013 sayılı Kanun"]);
    expect(son?.endsWith(ELLIPSIS)).toBe(true);
  });
  it("doktrin atfı ve uzun rapor aktarımı kesit OLMAZ; uygun paragraf yoksa boş", () => {
    expect(gerekceOptions(["Kusur sorumluluğu, bir kimsenin hukuka aykırı davranışla vermiş olduğu zararın giderilmesidir (Eren, Fikret: Borçlar Hukuku Genel Hükümler, 22. Baskı, Ankara 2017, s. 594)."])).toEqual([]);
    expect(gerekceOptions(["kısa"])).toEqual([]);
  });
});

describe("alternatif kesitler — taslak + kimlik taraması + meta", () => {
  const baseGerekce = (extra: string[]) => [
    "Dosyaya kazandırılan bilirkişi raporlarında uygulanan tıbbi müdahalenin endikasyon ve tekniğinin uygun olduğu, komplikasyonun özen yükümlülüğüne aykırılıktan kaynaklanmadığı, aydınlatma ve onam belgesinin dosyada bulunduğu belirtilmiştir.",
    ...extra,
    "Temyiz edilen kararda belirtilen gerekçeye ve raporların denetime elverişli olduğunun anlaşılmasına göre davacı vekilinin temyiz itirazlarının reddi ile kararın onanmasına karar verilmiştir.",
  ];
  it("taslak meta'sı birincil dahil alternatifleri taşır; ilki gerekçe slaytının gövdesidir; hepsi kaynakta birebir", () => {
    const src = karar({ gerekce: baseGerekce(["Rapordaki tespitlere göre hastanın tedavi sürecindeki işlemler tıbbi kayıtlara uygun olarak yürütülmüş, tedavi ve ameliyat sonrası bakımda eksiklik saptanmamıştır ve bu nedenle özen yükümlülüğü ihlal edilmemiştir."]) });
    const d = buildKararDraft(src, NOW);
    const alts = d?.meta?.gerekceAlts ?? [];
    expect(alts.length).toBeGreaterThan(1);
    expect(alts[0]).toBe(d?.slides.find((s) => s.role === "gerekce")?.body);
    for (const a of alts) expect(verifyQuote(a, src.summary).ok, a).toBe(true);
  });
  it("kimlik şüphesi taşıyan kesit alternatiflerden ELENİR (diğerleri kalır)", () => {
    const sizinti = "Dosyadaki bilgilere göre davacının Mina'nın erken taburcu edilmesinin tedavi sürecine etkisi bilirkişi raporunda tartışılmış, rapor ve tıbbi kayıtlar birlikte değerlendirilmiş, komplikasyon yönetimi uygun bulunmuştur.";
    const d = buildKararDraft(karar({ gerekce: baseGerekce([sizinti]) }), NOW);
    expect(d).not.toBeNull();
    for (const a of d?.meta?.gerekceAlts ?? [d?.slides.find((s) => s.role === "gerekce")?.body ?? ""]) expect(a).not.toContain("Mina");
  });
  it("meta.gerekceAlts normalize edilir: en çok 4, boş/aşırı uzun/dize olmayan atılır; HASH'E GİRMEZ", () => {
    const base = { v: 1, slides: [{ role: "kapak", title: "a", body: "b" }, { role: "genel", title: "c", body: "d" }, { role: "kaynak", title: "e", body: "f" }], caption: "Altyazı metni burada yazılı.", hashtags: [], sources: [] };
    const r = normalizePayload({ ...base, meta: { gerekceAlts: ["bir", "iki", "üç", "dört", "beş", "", 7, "x".repeat(1300)] } });
    expect(r.ok && r.payload.meta?.gerekceAlts).toEqual(["bir", "iki", "üç", "dört"]);
    const a = normalizePayload(base);
    expect(a.ok && r.ok && payloadHash(a.payload)).toBe(r.ok && payloadHash(r.payload));
  });
});
