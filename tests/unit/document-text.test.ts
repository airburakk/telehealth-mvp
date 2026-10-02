// Sayfa → özet zemini metni sözleşmesi (2026-10-02, Günlük Seçki özetlerinin ölçümü).
//
// Kilitlenen kusur: KLİMİK kaleminin seçki özeti haber değil site gezinme menüsüydü ("IDCM Dergisinin … Yayında! | Klimik
// Dernek Kurullar Dernek Tüzüğü Etik Kurul Yönergesi …"). Köken RSS ingest DEĞİL: RSS özeti kısa kalınca gece cron'u kaynak
// SAYFAYI çekip TÜM HTML'i düz metne çeviriyor (eski fetchDocumentText) ve sonucu summary'ye yazıyordu.
// Fixture'lar canlı sayfa yapılarından türetildi (KLİMİK `entry-content`, İTO iç içe <article>, OHSAD `td-post-content`,
// TTB `post-content`, RG Word belgesi); eski algoritma aynı girdilerde menü ürettiği için testte kopyası tutulur —
// fixture'ın kusuru gerçekten yeniden ürettiğini kanıtlar (yoksa test boş kalırdı).
import { describe, it, expect } from "vitest";
import { decodeHtmlEntities, extractDocumentText, DOCUMENT_TEXT_MIN, DOCUMENT_TEXT_MAX } from "@/lib/document-text";

/** ESKİ fetchDocumentText gövdesi (2026-10-02 öncesi): tüm sayfayı düz metne çevirir. */
function legacyDocumentText(html: string): string | null {
  const plain = (h: string) =>
    h.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
  const body = html.replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ");
  const text = plain(body).replace(/\b(Print|Clean|false|true|MicrosoftInternetExplorer\d*|X-NONE|TR)\b/g, " ").replace(/\s+/g, " ").trim();
  return text.length >= 120 ? text.slice(0, 8000) : null;
}

const page = (body: string, head = "<title>Sayfa başlığı | Site</title>") =>
  `<!doctype html><html lang="tr"><head><meta charset="utf-8">${head}</head><body>${body}</body></html>`;

// Her paragraf ≥ 25 karakter, ikisi birlikte ≥ 120 (özet zemini eşiği).
const P1 = "İstanbul Tabip Odası’nın eski başkanlarından, nöroloji alanının öncü bilim insanı Prof. Dr. Coşkun Özdemir’i son yolculuğuna uğurladık.";
const P2 = "Özdemir için ilk tören 1952 yılında mezun olduğu fakültede düzenlendi; ardından aile ve meslektaşlarıyla birlikte cenaze namazı kılındı.";

describe("KLİMİK — raporlanan kusur (seçkide gezinme menüsü özet oluyordu)", () => {
  const MENU =
    '<a href="#" id="menu" class="show-sm dashicons dashicons-menu"></a><div class="menu-wrapper"><div class="menu-main-menu-container">' +
    '<ul id="menu-main-menu" class="menu"><li class="menu-item"><a href="/dernek/">Dernek</a><ul class="sub-menu">' +
    '<li><a href="#">Kurullar</a></li><li><a href="#">Dernek Tüzüğü</a></li><li><a href="#">Etik Kurul Yönergesi</a></li>' +
    '<li><a href="#">Dernek Adresi</a></li><li><a href="#">Üyelik Başvurusu</a></li></ul></li></ul></div></div>';
  const klimik = (entry: string) =>
    page(
      `<header></header>${MENU}<article id="post-209664"><h1 class="entry-title">IDCM Dergisinin Eylül 2026 Sayısı Yayında!</h1>` +
        `<div class="entry-content">${entry}</div></article><div class="footer-links"><ul><li>Klimik Video Kütüphanesi</li>` +
        "<li>KLİMİK AŞI PORTALI</li></ul><p>2026 © Bu sitenin tüm hakları KLİMİK Derneğine aittir. Tasarım ve Uygulama</p></div>",
      "<title>IDCM Dergisinin Eylül 2026 Sayısı Yayında! | Klimik</title>",
    );

  it("eski algoritma bu yapıda başlık + menüyü özet yapıyordu (fixture kusuru yeniden üretir)", () => {
    const legacy = legacyDocumentText(klimik("<p>Yeni Sayı İçin Tıklayınız</p>"));
    expect(legacy?.startsWith("IDCM Dergisinin Eylül 2026 Sayısı Yayında! | Klimik Dernek Kurullar Dernek Tüzüğü Etik Kurul Yönergesi Dernek Adresi Üyelik Başvurusu")).toBe(true);
  });

  it("gerçek gövde kısaysa ('Yeni Sayı İçin Tıklayınız') sonuç NULL — menü/başlık/alt bilgi özet OLMAZ", () => {
    expect(extractDocumentText(klimik("<p>Yeni Sayı İçin Tıklayınız</p>"))).toBeNull();
    // resimden ibaret gövde (TGCD "Kınama" gönderisi) de aynı: metin yok → null
    expect(extractDocumentText(klimik('<p><img src="a.jpeg" width="1080" /></p>'))).toBeNull();
  });

  it("gövde uzunsa YALNIZ gövde: tarih satırı atılır, lead cümle (<h3>) korunur, menü/başlık/alt bilgi yok", () => {
    const entry =
      '<p><img src="x.jpg" /><br /> 2 Ekim 2026</p>' +
      "<h3>Çin, 18-24 Eylül 2026 tarihleri arasında iki yeni insan kaynaklı A(H9N2) kuş gribi infeksiyonu vakası bildirdi.</h3>" +
      "<p>Her iki vaka da bir yaşında kız çocuklarından oluşuyordu; bunlardan biri Henan Eyaleti&#8217;ndendi.</p>";
    const out = extractDocumentText(klimik(entry));
    expect(out).toBe(
      "Çin, 18-24 Eylül 2026 tarihleri arasında iki yeni insan kaynaklı A(H9N2) kuş gribi infeksiyonu vakası bildirdi. " +
        "Her iki vaka da bir yaşında kız çocuklarından oluşuyordu; bunlardan biri Henan Eyaleti’ndendi.",
    );
    expect(out).not.toMatch(/Kurullar|Klimik|Üyelik|©|2 Ekim 2026|IDCM/);
  });
});

