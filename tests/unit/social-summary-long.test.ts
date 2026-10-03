// Hikâye açıklaması "uzun özet" — saf mantık + seçki entegrasyonu sözleşmeleri (v6.317, 2026-10-03).
//
// Kilitlenenler:
//   1) Kırpma CÜMLE sınırındadır (sonda "…" yok, her zaman ≤ 400); tam cümle yoksa ya da bütçenin %30'unu bile doldurmuyorsa
//      kelime sınırında "…" ile kırpılır.
//   2) Cümle sınırı tespiti: kısaltma (ör. vb. Dr. et al. e.g.) ve liste numarası ("1. Yöntem") BÖLMEZ; ondalık/p değeri bölmez;
//      sayıyla biten gerçek cümle sonu, ? ! ve kapanış tırnağı/parantezi böler; Türkçe büyük harfler (İ Ş Ç Ğ Ö Ü) cümle başıdır.
//   3) Özet kullanılamıyorsa (boş / <30 kr) metin UYDURULMAZ: kaynak + TÜRKİYE günü + "ayrıntı kaynak bağlantısında" + bayrak.
//   4) Seçki öğesi iki alanı da taşır; teaser `summary` (160) davranışı DEĞİŞMEDİ; HTML varlıkları kırpmadan ÖNCE çözülür.
import { describe, it, expect } from "vitest";
import {
  buildSummaryLong,
  cleanSummary,
  looksEnglish,
  looksLikeRawGazetteText,
  sentenceEnds,
  summaryLongFallback,
  trimToSentences,
  SUMMARY_LONG_MAX,
  SUMMARY_LONG_MIN,
} from "@/lib/social-summary-long";
import { pickSocialDigest, type SocialArticle } from "@/lib/social-digest";
import { BRANCHES } from "@/lib/triage";

/** Tam `len` karakterlik, büyük harfle başlayıp "." ile biten cümle (5 harfli kelimeler; son kelime gerekirse uzar). */
function sentence(len: number): string {
  let s = "Abcde";
  while (s.length + 6 <= len - 1) s += " abcde";
  s += "x".repeat(len - 1 - s.length);
  return `${s}.`;
}

describe("sentence yardımcısı (test iskelesi)", () => {
  it("istenen uzunlukta cümle üretir", () => {
    for (const n of [50, 150, 180, 400, 700, 900]) expect(sentence(n)).toHaveLength(n);
  });
});

