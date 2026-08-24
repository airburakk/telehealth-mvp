// Türkiye uzmanlık dernekleri — KALICI KAYNAK KAYDI (v6.129, kullanıcı rehberi 2026-08-19).
//
// NE İŞE YARAR — üç tüketici:
//   1. `scripts/association-watch.mjs` (haftalık GitHub Actions nöbetçisi): her derneğin duyuru
//      sayfasının içerik PARMAK İZİNİ karşılaştırır, değişenleri + ölü/şüpheli domainleri
//      raporlar. Veri ÇIKARMAZ, DB'ye YAZMAZ — yalnız "buraya bak" sinyali üretir.
//   2. `scripts/congress-refresh-queue.ts`: geçmiş edisyonu arayan ajana "sonraki edisyonu ŞU
//      dernek sitesinden ara" ipucunu verir (kongre-özel domainler her yıl ölür, dernek kalır).
//   3. `lib/doctorium-sources.ts` ASSOCIATION_RSS_SOURCES: `rss` alanı dolu olanlar günlük
//      ingest'te sektörel akışa düşer (sözleşme testi iki listeyi hizada tutar).
//
// 🔴 DEĞİŞMEZ İLKE: bu liste bir KAYNAK REHBERİDİR, veri kaynağı değil. Buradaki hiçbir alan
// (özellikle etkinlik tarihi) otomatik veri üretmez — "asla uydurma" ilkesi (bkz. seed-data/
// congresses.json başlığı) kongre modülünde olduğu gibi burada da geçerli.
//
// 🪤 2026-08-19 CANLI ÖLÇÜMÜ (33 domain, autodiscovery + 7 yaygın feed yolu):
//   • 5 dernek geçerli RSS veriyor → `rss` dolu. Kalan 28 makine-okunur besleme yayımlamıyor.
//   • KULLANICI REHBERİNDEKİ 5 ADRES DÜZELTİLDİ — hepsi ölçümle, tahminle değil:
//       atuder.org.tr    → www ŞART (çıplak ad sağlayıcı PARK sayfası döndürüyor)
//       uroloji.org.tr   → uroturk.org.tr (eskisi SERVFAIL)
//       tibbigenetikturkiye.org → NXDOMAIN, çalışan adres YOK (`unverified`)
//       kanser.org · nefroloji.org.tr → kökleri KAPI sayfası, gerçek içerik `newsPath`'te
//   • 🔴 BU DÜZELTMELERİN ÖĞRETTİĞİ DERS: yerel çözümleyici YALAN SÖYLEYEBİLİR. İki ölü adres
//     "TLS zinciri eksik" gibi görünüyordu; sertifikaya bakınca CN=192.168.1.1 / ZTE-ROOT-CA
//     çıktı — MODEM, çözülemeyen adı kendi arayüzüne yakalıyordu. Teşhis bağımsız çözümleyiciden
//     (Cloudflare DoH) geldi ve artık nöbetçiye GÖMÜLÜ (scripts/association-watch.mjs dnsCheck).
//
// ⚠️ `branchSlug` lib/triage BRANCHES anahtarıdır. Uydurma slug yazma: bilinmeyen slug'ı süzgeç
// sessizce atar, kayıt DB'de durur ama hiçbir doktora görünmez (sözleşme testi bunu kilitler).

export interface AssociationDef {
  /** Kararlı anahtar — DB'ye `source` olarak yazılan RSS kaynaklarıyla AYNI olmalı. */
  slug: string;
  name: string;
  /** Kısaltma (TKD, TTD…) — nöbetçi raporunda okunurluk için. */
  abbr?: string;
  branchSlug: string;
  /** Kurumun kalıcı adresi. Kongre-özel domainler (tkdcd2026.org) BURAYA YAZILMAZ. */
  site: string;
  /** Duyuru/haber/etkinlik sayfası — nöbetçi bunu izler. Yoksa ana sayfa izlenir. */
  newsPath?: string;
  /** Ölçülmüş geçerli RSS/Atom adresi. null = besleme yok (2026-08-19 ölçümü). */
  rss?: string;
  /**
   * true: bu adresin ÇALIŞTIĞI doğrulanamadı (ölçümde 4xx/5xx ya da ölü DNS). Kayıt listede
   * KALIR — nöbetçi izlemeye devam eder, düzeldiğinde yakalar. Silinseydi dernek tamamen
   * kör noktaya düşerdi; uydurma bir adres yazmak ise "asla uydurma" ilkesini çiğnerdi.
   */
  unverified?: boolean;
  /** Aynı branşta ikinci dernek (ör. acil tıpta TATD + ATUDER) — rehberde ikisi de var. */
  note?: string;
}

