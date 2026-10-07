// Kamuya açık gazete seçkisi — saf mantık sözleşmeleri (2026-08-30, belge §2.2).
//
// Kilitlenenler:
//   1) Rotasyon deterministik: aynı gün aynı branş; ardışık günler dizide ilerler (mod 35).
//   2) Teaser kuralı: akış başına EN FAZLA 1 birincil başlık; fazlası yalnız açık yuvaya donör olarak girer.
//      Boş kart üretilmez: gösterilecek gerçek başlığı olmayan yuva düşer.
//   3) Branş tetikleyicisi: akademikte rotasyon branşı öncelikli, yoksa genel akademik fallback
//      (branch alanı yalnız gerçek branş eşleşmesinde dolar — yanlış branş etiketi basılmaz).
//   4) 🔁 Tekrar yerine donör (2026-09-21, kullanıcı kuralı eki): o gün taze başlığı olmayan akış
//      dünkü başlığı tekrarlamaz; yuva en çok taze başlık gelen akıştan kullanılmamış taze
//      başlıkla dolar (sıra korunur, `replaces` dolar); donör yoksa eski başlık `stale` ile kalır.
//   5) 🧩 Her zaman altı yuva (v6.336, 2026-10-07, 👤 karar): 48 saatte HİÇ içeriği olmayan akışın yuvası
//      da donörle dolar (5–7 Ekim kartı hukuk akışları boş diye 3 başlığa inmişti); donör tükenince düşer.
import { describe, it, expect } from "vitest";
import { rotationBranchFor, pickSocialDigest, SOCIAL_FRESH_MS, type SocialArticle } from "@/lib/social-digest";
import { BRANCHES } from "@/lib/triage";

/** Koşu anı: 07:45 TR (04:45 UTC) — sabah bülteni saati. */
const NOW = new Date("2026-09-21T04:45:00Z");
const H = 3_600_000;
/** `h` saat önce akışa düşmüş (createdAt). 24 saatten yeni = taze. */
const ago = (h: number) => new Date(NOW.getTime() - h * H);

const art = (over: Partial<SocialArticle>): SocialArticle => ({
  id: "a1", source: "pubmed", module: "akademik", kind: "makale", title: "Başlık", sourceName: "JAMA",
  summary: "Özet metni.", url: "https://doi.org/x", branchSlugs: "[]",
  publishedAt: new Date("2026-08-30T06:00:00Z"), createdAt: ago(2), ...over,
});

/** Akışların NewsArticle eşlemesi (lib/social-digest STREAMS ile aynı). */
const AKIS = {
  akademik: { module: "akademik", kind: "makale" },
  ilac: { module: "ilac", kind: "ilac" },
  sektorel: { module: "sektorel", kind: "haber" },
  mevzuat: { module: "mevzuat", kind: "mevzuat" },
  ictihat: { module: "mevzuat", kind: "ictihat" },
  doktrin: { module: "mevzuat", kind: "doktrin" },
} as const;

/** Verilen akışlar DIŞINDAKİ her akışa birer taze birincil başlık (`dolgu-<akış>`). Altı yuva kuralında
 *  (v6.336) her boş yuva donör çeker; testi incelenen yuvaya odaklamak için diğer yuvalar böyle doldurulur. */
