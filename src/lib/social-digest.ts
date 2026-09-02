// Kamuya açık günlük gazete seçkisi — sosyal medya dağıtımının veri kaynağı (2026-08-30).
// Tasarım: kullanıcının "Doctorium Yapılacaklar" belgesi §2.2 + tasarım kararı (kullanıcı onayı
// 2026-08-30): n8n kaynaklara KENDİSİ GİTMEZ ve DB'ye BAĞLANMAZ — süzgeç/rotasyon mantığı tek
// yerde (sitede) yaşar, n8n yalnız bu seçkiyi alıp dağıtır (/api/social-digest).
//
// Kurallar (belge §2.2):
//  · TEASER formatı — Post'un tam hali kamuya paylaşılmaz (üyelik değeri): akış başına 1 başlık.
//  · Akış seti = Post bölümleriyle aynı altı akış (akademik/ilaç/sektörel/mevzuat/içtihat/doktrin).
//    Etkinlik+Kariyer akış içeriği değildir (daily-digest SECTIONS notu) — seçkiye girmez.
//  · Branş rotasyonu: akademik başlık GÜNÜN BRANŞINA göre seçilir ("bu akışı kendi branşım için
//    istiyorum" tetikleyicisi); o branşta içerik yoksa genel akademik başlığa düşer.
//  · Determinizm: aynı gün aynı çıktı (rotasyon gün etiketinden türetilir; sıralama ikincil id'li).
//  · Telif çizgisi Post'la aynı: başlık + kaynak + kısa özet + link — tam metin taşınmaz.
//  · Kişisel veri YOK: NewsArticle metadata'sı; sponsor/anket bu tablodan zaten geçmez.
//  · Sektörelde YERLİ kaynak önceliği (2026-09-02, kullanıcı kararı): pencerede Türkçe doğan
//    kaynak varsa çevrilmiş uluslararası haberden önce seçilir (lib/news-language); yerli
//    yoksa en taze yabancı kalır — akış boş düşmez.
import { BRANCHES } from "./triage";
import { trimSummary } from "./daily-digest";
import { decodeFeedText } from "./doctorium";
import { isNativeTurkishSource } from "./news-language";

type Branch = (typeof BRANCHES)[number];

/** Seçki penceresi: son 48 saatte İNGEST edilenler (06:30 TR cron'u sonrası taze; zayıf günde
 *  önceki günün içeriği açığı kapatır — boş akış yine düşer, boş kart üretilmez). */
export const SOCIAL_WINDOW_MS = 48 * 3_600_000;

/** Seçkiye giren makale alanları (route select'iyle bire bir). */
export interface SocialArticle {
  id: string;
  /** NewsArticle.source anahtarı — yerli/yabancı ayrımı (lib/news-language). */
  source: string;
  module: string;
  kind: string;
  title: string;
  sourceName: string;
  summary: string;
  url: string | null;
  branchSlugs: string; // JSON string[] (NewsArticle.branchSlugs)
  publishedAt: Date;
}

export interface SocialDigestItem {
  stream: string;
  streamLabel: string;
  title: string;
  sourceName: string;
  summary: string;
  url: string | null;
  publishedAt: string; // ISO
  /** Yalnız akademik akışta ve rotasyon branşından seçilebildiyse dolu. */
  branch: { key: string; label: string } | null;
}

/** Altı akışın NewsArticle eşlemesi — daily-digest SECTIONS ile aynı ayrım (tek doğruluk oradaki
 *  yorumda: module=mevzuat üç akışa kind ile ayrılır). */
const STREAMS: { key: string; label: string; match: (a: SocialArticle) => boolean }[] = [
  { key: "akademik", label: "Akademik", match: (a) => a.module === "akademik" },
  { key: "ilac", label: "İlaç & Cihaz", match: (a) => a.module === "ilac" },
  { key: "sektorel", label: "Sektörel", match: (a) => a.module === "sektorel" },
  { key: "mevzuat", label: "Mevzuat", match: (a) => a.module === "mevzuat" && a.kind === "mevzuat" },
  { key: "ictihat", label: "İçtihat", match: (a) => a.module === "mevzuat" && a.kind === "ictihat" },
  { key: "doktrin", label: "Doktrin", match: (a) => a.module === "mevzuat" && a.kind === "doktrin" },
];

/**
 * Günün rotasyon branşı — SAF ve deterministik: "YYYY-MM-DD" gün etiketinden yılın günü → mod 35.
 * Gün etiketi TR günüdür (trDayString) → rotasyon TR gece yarısında döner, gün içinde sabittir.
 */
export function rotationBranchFor(day: string): Branch {
  const [y, m, d] = day.split("-").map(Number);
  const dayOfYear = Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000);
  return BRANCHES[dayOfYear % BRANCHES.length];
}

/**
 * Seçkiyi kur — SAF fonksiyon (birim testli). Girdi createdAt-DESC sıralıdır; akış başına İLK
 * (en taze) eşleşme alınır. Akademikte önce rotasyon branşı denenir (branchSlugs JSON string'inde
 * `"slug"` araması — parse maliyetsiz ve slug'lar tırnak içinde benzersiz), yoksa genel akademik.
 */
export function pickSocialDigest(articles: SocialArticle[], rotation: Branch): SocialDigestItem[] {
  const items: SocialDigestItem[] = [];
  for (const s of STREAMS) {
    const pool = articles.filter(s.match);
    if (pool.length === 0) continue;
    let picked = pool[0];
    let branch: SocialDigestItem["branch"] = null;
    if (s.key === "akademik") {
      const branded = pool.find((a) => a.branchSlugs.includes(`"${rotation.key}"`));
      if (branded) {
        picked = branded;
        branch = { key: rotation.key, label: rotation.label };
      }
    }
    if (s.key === "sektorel") {
      // Yerli kaynak önceliği (2026-09-02): TTB/İTO/OHSAD/SGK/dernek kalemi varsa Medscape/Medical
      // Xpress/WHO'dan (artık çevrilmiş olsalar da) önce gelir; yerli yoksa en taze yabancı kalır.
      const native = pool.find((a) => isNativeTurkishSource(a.source));
      if (native) picked = native;
    }
    items.push({
      stream: s.key,
      streamLabel: s.label,
      // Varlık temizliği BURADA da gerekli: bu uç NewsArticle satırını doğrudan okur, web akışının
      // toFeedItem dönüşümünden geçmez — decode olmadan "&#x2009;" sosyal medya gönderisine ham
      // giderdi. Kırpmadan ÖNCE çözülür: 160 karakterlik bütçe gerçek harfleri saymalı ve kırpma
      // bir varlığı ortadan bölmemeli ("… &#x20" gibi bozuk kuyruk).
      title: decodeFeedText(picked.title),
      sourceName: picked.sourceName,
      summary: trimSummary(decodeFeedText(picked.summary), 160),
      url: picked.url,
      publishedAt: picked.publishedAt.toISOString(),
      branch,
    });
  }
  return items;
}