describe("başlık tekrarı ve gürültü (İTO · OHSAD · TTB yapıları)", () => {
  it("İTO: iç içe <article> — <header> (başlık/tarih/sayaç), 'BENZER HABERLER' ve ilgili-haber kartları özete girmez; <main> sayfa kabuğudur", () => {
    const html = page(
      "<nav><ul><li>ANASAYFA</li><li>KURUMSAL</li><li>Kurullar</li></ul></nav><main><div class=\"container\"><section>" +
        '<article class="g-mb-60"><header class="g-mb-10"><h2 class="h1">Prof. Dr. Coşkun Özdemir’e Veda</h2>' +
        '<ul class="list-inline"><li>Ağustos 14, 2026</li><li>1607</li></ul></header>' +
        `<div class="sitetxt"><p>${P1.replace("nöroloji", "n&ouml;roloji")}</p><p>${P2}</p></div>` +
        '<h2 class="h5">BENZER HABERLER</h2>' +
        "<article><h3>Dr. Fikret Hacıosman’ı Görevi Başında Katledilmesinin 8. Yılında Sevgiyle ve Özlemle Anıyoruz</h3></article>" +
        "<article><h3>İklim Krizi Kıskacında Hekimlik-2: İklim Krizi, Yoksulluk, Sağlık Webinarı Yapıldı</h3></article>" +
        "</article></section></div></main><footer>İstanbul Tabip Odası'nın tüm içeriği kaynak göstermek koşuluyla kullanılabilir.</footer>",
      "<title>Prof. Dr. Coşkun Özdemir’e Veda - İstanbul Tabip Odası</title>",
    );
    expect(legacyDocumentText(html)).toContain("ANASAYFA KURUMSAL"); // eski: menü gövdeyi sarıyordu
    expect(extractDocumentText(html)).toBe(`${P1} ${P2}`); // &ouml; çözüldü, kabuk/başlık/kart yok
  });

  it("OHSAD: 'Yazdır' düğmesi ve yazar/tarih satırı <p> dışındadır → özete girmez", () => {
    const html = page(
      "<header><div>Genel Manşet Haberler Sektörden Haberler</div></header>" +
        '<article class="post"><div class="td-post-header"><h1 class="entry-title">TOBB Sağlık Hizmetleri Meclisi Başkanlık Divanı Seçildi</h1>' +
        "<div>Yazar Volkan - 27 Nisan 2026 0 3430</div></div>" +
        `<div class="td-post-content tagdiv-type"><div class="pdfprnt-buttons"><span class="pdfprnt-button-title">Yazdır</span></div><p>${P1}</p><p>${P2}</p></div></article>` +
        "<footer>OHSAD © 2015 Tüm Hakları Saklıdır.</footer>",
    );
    expect(extractDocumentText(html)).toBe(`${P1} ${P2}`);
  });

  it("TTB: başlık <h2> (div.post-title), tarih ve görüntülenme sayacı gövdeden ayrıdır → başlık tekrarı yok", () => {
    const html = page(
      '<div class="content"><div class="row"><div class="post-content post-content-single col-md-9"><div class="post-item">' +
        '<div class="post-content-details"><div class="post-title"><h2>5 Nisan Asistan Hekimler Günü Bildirisi</h2></div>' +
        '<div class="post-meta"><span class="post-date">05.04.2026</span><span>3,969</span></div></div>' +
        `<div class="post-description"><p>${P1}</p><p>${P2}</p></div></div></div></div></div><footer>TTB - TÜRK TABİPLERİ BİRLİĞİ</footer>`,
    );
    expect(extractDocumentText(html)).toBe(`${P1} ${P2}`);
  });

  it("alt başlık YALNIZ cümle gibi bitiyorsa (nokta) alınır; noktasız başlık ve kısa başlık atılır", () => {
    const html = page(
      '<div class="entry-content"><h2>Etkinlik Duyurusu ve Başvuru Koşulları Hakkında</h2>' +
        "<h3>Başvurular 15 Ekim 2026 tarihinde sona erecek ve sonuçlar internet sitemizde ilan edilecektir.</h3>" +
        "<h4>Kısa not.</h4>" +
        "<p>Başvuru formunu eksiksiz doldurarak dernek sekreterliğine iletmeniz rica olunur, eksik evrak kabul edilmez.</p></div>",
    );
    const out = extractDocumentText(html);
    expect(out).toBe(
      "Başvurular 15 Ekim 2026 tarihinde sona erecek ve sonuçlar internet sitemizde ilan edilecektir. " +
        "Başvuru formunu eksiksiz doldurarak dernek sekreterliğine iletmeniz rica olunur, eksik evrak kabul edilmez.",
    );
  });

  it("satır içi etiketler boşluksuz sökülür: 'Meclisi<a>’nin' → 'Meclisi’nin' (eski çıkarım 'Meclisi ’nin' yazıyordu)", () => {
    const html = page(
      '<div class="entry-content"><p>Türkiye Sağlık Hizmetleri <a href="#">Meclisi</a>’nin yeni dönem başkanlık divanı seçildi ve çalışma ' +
        "programı açıklandı. Toplantıya çok sayıda üye katılarak oy kullandı.</p></div>",
    );
    const out = extractDocumentText(html);
    expect(out).toContain("Meclisi’nin");
    expect(out).not.toContain("Meclisi ’nin");
  });
});