describe("trimToSentences: cümle sınırından kırpma", () => {
  it("sığan metin aynen döner; boşluklar tek boşluğa iner", () => {
    expect(trimToSentences("Bir  cümle.\nİkinci\tcümle.")).toBe("Bir cümle. İkinci cümle.");
  });

  it("tam max uzunluktaki metin aynen kalır", () => {
    const t = sentence(SUMMARY_LONG_MAX);
    expect(trimToSentences(t)).toBe(t);
  });

  it("max'ı aşınca max içindeki SON tam cümlede keser (sonda '…' yok)", () => {
    const [a, b, c] = [sentence(150), sentence(150), sentence(150)];
    const out = trimToSentences(`${a} ${b} ${c}`);
    expect(out).toBe(`${a} ${b}`);
    expect(out.length).toBeLessThanOrEqual(SUMMARY_LONG_MAX);
    expect(out.endsWith("…")).toBe(false);
  });

  it("ilk cümle max'tan uzunsa kelime sınırında '…' ile keser (≤ max)", () => {
    const out = trimToSentences(sentence(900));
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(SUMMARY_LONG_MAX);
  });

  it("tam cümle bütçenin %30'unu bile doldurmuyorsa (kısa ilk + çok uzun ikinci) kelime sınırına düşer", () => {
    const short = sentence(50);
    const out = trimToSentences(`${short} ${sentence(700)}`);
    expect(out.startsWith(short)).toBe(true);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeGreaterThan(50); // kısa ilk cümlede kalmadı
    expect(out.length).toBeLessThanOrEqual(SUMMARY_LONG_MAX);
  });

  it("noktalama içermeyen uzun metin de ≤ max kalır", () => {
    const out = trimToSentences("kelime ".repeat(200));
    expect(out.length).toBeLessThanOrEqual(SUMMARY_LONG_MAX);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("sentenceEnds: cümle sınırı tespiti", () => {
  /** Her sınıra kadar olan metin — okunur karşılaştırma. */
  const upTo = (t: string) => sentenceEnds(t).map((i) => t.slice(0, i));

  it("kısaltma sonrası nokta cümle sonu değildir", () => {
    expect(upTo("Bu, ör. Ankara'da görüldü. Sonuç iyi.")).toEqual(["Bu, ör. Ankara'da görüldü."]);
    expect(upTo("Yaş ortalaması, vb. Türkiye geneli. Son.")).toEqual(["Yaş ortalaması, vb. Türkiye geneli."]);
    expect(upTo("Dr. Yılmaz anlattı. Son.")).toEqual(["Dr. Yılmaz anlattı."]);
    expect(upTo("Smith et al. The study. Next.")).toEqual(["Smith et al. The study."]);
    expect(upTo("Bu (e.g. Smith) durum. Sonra.")).toEqual(["Bu (e.g. Smith) durum."]);
  });

  it("ondalık sayı bölmez; sayıyla ya da parantezle biten gerçek cümle sonu böler", () => {
    expect(upTo("Fark anlamlıydı (p = 0.03). Sonuçlar iyi. Son.")).toEqual([
      "Fark anlamlıydı (p = 0.03).",
      "Fark anlamlıydı (p = 0.03). Sonuçlar iyi.",
    ]);
    expect(upTo("Oran 0,75 idi. Sonra.")).toEqual(["Oran 0,75 idi."]);
    expect(upTo("p = 0.03. Sonuç iyi. Son.")).toEqual(["p = 0.03.", "p = 0.03. Sonuç iyi."]);
  });

  it("tek başına 1–2 haneli sayı (liste numarası) cümleyi bölmez", () => {
    expect(upTo("Yöntemler: 1. Kesitsel tarama 2. Anket uygulandı. Sonuç.")).toEqual([
      "Yöntemler: 1. Kesitsel tarama 2. Anket uygulandı.",
    ]);
  });

  it("? ! ve kapanış tırnağı sınırdır", () => {
    expect(upTo('Etkili mi? Evet! "Çok iyi." Sonra.')).toEqual([
      "Etkili mi?",
      "Etkili mi? Evet!",
      'Etkili mi? Evet! "Çok iyi."',
    ]);
  });

  it("Türkçe büyük harfle başlayan cümle sınırdır; küçük harfle devam eden nokta değildir", () => {
    expect(upTo("Bitti. İkinci cümle. Şu da. Son")).toEqual(["Bitti.", "Bitti. İkinci cümle.", "Bitti. İkinci cümle. Şu da."]);
    expect(upTo("Boy 3 cm. sonra devam etti. Son.")).toEqual(["Boy 3 cm. sonra devam etti."]);
  });

  it("metnin SON cümlesi (ardında boşluk yok) kesim adayı değildir", () => {
    expect(sentenceEnds("Tek cümle.")).toEqual([]);
  });
});

describe("cleanSummary: kaynak artıkları", () => {
  it("HTML etiketlerini ayıklar; 'p<0.05' / 'n<30' gibi karşılaştırmalara dokunmaz", () => {
    expect(cleanSummary("Etki var.<br />Medscape")).toBe("Etki var. Medscape");
    expect(cleanSummary("<p>Giriş <b>önemli</b></p> bulgular")).toBe("Giriş önemli bulgular");
    expect(cleanSummary("Fark anlamlı (p<0.05) ve n<30 idi.")).toBe("Fark anlamlı (p<0.05) ve n<30 idi.");
  });

  it("WordPress 'The post … first appeared on …' kuyruğunu atar", () => {
    expect(cleanSummary("SGK duyuru yayınladı. The post EKDS Duyurusu first appeared on Özel Hastaneler Derneği .")).toBe("SGK duyuru yayınladı.");
    expect(cleanSummary("Haber metni. The post Başlık appeared first on Site.")).toBe("Haber metni.");
  });

  it("SONDAKİ 'Devamını oku / Read more / […]' atılır; ORTADAKİ dokunulmaz", () => {
    expect(cleanSummary("Kısa haber metni burada […]")).toBe("Kısa haber metni burada");
    expect(cleanSummary("Kısa haber metni. Devamını oku")).toBe("Kısa haber metni.");
    expect(cleanSummary("Kısa haber metni. Read more »")).toBe("Kısa haber metni.");
    expect(cleanSummary("Daha fazla için Read more bölümüne bakın. Sonuç iyi.")).toBe("Daha fazla için Read more bölümüne bakın. Sonuç iyi.");
  });
});

describe("cleanSummary: görünmez karakterler (v6.318)", () => {
  // Kaynakta `\uXXXX` yazılmaz (araçlar kaçışı gerçek karaktere çevirebilir) → kod noktalarıyla kurulur.
  const ch = (cp: number) => String.fromCharCode(cp);

  it("sıfır genişlikli boşluk (U+200B), yumuşak tire, kelime birleştirici ve BOM silinir (canlı bulgu: KLİMİK haber metni)", () => {
    expect(cleanSummary(`tarihleri${ch(0x200b)}${ch(0x200b)} arasında`)).toBe("tarihleri arasında");
    expect(cleanSummary(`te${ch(0xad)}davi ${ch(0x2060)}planı${ch(0xfeff)}`)).toBe("tedavi planı");
  });

  it("görünmez karakterler uzunluğa ve cümle sınırına karışmaz", () => {
    const gizli = `${sentence(150)} ${sentence(150)} ${sentence(150)}`.split(" ").join(`${ch(0x200b)} `);
    const temiz = `${sentence(150)} ${sentence(150)} ${sentence(150)}`;
    expect(trimToSentences(cleanSummary(gizli))).toBe(trimToSentences(temiz));
  });

  it("ZWJ (U+200D, emoji dizileri) bilerek SİLİNMEZ", () => {
    expect(cleanSummary(`a${ch(0x200d)}b`)).toBe(`a${ch(0x200d)}b`);
  });
});

describe("looksLikeRawGazetteText: Resmî Gazete ham belge metni (v6.318)", () => {
  it("künyeyle başlayan metin → true (canlı 03.10 örneği, tarihsiz künye, 'Resmi' yazımı)", () => {
    expect(
      looksLikeRawGazetteText("3 Ekim 2026 CUMARTESİ Resmî Gazete Sayı : 33389 YÖNETMELİK Sosyal Güvenlik Kurumu Başkanlığından: SOSYAL GÜVENLİK KURUMU İLAÇ GERİ ÖDEME YÖNETMELİĞİNDE DEĞİŞİKLİK YAPILMASINA DAİR YÖNETMELİK MADDE 1-"),
    ).toBe(true);
    expect(looksLikeRawGazetteText("Resmî Gazete Sayı : 33389 (Mükerrer) KARAR")).toBe(true);
    expect(looksLikeRawGazetteText("12 Ocak 2027 PAZARTESİ Resmi Gazete Sayı: 33500 TEBLİĞ")).toBe(true);
  });

  it("Resmî Gazete'den yalnız söz eden özet → false (yalnız metnin BAŞI sayılır)", () => {
    expect(looksLikeRawGazetteText("Düzenleme 25/8/2022 tarihli Resmî Gazete'de yayımlanan yönetmeliğin 3 üncü maddesini değiştirdi.")).toBe(false);
    expect(looksLikeRawGazetteText("Yeni kılavuz yayımlandı ve Resmî Gazete Sayı : 1 olarak ilan edildi.")).toBe(false);
  });
});

describe("looksEnglish: dil kapısı", () => {
  it("çevrilmemiş İngilizce özet → true (gerçek dev örneklemi: DOAJ, Europe PMC, Medical Xpress, ClinicalTrials, openFDA)", () => {
    for (const t of [
      "Conventional therapies for endocrine hormone deficiencies, including hormone replacement therapy and solid organ transplantation, are hampered by the lack of physiological regulation or donor shortage, respectively.",
      "α-Synuclein (αSyn) is a major component of pathogenic Lewy bodies and Lewy neurites and is closely associated with Parkinson's disease.",
      "Pancreatic cancer remains one of the most aggressive malignancies, with a particularly poor prognosis even when diagnosed at a localized stage.",
      "TIVDAK is used for the treatment of cervical cancer that has come back after chemotherapy.",
      "Presence of Particulate Matter; identified as a nylon/polyamide and silk/proteinaceous-type material · Firma: Apollo Care, LLC",
    ]) {
      expect(looksEnglish(t)).toBe(true);
    }
  });

  it("Türkçe özet → false (ilaç adı, kısaltma, 'in vitro', apostrof eki yanıltmaz)", () => {
    for (const t of [
      "Bu çalışma kalp yetmezliği olan katılımcılarda ziltivekimabın plaseboya kıyasla nasıl çalıştığını araştırıyor. Sonuçlar, IL-6 düzeylerinde anlamlı bir düşüş gösterdi.",
      "Sosyal Güvenlik Kurumu tarafından 07.08.2026 tarihinde EKDS pilot uygulamasının sonlandırılmasına ilişkin duyuru yayınlanmıştır.",
      "Parkinson'ın ve Alzheimer'in patogenezinde in vitro ve in vivo çalışmalar, A grubu ile B grubu arasında fark gösterdi.",
    ]) {
      expect(looksEnglish(t)).toBe(false);
    }
  });

  it("kısa metinde (6 sözcükten az) karar vermez", () => {
    expect(looksEnglish("The study of the")).toBe(false);
  });

  it("Türkçe harfli metin İngilizce işlev sözcükleri içerse bile (alıntı/karışık) İngilizce sayılmaz", () => {
    expect(looksEnglish("Çalışmada the and of with was were is are for that this which ç ğ ı ö ş ü Çok önemli")).toBe(false);
  });
});

describe("buildSummaryLong: kullanılabilir özet / dürüst yedek", () => {
  const pub = new Date("2026-10-02T06:00:00Z");

  it("kullanılabilir özet: yedek DEĞİL, ≤ max, özetin başından", () => {
    const summary = `${sentence(150)} ${sentence(150)} ${sentence(150)}`;
    const r = buildSummaryLong({ summary, sourceName: "Europe PMC", publishedAt: pub });
    expect(r.fallback).toBe(false);
    expect(r.text.length).toBeLessThanOrEqual(SUMMARY_LONG_MAX);
    expect(summary.startsWith(r.text)).toBe(true);
  });

  it("boş / boşluk / çok kısa özet → dürüst yedek (kaynak + TR günü + ayrıntı kaynakta)", () => {
    for (const summary of ["", "   \n\t ", "Anasayfa Hakkımızda"]) {
      const r = buildSummaryLong({ summary, sourceName: "T.C. Resmî Gazete", publishedAt: pub });
      expect(r).toEqual({
        text: "T.C. Resmî Gazete kaynağında 2 Ekim 2026 tarihinde yayımlandı; ayrıntı kaynak bağlantısında.",
        fallback: true,
      });
    }
  });

  it("çevrilmemiş İngilizce özet → dürüst yedek (Türkçe hikâyede İngilizce paragraf çıkmaz)", () => {
    const summary = "Pancreatic cancer remains one of the most aggressive malignancies, with a particularly poor prognosis even when diagnosed at a localized stage.";
    const r = buildSummaryLong({ summary, sourceName: "Medical Xpress", publishedAt: pub });
    expect(r).toEqual({ text: "Medical Xpress kaynağında 2 Ekim 2026 tarihinde yayımlandı; ayrıntı kaynak bağlantısında.", fallback: true });
  });

  it("kaynak artıkları ayıklandıktan sonra bakılır: Türkçe özet + WordPress kuyruğu → özet kalır, kuyruk gider", () => {
    const summary = "Sosyal Güvenlik Kurumu, pilot uygulamanın sonlandırıldığını duyurdu. The post EKDS Duyurusu first appeared on Özel Hastaneler Derneği .";
    const r = buildSummaryLong({ summary, sourceName: "ÖHSAD", publishedAt: pub });
    expect(r).toEqual({ text: "Sosyal Güvenlik Kurumu, pilot uygulamanın sonlandırıldığını duyurdu.", fallback: false });
  });

  it("yalnız artıktan ibaret özet (etiket + kuyruk) temizlenince boş kalır → yedek", () => {
    const r = buildSummaryLong({ summary: "<br /> The post Başlık first appeared on Site .", sourceName: "Site", publishedAt: pub });
    expect(r.fallback).toBe(true);
  });

  it("Resmî Gazete ham belge metni → dürüst yedek (özet DEĞİL; başlık zaten ekranda)", () => {
    const summary =
      "3 Ekim 2026 CUMARTESİ Resmî Gazete Sayı : 33389 YÖNETMELİK Sosyal Güvenlik Kurumu Başkanlığından: SOSYAL GÜVENLİK KURUMU İLAÇ GERİ ÖDEME YÖNETMELİĞİNDE DEĞİŞİKLİK YAPILMASINA DAİR YÖNETMELİK MADDE 1- 25/8/2022 tarihli ve 31934 mükerrer sayılı Resmî Gazete’de yayımlanan Yönetmeliğin 3 üncü maddesi değiştirilmiştir.";
    const r = buildSummaryLong({ summary, sourceName: "T.C. Resmî Gazete", publishedAt: new Date("2026-10-03T03:00:00Z") });
    expect(r).toEqual({ text: "T.C. Resmî Gazete kaynağında 3 Ekim 2026 tarihinde yayımlandı; ayrıntı kaynak bağlantısında.", fallback: true });
  });

  it("Resmî Gazete'den söz eden ama künyeyle BAŞLAMAYAN özet kullanılır", () => {
    const summary = "Düzenleme, Resmî Gazete'de yayımlanan yönetmeliğin 3 üncü maddesini değiştirerek geri ödeme koşullarını yeniden belirledi.";
    const r = buildSummaryLong({ summary, sourceName: "Dernek", publishedAt: pub });
    expect(r).toEqual({ text: summary, fallback: false });
  });

  it("eşik: SUMMARY_LONG_MIN karakter kullanılabilir, bir eksiği yedek", () => {
    const ok = "a".repeat(SUMMARY_LONG_MIN);
    expect(buildSummaryLong({ summary: ok, sourceName: "X", publishedAt: pub }).fallback).toBe(false);
    expect(buildSummaryLong({ summary: ok.slice(1), sourceName: "X", publishedAt: pub }).fallback).toBe(true);
  });

  it("yedek cümledeki gün TÜRKİYE gününe göredir (UTC gece yarısı sınırı)", () => {
    // 20:59Z = 23:59 TR (1 Ekim) · 21:00Z = 00:00 TR (2 Ekim)
    expect(summaryLongFallback("K", new Date("2026-10-01T20:59:00Z"))).toContain("1 Ekim 2026");
    expect(summaryLongFallback("K", new Date("2026-10-01T21:00:00Z"))).toContain("2 Ekim 2026");
  });

  it("kaynak adı boşsa ya da uzunsa (dergi adı, > 40 kr) yedek cümle yalnız günü söyler", () => {
    expect(summaryLongFallback("  ", pub)).toBe("2 Ekim 2026 tarihinde yayımlandı; ayrıntı kaynak bağlantısında.");
    expect(
      summaryLongFallback("Genetics in medicine : official journal of the American College of Medical Genetics", pub),
    ).toBe("2 Ekim 2026 tarihinde yayımlandı; ayrıntı kaynak bağlantısında.");
    // sınır: 40 karakter dahil, 41 hariç
    expect(summaryLongFallback("K".repeat(40), pub)).toContain("kaynağında");
    expect(summaryLongFallback("K".repeat(41), pub)).not.toContain("kaynağında");
  });

  it("yedek cümle iddia taşımaz (ücret / akredite / uçtan uca / yasak terim / garanti yok)", () => {
    expect(summaryLongFallback("Europe PMC", pub)).not.toMatch(/ücret|akredit|uçtan uca|hekim|garanti/i);
  });
});

describe("pickSocialDigest: summaryLong hikâye açıklaması", () => {
  const NOW = new Date("2026-10-02T04:45:00Z");
  const rot = BRANCHES.find((b) => b.key === "kardiyoloji")!;
  const art = (over: Partial<SocialArticle>): SocialArticle => ({
    id: "a1", source: "pubmed", module: "akademik", kind: "makale", title: "Başlık", sourceName: "JAMA",
    summary: "Özet metni.", url: "https://doi.org/x", branchSlugs: "[]",
    publishedAt: new Date("2026-10-02T03:00:00Z"), createdAt: new Date(NOW.getTime() - 2 * 3_600_000), ...over,
  });

  it("uzun özet: summary 160'a iner, summaryLong cümle sınırından ≤400'e; teaser davranışı değişmedi", () => {
    const [it] = pickSocialDigest([art({ summary: `${sentence(180)} ${sentence(180)} ${sentence(180)}` })], rot, NOW);
    expect(it.summary.length).toBeLessThanOrEqual(161); // 160 + "…"
    expect(it.summary.endsWith("…")).toBe(true);
    expect(it.summaryLong).toBe(`${sentence(180)} ${sentence(180)}`);
    expect(it.summaryLongFallback).toBe(false);
  });

  it("kısa ama kullanılabilir özet: summary ile summaryLong aynı (kırpma yok)", () => {
    const summary = "Bu çalışma kalp yetmezliğinde yeni bir tedavi yaklaşımını inceledi.";
    const [it] = pickSocialDigest([art({ summary })], rot, NOW);
    expect(it.summary).toBe(summary);
    expect(it.summaryLong).toBe(summary);
    expect(it.summaryLongFallback).toBe(false);
  });

  it("İngilizce kalmış özet → yedek + bayrak; teaser summary (160) davranışı değişmedi (dil kapısına tabi DEĞİL)", () => {
    const en = "Pancreatic cancer remains one of the most aggressive malignancies, with a particularly poor prognosis even when diagnosed at a localized stage.";
    const [it] = pickSocialDigest([art({ summary: en, sourceName: "Medical Xpress" })], rot, NOW);
    expect(it.summaryLongFallback).toBe(true);
    expect(it.summaryLong).toBe("Medical Xpress kaynağında 2 Ekim 2026 tarihinde yayımlandı; ayrıntı kaynak bağlantısında.");
    expect(it.summary).toBe(en);
  });

  it("HTML etiketi ve WordPress kuyruğu summaryLong'a sızmaz", () => {
    const [it] = pickSocialDigest(
      [art({ summary: "Duyuru yayımlandı ve uygulama sonlandırıldı.<br /> The post Duyuru first appeared on Dernek ." })],
      rot,
      NOW,
    );
    expect(it.summaryLong).toBe("Duyuru yayımlandı ve uygulama sonlandırıldı.");
    expect(it.summaryLongFallback).toBe(false);
  });

  it("Resmî Gazete ham belge metni (üretim 03.10) → yedek cümle + bayrak; teaser summary ayrıca etkilenmez", () => {
    const raw = "3 Ekim 2026 CUMARTESİ Resmî Gazete Sayı : 33389 YÖNETMELİK Sosyal Güvenlik Kurumu Başkanlığından: SOSYAL GÜVENLİK KURUMU İLAÇ GERİ ÖDEME YÖNETMELİĞİNDE DEĞİŞİKLİK YAPILMASINA DAİR YÖNETMELİK";
    const [it] = pickSocialDigest(
      [art({ module: "mevzuat", kind: "mevzuat", source: "resmi-gazete", sourceName: "T.C. Resmî Gazete", summary: raw, publishedAt: new Date("2026-10-03T03:00:00Z") })],
      rot,
      NOW,
    );
    expect(it.summaryLongFallback).toBe(true);
    expect(it.summaryLong).toBe("T.C. Resmî Gazete kaynağında 3 Ekim 2026 tarihinde yayımlandı; ayrıntı kaynak bağlantısında.");
    expect(it.summary.startsWith("3 Ekim 2026 CUMARTESİ")).toBe(true); // teaser (160) kuralına dokunulmadı
  });

  it("özet boş (Resmî Gazete benzeri) → dürüst yedek + bayrak; teaser summary boş kalır", () => {
    const [it] = pickSocialDigest(
      [art({ module: "mevzuat", kind: "mevzuat", source: "resmi-gazete", sourceName: "T.C. Resmî Gazete", summary: "" })],
      rot,
      NOW,
    );
    expect(it.summaryLongFallback).toBe(true);
    expect(it.summaryLong).toBe("T.C. Resmî Gazete kaynağında 2 Ekim 2026 tarihinde yayımlandı; ayrıntı kaynak bağlantısında.");
    expect(it.summary).toBe("");
  });

  it("HTML varlıkları kırpmadan ÖNCE çözülür (yarım varlık kuyruğu yok)", () => {
    const summary = `${"a".repeat(390)}&#x2009;${"b".repeat(60)}`;
    const [it] = pickSocialDigest([art({ summary })], rot, NOW);
    expect(it.summaryLong).not.toContain("&#x");
    expect(it.summaryLong.length).toBeLessThanOrEqual(SUMMARY_LONG_MAX);
  });

  it("kaynak adındaki varlık yedek cümlede çözülür", () => {
    const [it] = pickSocialDigest([art({ summary: "", sourceName: "Ar&amp;Ge Derneği" })], rot, NOW);
    expect(it.summaryLong).toContain("Ar&Ge Derneği");
  });

  it("her öğe iki alanı da taşır (birincil, donör ve stale dahil)", () => {
    const items = pickSocialDigest(
      [
        art({ id: "1" }),
        art({ id: "2", module: "ilac", kind: "ilac" }),
        art({ id: "3", module: "sektorel", kind: "haber", source: "medscape" }),
        // eski başlıklı akış (taze değil) → donör ya da stale yolu
        art({ id: "4", module: "mevzuat", kind: "mevzuat", source: "resmi-gazete", createdAt: new Date(NOW.getTime() - 30 * 3_600_000) }),
      ],
      rot,
      NOW,
    );
    expect(items.length).toBeGreaterThanOrEqual(3);
    for (const i of items) {
      expect(typeof i.summaryLong).toBe("string");
      expect(i.summaryLong.length).toBeGreaterThan(0);
      expect(i.summaryLong.length).toBeLessThanOrEqual(SUMMARY_LONG_MAX);
      expect(typeof i.summaryLongFallback).toBe("boolean");
    }
  });
});