export const ASSOCIATIONS: AssociationDef[] = [
  { slug: "tkd", abbr: "TKD", name: "Türk Kardiyoloji Derneği", branchSlug: "kardiyoloji", site: "https://tkd.org.tr", newsPath: "/duyurular" },
  { slug: "toraks", abbr: "TTD", name: "Türk Toraks Derneği", branchSlug: "gogus-hastaliklari", site: "https://toraks.org.tr", newsPath: "/haberler" },
  { slug: "tusad", abbr: "TÜSAD", name: "Türkiye Solunum Araştırmaları Derneği", branchSlug: "gogus-hastaliklari", site: "https://solunum.org.tr", note: "aynı branşta TTD ile birlikte" },
  { slug: "tnd-noroloji", abbr: "TND", name: "Türk Nöroloji Derneği", branchSlug: "noroloji", site: "https://noroloji.org.tr", note: "kısaltma TND üç dernekte ortak: nöroloji · nöroşirürji · nefroloji" },
  { slug: "tatd", abbr: "TATD", name: "Türkiye Acil Tıp Derneği", branchSlug: "acil-tip", site: "https://tatd.org.tr", rss: "https://tatd.org.tr/feed/" },
  // 🪤 www ŞART: çıplak atuder.org.tr sağlayıcının PARK sayfasını döndürüyor (167 bayt, "Lookus"),
  //    .org varyantı ise TLS zincirini eksik sunuyor. Ölçüldü 2026-08-19.
  { slug: "atuder", abbr: "ATUDER", name: "Acil Tıp Uzmanları Derneği", branchSlug: "acil-tip", site: "https://www.atuder.org.tr", note: "aynı branşta TATD ile birlikte" },
  { slug: "turkpediatri", name: "Türk Pediatri Kurumu", branchSlug: "cocuk-sagligi", site: "https://turkpediatri.org.tr" },
  { slug: "millipediatri", name: "Milli Pediatri Derneği", branchSlug: "cocuk-sagligi", site: "https://millipediatri.org.tr", note: "aynı branşta Türk Pediatri Kurumu ile birlikte" },
  { slug: "tcd", abbr: "TCD", name: "Türk Cerrahi Derneği", branchSlug: "genel-cerrahi", site: "https://turkcer.org.tr" },
  { slug: "totbid", abbr: "TOTBİD", name: "Türk Ortopedi ve Travmatoloji Birliği Derneği", branchSlug: "ortopedi", site: "https://totbid.org.tr" },
  { slug: "tjod", abbr: "TJOD", name: "Türk Jinekoloji ve Obstetrik Derneği", branchSlug: "kadin-dogum", site: "https://www.tjod.org", rss: "https://www.tjod.org/feed/" },
  // 🪤 uroloji.org.tr bağımsız çözümleyicide SERVFAIL (yetkili DNS arızalı) — yerel modem onu
  //    yakalayıp HTTP 200 döndürdüğü için "çalışıyor" sanılıyordu. Derneğin CANLI adresi
  //    uroturk.org.tr (ölçüldü 2026-08-19: "TÜRK ÜROLOJİ DERNEĞİ", 2689 karakter içerik).
  //    ⚠️ seed-data/congresses.json'da hâlâ uroloji.org.tr geçen 3 kayıt var — tazeleme turunda
  //    doğrulanmalı (adres düzeltmesi VERİ değişikliğidir, elle kürasyona ait).
  { slug: "tud", abbr: "TÜD", name: "Türk Üroloji Derneği", branchSlug: "uroloji", site: "https://uroturk.org.tr", note: "eski/ölü adres: uroloji.org.tr (SERVFAIL)" },
  { slug: "tod-goz", abbr: "TOD", name: "Türk Oftalmoloji Derneği", branchSlug: "goz", site: "https://todnet.org" },
  { slug: "kbb", name: "Türk Kulak Burun Boğaz ve Baş Boyun Cerrahisi Derneği", branchSlug: "kbb", site: "https://kbb.org.tr" },
  { slug: "tihud", abbr: "TİHUD", name: "Türkiye İç Hastalıkları Uzmanlık Derneği", branchSlug: "dahiliye", site: "https://tihud.org.tr" },
  // 🪤 kanser.org kökü KAPI sayfası (238 karakter, dil/bölüm seçimi); haber arşivi /saglik/haberler-2.
  { slug: "ttod", abbr: "TTOD", name: "Türk Tıbbi Onkoloji Derneği", branchSlug: "onkoloji", site: "https://www.kanser.org", newsPath: "/saglik/haberler-2" },
  { slug: "tdd", abbr: "TDD", name: "Türk Dermatoloji Derneği", branchSlug: "dermatoloji", site: "https://turkdermatoloji.org.tr" },
  { slug: "tpd", abbr: "TPD", name: "Türkiye Psikiyatri Derneği", branchSlug: "psikiyatri", site: "https://psikiyatri.org.tr" },
  { slug: "trd-radyoloji", abbr: "TRD", name: "Türk Radyoloji Derneği", branchSlug: "radyoloji", site: "https://turkrad.org.tr", note: "kısaltma TRD romatoloji derneğiyle ortak" },
  { slug: "tard", abbr: "TARD", name: "Türk Anesteziyoloji ve Reanimasyon Derneği", branchSlug: "anesteziyoloji", site: "https://tard.org.tr" },
  { slug: "tnd-norosirurji", name: "Türk Nöroşirürji Derneği", branchSlug: "norosirurji", site: "https://turknorosirurji.org.tr" },
  { slug: "tpcd", name: "Türk Plastik, Rekonstrüktif ve Estetik Cerrahi Derneği", branchSlug: "estetik", site: "https://plastikcerrahi.org.tr" },
  { slug: "tftr", abbr: "TFTR", name: "Türkiye Fiziksel Tıp ve Rehabilitasyon Derneği", branchSlug: "fizik-tedavi", site: "https://tftr.org.tr" },
  { slug: "klimik", abbr: "KLİMİK", name: "Türk Klinik Mikrobiyoloji ve İnfeksiyon Hastalıkları Derneği", branchSlug: "enfeksiyon", site: "https://www.klimik.org.tr", rss: "https://www.klimik.org.tr/feed/" },
  { slug: "temd", abbr: "TEMD", name: "Türkiye Endokrinoloji ve Metabolizma Derneği", branchSlug: "endokrinoloji", site: "https://temd.org.tr" },
  { slug: "tgd-gastro", abbr: "TGD", name: "Türk Gastroenteroloji Derneği", branchSlug: "gastroenteroloji", site: "https://tgd.org.tr", rss: "https://tgd.org.tr/feed/", note: "kısaltma TGD tıbbi genetik derneğiyle ortak" },
  { slug: "trd-romatoloji", name: "Türkiye Romatoloji Derneği", branchSlug: "romatoloji", site: "https://www.romatoloji.org", newsPath: "/Etkinlikler/TRDEtkinlikleri", note: "adres .org.tr DEĞİL .org (rehberdeki .org.tr yanıt vermiyor)" },
  { slug: "thd", abbr: "THD", name: "Türk Hematoloji Derneği", branchSlug: "hematoloji", site: "https://thd.org.tr" },
  // 🪤 nefroloji.org.tr kökü hasta/profesyonel AYRIM kapısı (125 karakter); içerik /tr/home'da.
  { slug: "tnd-nefroloji", name: "Türk Nefroloji Derneği", branchSlug: "nefroloji", site: "https://nefroloji.org.tr", newsPath: "/tr/home" },
  { slug: "tgcd", abbr: "TGCD", name: "Türk Göğüs Cerrahisi Derneği", branchSlug: "gogus-cerrahisi", site: "https://tgcd.org.tr", rss: "https://tgcd.org.tr/feed/" },
  { slug: "tkdcd", abbr: "TKDCD", name: "Türk Kalp ve Damar Cerrahisi Derneği", branchSlug: "kvc", site: "https://tkdcd.org" },
  { slug: "turkpath", name: "Türk Patoloji Dernekleri Federasyonu", branchSlug: "patoloji", site: "https://turkpath.org.tr", note: "federasyonun canlı adresi turkpath.org.tr (rehberdeki turkpatoloji.org değil)" },
  // 🪤 tibbigenetikturkiye.org bağımsız çözümleyicide NXDOMAIN — alan adı YOK (yerel modem
  //    yakalaması "TLS sorunu" gibi gösteriyordu). tibbigenetik.org.tr ÇÖZÜLÜYOR ama sunucu
  //    HTTP 500 (ASP.NET runtime error) veriyor. Derneğin çalışan bir adresi DOĞRULANAMADI →
  //    site alanı en makul adayla dolduruldu ve `unverified` işaretlendi: nöbetçi izler,
  //    düzelirse yakalar. Uydurma adres yazmaktansa "doğrulanmadı" demek doğrudur.
  { slug: "tibbigenetik", name: "Tıbbi Genetik Derneği", branchSlug: "tibbi-genetik", site: "https://tibbigenetik.org.tr", unverified: true, note: "rehberdeki tibbigenetikturkiye.org NXDOMAIN; bu adres HTTP 500 — çalışan adres doğrulanamadı" },
];

/** Nöbetçinin izleyeceği tam adres (duyuru sayfası varsa o, yoksa ana sayfa). */
export function watchUrl(a: AssociationDef): string {
  return a.newsPath ? new URL(a.newsPath, a.site).href : a.site + "/";
}

/** Branşa göre dernekler (bir branşta birden fazla olabilir — acil tıp, çocuk, göğüs). */
export function associationsForBranch(branchSlug: string): AssociationDef[] {
  return ASSOCIATIONS.filter((a) => a.branchSlug === branchSlug);
}