describe("kapsayıcı seçimi", () => {
  const long = (tag: string) => `<p>${tag} ${P1}</p>`;

  it("öncelik: itemprop=articleBody › bilinen sınıf belirteci › <article> › <main> › role=main", () => {
    const itemprop = page(`<article><div class="entry-content">${long("SINIF")}</div><div itemprop="articleBody">${long("ITEM")}</div></article>`);
    expect(extractDocumentText(itemprop)?.startsWith("ITEM")).toBe(true);
    const sinif = page(`<article><h1>Başlık</h1>${long("ARTICLE")}<div class="entry-content">${long("SINIF")}</div></article>`);
    expect(extractDocumentText(sinif)?.startsWith("SINIF")).toBe(true);
    const article = page(`<main>${long("MAIN")}<article>${long("ARTICLE")}</article></main>`);
    expect(extractDocumentText(article)?.startsWith("ARTICLE")).toBe(true);
    const main = page(`<div role="main">${long("ROLE")}</div><main>${long("MAIN")}</main>`);
    expect(extractDocumentText(main)?.startsWith("MAIN")).toBe(true);
    const role = page(`<div class="x">${long("DIS")}</div><div role="main">${long("ROLE")}</div>`);
    expect(extractDocumentText(role)?.startsWith("ROLE")).toBe(true);
  });

  it("aynı grupta EN UZUN aday seçilir (ilgili-haber kartı değil, asıl yazı)", () => {
    const html = page(`<article><h3>Kısa kart başlığı burada yer alır</h3></article><article>${long("ASIL")}<p>${P2}</p></article>`);
    expect(extractDocumentText(html)?.startsWith("ASIL")).toBe(true);
  });

  it("sınıf belirteci TAM eşleşir: 'post-content-single' tek başına kapsayıcı DEĞİLDİR", () => {
    // belirteç eşleşmezse <article>'a düşer; asıl yazı <article>'dadır, 'post-content-single' kutusu yan öğedir
    const html = page(`<div class="post-content-single">${long("YAN")}</div><article>${long("ASIL")}</article>`);
    expect(extractDocumentText(html)?.startsWith("ASIL")).toBe(true);
  });

  it("kapsayıcı içindeki sayfa kabuğu öğeleri (nav/header/footer/aside) sökülür — <p> olmayan gövdede de", () => {
    const html = page(
      '<div class="entry-content"><nav>Üst menü bağlantıları</nav>' +
        `Bu bir düz metin gövdesidir ve paragraf etiketi taşımaz; ${P1}<aside>Yan sütun reklamı</aside><footer>Etiketler: haber</footer></div>`,
    );
    const out = extractDocumentText(html);
    expect(out?.startsWith("Bu bir düz metin gövdesidir")).toBe(true);
    expect(out).not.toMatch(/Üst menü|Yan sütun|Etiketler/);
  });

  it("dengesiz (kapanmamış) kapsayıcı çökertmez: sonraki adaya ya da eski yola düşer", () => {
    const html = page(`<div class="entry-content"><p>${P1}</p><p>${P2}</p>`); // </div> yok
    const out = extractDocumentText(html);
    expect(out).toContain(P1);
    const withArticle = page(`<div class="entry-content"><p>YARIM ${P1}</p><article>${long("ARTICLE")}</article>`);
    expect(extractDocumentText(withArticle)?.startsWith("ARTICLE")).toBe(true);
  });
});