const dolgu = (...haric: (keyof typeof AKIS)[]) =>
  (Object.keys(AKIS) as (keyof typeof AKIS)[])
    .filter((k) => !haric.includes(k))
    .map((k) => art({ id: `dolgu-${k}`, ...AKIS[k] }));

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

  it("akış başına 1 birincil başlık; normal günde altı yuva, donör/stale izi yok", () => {
    const items = pickSocialDigest([
      art({ id: "x1" }),
      art({ id: "x2" }), // ikinci akademik — açık yuva yok, seçkiye giremez
      ...dolgu("akademik"),
    ], rot, NOW);
    expect(items.map((i) => i.stream)).toEqual(["akademik", "ilac", "sektorel", "mevzuat", "ictihat", "doktrin"]);
    // Normal günde donör/stale izi yok — kart tarafı için sözleşme.
    expect(items.every((i) => i.replaces === null && i.stale === false)).toBe(true);
    expect(items[0].id).toBe("x1");
    expect(items.map((i) => i.id)).not.toContain("x2");
  });

  it("fazla başlık yalnız AÇIK yuvaya donör olarak girer; gerçek başlığı olmayan yuva düşer", () => {
    const items = pickSocialDigest([
      art({ id: "x1" }),
      art({ id: "x2" }),
      art({ id: "x3", module: "ilac", kind: "ilac" }),
    ], rot, NOW);
    // sektörel ← x2 (akademik donör); mevzuat/içtihat/doktrin: donör tükendi → düşer (sahte öğe yok)
    expect(items.map((i) => i.id)).toEqual(["x1", "x3", "x2"]);
    expect(items[2].replaces?.stream).toBe("sektorel");
  });

  it("akademikte rotasyon branşı önceliklidir ve branch alanı dolar", () => {
    const items = pickSocialDigest([
      art({ id: "genel" }), // daha taze ama branşsız
      art({ id: "kardio", branchSlugs: '["kardiyoloji","ic-hastaliklari"]', title: "Kalp çalışması" }),
    ], rot, NOW);
    expect(items[0].title).toBe("Kalp çalışması");
    expect(items[0].branch).toEqual({ key: "kardiyoloji", label: rot.label });
  });

  it("rotasyon branşında içerik yoksa genel akademiğe düşer, branch null kalır", () => {
    const items = pickSocialDigest([art({ id: "genel", branchSlugs: '["onkoloji"]' })], rot, NOW);
    expect(items[0].stream).toBe("akademik");
    expect(items[0].branch).toBeNull();
  });

  it("sektörelde yerli kaynak, daha taze yabancı haberden önce gelir; yerli yoksa yabancı kalır", () => {
    const yabanci = art({ id: "ms", module: "sektorel", kind: "haber", source: "medscape", title: "Çevrilmiş Medscape haberi" });
    const yerli = art({ id: "ttb", module: "sektorel", kind: "haber", source: "ttb", title: "TTB duyurusu" });
    // Sektörelin KENDİ yuvası (birincil) — boş akademik yuvası donör çekebilir, o öğe hariç tutulur.
    const sek = (xs: SocialArticle[]) => pickSocialDigest(xs, rot, NOW).find((i) => i.stream === "sektorel" && !i.replaces)!;
    // yalnız yabancı → akış boş düşmez, yabancı kalır
    expect(sek([yabanci]).title).toBe("Çevrilmiş Medscape haberi");
    // yabancı daha taze (dizide önce) olsa da yerli seçilir
    expect(sek([yabanci, yerli]).title).toBe("TTB duyurusu");
    // önceliğin akademik/ilaç akışlarına etkisi yok
    const ilac = pickSocialDigest([art({ id: "i", module: "ilac", kind: "ilac", source: "clinicaltrials", title: "Faz 3" })], rot, NOW);
    expect(ilac[0].title).toBe("Faz 3");
  });

  it("mevzuat ailesi kind ile üç akışa ayrılır", () => {
    const items = pickSocialDigest([
      art({ id: "m1", module: "mevzuat", kind: "mevzuat" }),
      art({ id: "m2", module: "mevzuat", kind: "ictihat" }),
      art({ id: "m3", module: "mevzuat", kind: "doktrin" }),
    ], rot, NOW);
    expect(items.map((i) => i.stream)).toEqual(["mevzuat", "ictihat", "doktrin"]);
  });

  // Bu uç NewsArticle satırını DOĞRUDAN okur (web akışının toFeedItem dönüşümü yok) → varlık
  // temizliği burada ayrıca yapılmalı, yoksa "&#x2009;" sosyal medya gönderisine ham gider.
  it("XML varlıkları çözülür — ham '&#x...' sosyal gönderiye sızmaz", () => {
    const items = pickSocialDigest([
      art({ title: "P&#x2009;&lt;&#x2009;.001 &amp; etki", summary: "Risk &#215; 2 azaldı." }),
    ], rot, NOW);
    // Beklenti KAÇIŞ DİZİSİYLE yazılır: &#x2009; ince boşluktur (U+2009), normal boşlukla
    // yazılırsa test görsel olarak doğru görünüp başarısız olur — ayırt edilemez.
    expect(items[0].title).toBe("P < .001 & etki");
    expect(items[0].summary).toBe("Risk × 2 azaldı.");
  });

  it("çözme KIRPMADAN önce olur — 160 karakter bütçesi gerçek harfleri sayar", () => {
    // Ham hâlde 8 karakter olan "&#x2009;" çözülünce 1 karaktere iner. Kırpma önce yapılsaydı
    // bütçe varlık koduyla dolar, metin erken kesilir ve kuyrukta yarım varlık kalabilirdi.
    const items = pickSocialDigest([art({ summary: `${"a".repeat(150)}&#x2009;${"b".repeat(20)}` })], rot, NOW);
    expect(items[0].summary).not.toContain("&#x");
    expect(items[0].summary.startsWith("a".repeat(150))).toBe(true);
  });
});

// 🔁 Kullanıcı kuralı eki (2026-09-21): "hukuk bölümünden yeni haber yoksa ve bir önceki günün haberi
// tekrarlanmak zorunda kalıyorsa, bunu yapma — o gün en çok gelen güncelleme hangi bölümdense oradan
// bir başlık al, tekrar eden haberin yerine koy." Tazelik ekseni createdAt (akışa düşme), eşik 24 saat.
describe("pickSocialDigest: tekrar yerine donör (🔁 2026-09-21)", () => {
  const rot = BRANCHES.find((b) => b.key === "kardiyoloji")!;
  // Dizi createdAt-DESC: route böyle verir; fikstürde taze olanlar önce yazılır.
  const eski = 30; // saat — dünkü koşunun penceresindeydi → tekrar sayılır

  it("tazesi olmayan akışın yuvası, en çok taze başlık gelen akıştan kullanılmamış başlıkla dolar; sıra korunur", () => {
    const items = pickSocialDigest([
      art({ id: "ak1", title: "Akademik 1" }),
      art({ id: "ak2", title: "Akademik 2" }),
      art({ id: "ak3", title: "Akademik 3" }),
      art({ id: "il1", module: "ilac", kind: "ilac", title: "İlaç 1" }),
      art({ id: "ic-dun", module: "mevzuat", kind: "ictihat", title: "Dünkü içtihat", createdAt: ago(eski) }),
      ...dolgu("akademik", "ilac", "ictihat"),
    ], rot, NOW);
    expect(items.map((i) => i.id)).toEqual(["ak1", "il1", "dolgu-sektorel", "dolgu-mevzuat", "ak2", "dolgu-doktrin"]);
    const donor = items[4];
    expect(donor.stream).toBe("akademik");            // etiket donör akışın
    expect(donor.streamLabel).toBe("Akademik");
    expect(donor.replaces).toEqual({ stream: "ictihat", streamLabel: "İçtihat" });
    expect(donor.stale).toBe(false);
    expect(items[0].replaces).toBeNull();             // birincil seçimler dokunulmadı
    expect(items.map((i) => i.id)).not.toContain("ic-dun");
  });

  it("donör = o gün EN ÇOK taze başlık gelen akış; eşitlikte akış sırası", () => {
    const enCok = pickSocialDigest([
      art({ id: "ak1" }),
      art({ id: "il1", module: "ilac", kind: "ilac" }),
      art({ id: "il2", module: "ilac", kind: "ilac" }),
      art({ id: "il3", module: "ilac", kind: "ilac" }),
      art({ id: "dk-dun", module: "mevzuat", kind: "doktrin", createdAt: ago(eski) }),
      ...dolgu("akademik", "ilac", "doktrin"),
    ], rot, NOW);
    expect(enCok.map((i) => i.id)).toEqual(["ak1", "il1", "dolgu-sektorel", "dolgu-mevzuat", "dolgu-ictihat", "il2"]);
    expect(enCok[5].replaces?.stream).toBe("doktrin");

    // 2'ye 2 eşitlik → STREAMS sırası: akademik önce
    const esit = pickSocialDigest([
      art({ id: "ak1" }), art({ id: "ak2" }),
      art({ id: "il1", module: "ilac", kind: "ilac" }), art({ id: "il2", module: "ilac", kind: "ilac" }),
      art({ id: "dk-dun", module: "mevzuat", kind: "doktrin", createdAt: ago(eski) }),
      ...dolgu("akademik", "ilac", "doktrin"),
    ], rot, NOW);
    expect(esit.map((i) => i.id)).toEqual(["ak1", "il1", "dolgu-sektorel", "dolgu-mevzuat", "dolgu-ictihat", "ak2"]);
  });

  it("birden çok açık yuva: donör tükenince sıradaki en yoğun akışa geçilir; donör birincil başlığı çalamaz", () => {
    const items = pickSocialDigest([
      art({ id: "ak1" }), art({ id: "ak2" }),
      art({ id: "il1", module: "ilac", kind: "ilac" }), art({ id: "il2", module: "ilac", kind: "ilac" }),
      art({ id: "il3", module: "ilac", kind: "ilac" }),
      art({ id: "mv-dun", module: "mevzuat", kind: "mevzuat", createdAt: ago(eski) }),
      art({ id: "ic-dun", module: "mevzuat", kind: "ictihat", createdAt: ago(eski) }),
      art({ id: "dk-dun", module: "mevzuat", kind: "doktrin", createdAt: ago(eski) }),
      ...dolgu("akademik", "ilac", "mevzuat", "ictihat", "doktrin"),
    ], rot, NOW);
    // ilaç 3 taze (en yoğun) → mevzuat←il2, içtihat←il3; ilaç tükendi → doktrin←ak2 (akademik 2 taze)
    expect(items.map((i) => i.id)).toEqual(["ak1", "il1", "dolgu-sektorel", "il2", "il3", "ak2"]);
    expect(items.map((i) => i.replaces?.stream ?? null)).toEqual([null, null, null, "mevzuat", "ictihat", "doktrin"]);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length); // aynı başlık iki yuvada olmaz
  });

  it("hiç donör yoksa eski başlık kalır ve stale işaretlenir (boş kart yerine fail-soft)", () => {
    const items = pickSocialDigest([
      art({ id: "ak-dun", createdAt: ago(eski) }),
      art({ id: "ic-dun", module: "mevzuat", kind: "ictihat", createdAt: ago(eski) }),
    ], rot, NOW);
    expect(items.map((i) => i.id)).toEqual(["ak-dun", "ic-dun"]);
    expect(items.every((i) => i.stale === true && i.replaces === null)).toBe(true);
  });

  it("🧩 hiç içeriği olmayan akışın yuvası da donörle dolar — 7 Ekim senaryosu: hukuk boş, kart yine altı başlık", () => {
    const items = pickSocialDigest([
      art({ id: "ak1" }), art({ id: "ak2" }), art({ id: "ak3" }), art({ id: "ak4" }),
      art({ id: "il1", module: "ilac", kind: "ilac" }),
      art({ id: "sk1", module: "sektorel", kind: "haber" }),
      // mevzuat/içtihat/doktrin: 48 saatlik pencerede HİÇ kayıt yok
    ], rot, NOW);
    expect(items).toHaveLength(6);
    expect(items.map((i) => i.id)).toEqual(["ak1", "il1", "sk1", "ak2", "ak3", "ak4"]);
    expect(items.map((i) => i.replaces?.stream ?? null)).toEqual([null, null, null, "mevzuat", "ictihat", "doktrin"]);
    expect(items.every((i) => i.stale === false)).toBe(true);
  });

  it("boş yuva donör tükenince düşer — eski başlığı olmadığı için stale bile kurulamaz", () => {
    const items = pickSocialDigest([
      art({ id: "ak1" }), art({ id: "ak2" }),
      art({ id: "il1", module: "ilac", kind: "ilac" }),
    ], rot, NOW);
    // sektörel ← ak2; mevzuat/içtihat/doktrin için taze başlık kalmadı → düşer
    expect(items.map((i) => i.id)).toEqual(["ak1", "il1", "ak2"]);
    expect(items[2].replaces?.stream).toBe("sektorel");
  });

  it("akış içi yeni haber önceliği: eski branşlı başlık yerine taze genel başlık seçilir; donör akademik branşı yalnız gerçek eşleşmede taşır", () => {
    const items = pickSocialDigest([
      art({ id: "genel-taze", title: "Genel taze" }),
      art({ id: "kardio-eski", branchSlugs: '["kardiyoloji"]', title: "Kalp — dün", createdAt: ago(eski) }),
      art({ id: "kardio-taze2", branchSlugs: '["kardiyoloji"]', title: "Kalp — bugün", createdAt: ago(3) }),
      art({ id: "ic-dun", module: "mevzuat", kind: "ictihat", createdAt: ago(eski) }),
      ...dolgu("akademik", "ictihat"),
    ], rot, NOW);
    // Birincil: tercih sırası [branşlı..., genel] içinde İLK TAZE → kardio-taze2 (branşlı ve taze)
    expect(items[0].id).toBe("kardio-taze2");
    expect(items[0].branch?.key).toBe("kardiyoloji");
    // Donör (içtihat yerine): akademikte kalan taze = genel-taze → branch null (yanlış etiket basılmaz)
    const donor = items.find((i) => i.replaces?.stream === "ictihat")!;
    expect(donor.id).toBe("genel-taze");
    expect(donor.branch).toBeNull();
    expect(items.map((i) => i.id)).not.toContain("kardio-eski");
  });

  it("eşik tam 24 saattir: 23 saat önce gelen taze, 25 saat önce gelen eskidir", () => {
    const taze = pickSocialDigest([art({ id: "x", createdAt: new Date(NOW.getTime() - SOCIAL_FRESH_MS + H) })], rot, NOW);
    expect(taze[0].stale).toBe(false);
    const eskiTek = pickSocialDigest([art({ id: "y", createdAt: new Date(NOW.getTime() - SOCIAL_FRESH_MS - H) })], rot, NOW);
    expect(eskiTek[0].stale).toBe(true);
  });
});