describe("kapsayıcısız sayfa (Resmî Gazete Word belgesi) — eski davranış korunur", () => {
  const RG = page(
    '<div class="WordSection1"><p class="MsoNormal"><span>30 Aralık 2025 SALI</span> <span>Resm</span><span>î Gazete</span> <span>Say&#305; : 33123</span></p>' +
      "<p><span>YÖNETMELİK</span></p>" +
      "<p>Türkiye İlaç ve Tıbbî Cihaz Kurumundan: BEŞERİ TIBBİ ÜRÜNLER RUHSATLANDIRMA YÖNETMELİĞİNDE DEĞİŞİKLİK YAPILMASINA DAİR YÖNETMELİK MADDE 1- Bu Yönetmelik hükümlerini Kurum Başkanı yürütür.</p>" +
      "<p>Print Clean false true X-NONE MicrosoftInternetExplorer4</p></div>",
    "<title>30 Aralık 2025 SALI</title><style>p.MsoNormal{margin:0}</style><!--[if gte mso 9]><xml><w:View>Print</w:View></xml><![endif]-->",
  );

  it("tüm gövde alınır; <head> başlığı tekrar etmez, Word span'ları birleşir, Word artıkları atılır, varlıklar çözülür", () => {
    const out = extractDocumentText(RG);
    expect(out?.startsWith("30 Aralık 2025 SALI Resmî Gazete Sayı : 33123 YÖNETMELİK Türkiye İlaç")).toBe(true);
    expect(out?.match(/30 Aralık 2025 SALI/g)).toHaveLength(1); // eski çıkarım <title> yüzünden iki kez yazıyordu
    expect(legacyDocumentText(RG)?.match(/30 Aralık 2025 SALI/g)).toHaveLength(2);
    expect(out).not.toMatch(/\b(Print|Clean|X-NONE|MicrosoftInternetExplorer4)\b/);
    expect(out).not.toMatch(/MsoNormal|margin/);
  });

  it("ASP.NET sayfaları tüm gövdeyi <form> ile sarar — <form> kabuk sayılmaz, metin kaybolmaz", () => {
    const out = extractDocumentText(page(`<form id="aspnetForm"><div id="content"><p>${P1}</p><p>${P2}</p></div></form>`));
    expect(out).toBe(`${P1} ${P2}`);
  });

  it("<header>/<nav>/<footer> kabuk etiketleri kapsayıcısız yolda da sökülür", () => {
    const out = extractDocumentText(page(`<header>Site üst bilgisi</header><nav>Menü Menü Menü</nav><div><p>${P1}</p><p>${P2}</p></div><footer>Alt bilgi telif</footer>`));
    expect(out).toBe(`${P1} ${P2}`);
  });
});

describe("sınırlar ve sızıntılar", () => {
  it("script/style/yorum içeriği gövdeye sızmaz", () => {
    const html = page(
      '<script>var x="<div>junk</div>";</script><style>.a{}</style><!-- gizli yorum -->' +
        `<noscript>JS kapalı uyarısı</noscript><div class="entry-content"><p>${P1}</p><p>${P2}</p></div>`,
    );
    const out = extractDocumentText(html);
    expect(out).toBe(`${P1} ${P2}`);
  });

  it("görünmez karakterler atılır: sıfır genişlikli boşluk (KLİMİK beslemesinde görüldü), BOM, yumuşak tire ve bunların varlık biçimleri", () => {
    const html = page(
      '<div class="entry-content"><p>Çin, 18-24 Eylül 2026 tarihleri \u200B\u200B arasında&shy; iki yeni vaka bildirdi&#8203;. ' +
        "Her iki vaka da bir yaşında kız çocuklarından oluşuyordu ve ikisi de hastaneye yatırıldı.\uFEFF</p></div>",
    );
    expect(extractDocumentText(html)).toBe(
      "Çin, 18-24 Eylül 2026 tarihleri arasında iki yeni vaka bildirdi. Her iki vaka da bir yaşında kız çocuklarından oluşuyordu ve ikisi de hastaneye yatırıldı.",
    );
  });

  it("alt sınır: 119 karakter null, 120 karakter geçer (eski fetchDocumentText eşiği korunur)", () => {
    expect(DOCUMENT_TEXT_MIN).toBe(120);
    const mk = (n: number) => page(`<div class="entry-content"><p>${"a".repeat(n)}</p></div>`);
    expect(extractDocumentText(mk(119))).toBeNull();
    expect(extractDocumentText(mk(120))).toHaveLength(120);
  });

  it("üst sınır: 8000 karakterde kesilir", () => {
    expect(DOCUMENT_TEXT_MAX).toBe(8000);
    const html = page(`<div class="entry-content"><p>${"kelime ".repeat(3000)}</p></div>`);
    expect(extractDocumentText(html)).toHaveLength(8000);
  });

  it("boş / etiketsiz kısa girdi null döner", () => {
    expect(extractDocumentText("")).toBeNull();
    expect(extractDocumentText("<html></html>")).toBeNull();
    expect(extractDocumentText("Çok kısa düz metin.")).toBeNull();
  });
});

describe("decodeHtmlEntities: tek geçişli, adlandırılmış + sayısal", () => {
  it("Türkçe karakterlerin adlandırılmış ve sayısal biçimleri çözülür (canlı İTO sayfası 'n&ouml;roloji' taşıyordu)", () => {
    expect(decodeHtmlEntities("n&ouml;roloji &Uuml;niversitesi &ccedil;al&#305;&#x15F;ma &rsquo;")).toBe("nöroloji Üniversitesi çalışma ’");
    expect(decodeHtmlEntities("&gbreve;&Gbreve;&scedil;&Scedil;&Idot;&imath;")).toBe("ğĞşŞİı");
    expect(decodeHtmlEntities("&ldquo;a&rdquo; &ndash; &mdash; &hellip; &bull; &euro; &trade;")).toBe("“a” – — … • € ™");
  });

  it("TEK GEÇİŞ: çözülmüş çıktı yeniden çözülmez (&amp;lt; → &lt;, &amp;ouml; → &ouml;)", () => {
    expect(decodeHtmlEntities("&amp;lt;script&amp;gt;")).toBe("&lt;script&gt;");
    expect(decodeHtmlEntities("&amp;ouml; &amp;#x2009;")).toBe("&ouml; &#x2009;");
  });

  it("Latin-1 tablosu hizalı: sınır ve ara değerler doğru kod noktasına gider", () => {
    expect(decodeHtmlEntities("&nbsp;")).toBe(" "); // normal boşluk (NBSP DEĞİL)
    expect(decodeHtmlEntities("&iexcl;&cent;&sect;&copy;&reg;&deg;&micro;&iquest;")).toBe("¡¢§©®°µ¿");
    expect(decodeHtmlEntities("&Agrave;&AElig;&Ccedil;&ETH;&times;&Oslash;&THORN;&szlig;")).toBe("ÀÆÇÐ×ØÞß");
    expect(decodeHtmlEntities("&agrave;&aelig;&ccedil;&eth;&divide;&oslash;&thorn;&yuml;")).toBe("àæçð÷øþÿ");
  });

  it("bilinmeyen/geçersiz varlık olduğu gibi kalır; prototip adları (constructor) patlatmaz", () => {
    expect(decodeHtmlEntities("&foo; &#0; &#xD800; &#1114112; AT&T R&D &constructor; &__proto__;")).toBe("&foo; &#0; &#xD800; &#1114112; AT&T R&D &constructor; &__proto__;");
  });
});
