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
//  · 🔁 TEKRAR YERİNE DONÖR (2026-09-21, kullanıcı kuralı EKİ): "her akıştan bir başlık" kuralı
//    korunur; ama bir akışta O GÜN yeni başlık yoksa (son SOCIAL_FRESH_MS içinde akışa düşen yok)
//    dünkü başlık TEKRARLANMAZ — yuva, o gün en çok yeni başlık gelen akıştan (eşitlikte akış
//    sırası) henüz kullanılmamış TAZE bir başlıkla dolar. Yuvanın SIRASI korunur, başlık donör
//    akışın etiketini taşır, `replaces` hangi akışın yerine girdiğini söyler. Donör kalmadıysa
//    eski başlık `stale: true` ile kalır (boş kart yerine — fail-soft, kart tarafı isterse
//    gizler). Akışta 48 saatte HİÇ içerik yoksa akış yine düşer, doldurulmaz (kural tekrarı
//    hedefler, boşluğu değil — "boş akış düşer" sözleşmesi sürer).
//    DURUMSUZ: dünkü seçki DB'den okunmaz. Günlük kadansta bir akışın "o gün gelmemiş" en taze
//    başlığı dünkü pencerede de en tazeydi → dün basıldı; "yeni yok" = "tekrar edecek" demektir.
//    Gün içi elle koşulan ingest bir sonraki koşuda "yeni" sayılır (24 saat kayan pencere —
//    takvim günü DEĞİL; daily-digest'in trDayStart dersi).
import { BRANCHES } from "./triage";
import { trimSummary } from "./daily-digest";
import { decodeFeedText } from "./doctorium";
import { isNativeTurkishSource } from "./news-language";

type Branch = (typeof BRANCHES)[number];

/** Seçki penceresi: son 48 saatte İNGEST edilenler (06:30 TR cron'u sonrası taze; zayıf günde
 *  önceki günün içeriği açığı kapatır — boş akış yine düşer, boş kart üretilmez). */
export const SOCIAL_WINDOW_MS = 48 * 3_600_000;

/** "O gün gelen" eşiği = son koşudan beri (günlük kadans → 24 saat, `now`dan geriye). Bir akışın
 *  bu pencerede başlığı yoksa seçeceği başlık dünkü koşuda da en tazeydi → tekrar sayılır ve yuva
 *  donörden dolar (dosya başı 🔁 kuralı). */
export const SOCIAL_FRESH_MS = 24 * 3_600_000;

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
  /** Akışa düşme anı (NewsArticle.createdAt) — TAZELİK ekseni; publishedAt kaynağın kendi tarihidir. */
  createdAt: Date;
}

export interface SocialDigestItem {
  /** NewsArticle.id — kart/arşiv tarafı aynı başlığı ayırt edebilsin (2026-09-21). */
  id: string;
  stream: string;
  streamLabel: string;
  title: string;
  sourceName: string;
  summary: string;
  url: string | null;
  publishedAt: string; // ISO
  /** Yalnız akademik akışta ve rotasyon branşından seçilebildiyse dolu. */
  branch: { key: string; label: string } | null;
  /** Bu başlık başka bir akışın YERİNE girdiyse (o akışta o gün yeni başlık yoktu): o akış.
   *  stream/streamLabel donör akışındır; kart iki kez aynı akış etiketi görebilir — bilinçli. */
  replaces: { stream: string; streamLabel: string } | null;
  /** O gün yeni başlık yok VE donör bulunamadı → eski başlık kaldı (dünkü seçkiyle aynı olabilir). */
  stale: boolean;
}

type Stream = { key: string; label: string; match: (a: SocialArticle) => boolean };

/** Altı akışın NewsArticle eşlemesi — daily-digest SECTIONS ile aynı ayrım (tek doğruluk oradaki
 *  yorumda: module=mevzuat üç akışa kind ile ayrılır). */
const STREAMS: Stream[] = [
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

function isBrandedFor(a: SocialArticle, rotation: Branch): boolean {
  // branchSlugs JSON string'inde `"slug"` araması — parse maliyetsiz ve slug'lar tırnak içinde benzersiz.
  return a.branchSlugs.includes(`"${rotation.key}"`);
}

/** Tercih grubunu öne alır, grup içi tazelik sırasını (girdi createdAt-DESC) korur. */
function prioritize(pool: SocialArticle[], preferred: (a: SocialArticle) => boolean): SocialArticle[] {
  const first = pool.filter(preferred);
  if (first.length === 0) return pool;
  const ids = new Set(first.map((a) => a.id));
  return [...first, ...pool.filter((a) => !ids.has(a.id))];
}

/**
 * Akış içi TERCİH SIRASI — birincil seçim ve donör seçimi AYNI sırayı kullanır (tek doğruluk noktası):
 *  · akademik: rotasyon branşı öncelikli, sonra genel (yoksa genel akademik — fallback);
 *  · sektörel: yerli kaynak öncelikli (2026-09-02), sonra çevrilmiş yabancı;
 *  · diğerleri: en taze önce.
 */
function orderCandidates(stream: Stream, pool: SocialArticle[], rotation: Branch): SocialArticle[] {
  if (stream.key === "akademik") return prioritize(pool, (a) => isBrandedFor(a, rotation));
  if (stream.key === "sektorel") return prioritize(pool, (a) => isNativeTurkishSource(a.source));
  return pool;
}

function toItem(
  a: SocialArticle,
  stream: Stream,
  rotation: Branch,
  replaces: SocialDigestItem["replaces"],
  stale: boolean,
): SocialDigestItem {
  const branded = stream.key === "akademik" && isBrandedFor(a, rotation);
  return {
    id: a.id,
    stream: stream.key,
    streamLabel: stream.label,
    // Varlık temizliği BURADA da gerekli: bu uç NewsArticle satırını doğrudan okur, web akışının
    // toFeedItem dönüşümünden geçmez — decode olmadan "&#x2009;" sosyal medya gönderisine ham
    // giderdi. Kırpmadan ÖNCE çözülür: 160 karakterlik bütçe gerçek harfleri saymalı ve kırpma
    // bir varlığı ortadan bölmemeli ("… &#x20" gibi bozuk kuyruk).
    title: decodeFeedText(a.title),
    sourceName: a.sourceName,
    summary: trimSummary(decodeFeedText(a.summary), 160),
    url: a.url,
    publishedAt: a.publishedAt.toISOString(),
    branch: branded ? { key: rotation.key, label: rotation.label } : null,
    replaces,
    stale,
  };
}

/**
 * Seçkiyi kur — SAF fonksiyon (birim testli). Girdi createdAt-DESC sıralıdır (48 saatlik pencere,
 * route süzer); `now` tazelik eşiğinin referansıdır (koşu anı).
 *
 * İki geçiş:
 *  1) Birincil — akış başına tercih sırasındaki İLK TAZE aday (son SOCIAL_FRESH_MS içinde gelen).
 *     Tazesi olmayan akışın yuvası AÇIK kalır; hiç içeriği olmayan akış listeye girmez.
 *  2) Donör — açık yuvalar, o gün en çok taze başlık gelen akıştan (eşitlikte akış sırası; donör
 *     tükenince sıradaki) henüz kullanılmamış taze başlıkla dolar. Donör yoksa eski başlık
 *     `stale: true` ile kalır.
 * Birincil geçiş tamamen bitmeden donör geçişi başlamaz → donör hiçbir akışın kendi birincil
 * başlığını ÇALAMAZ (`used` kümesi).
 */
export function pickSocialDigest(articles: SocialArticle[], rotation: Branch, now: Date): SocialDigestItem[] {
  const freshSince = now.getTime() - SOCIAL_FRESH_MS;
  const isFresh = (a: SocialArticle) => a.createdAt.getTime() > freshSince;

  const slots: { stream: Stream; ordered: SocialArticle[]; pick: SocialArticle | null }[] = [];
  const used = new Set<string>();
  for (const s of STREAMS) {
    const pool = articles.filter(s.match);
    if (pool.length === 0) continue; // boş akış düşer — donörle DOLDURULMAZ
    const ordered = orderCandidates(s, pool, rotation);
    const pick = ordered.find(isFresh) ?? null;
    if (pick) used.add(pick.id);
    slots.push({ stream: s, ordered, pick });
  }

  // Donör sırası: o gün en çok taze başlık gelen akış önce; Array.prototype.sort kararlıdır →
  // eşitlikte STREAMS sırası korunur. Tazesi olmayan akış (= açık yuvanın kendisi) donör olamaz.
  const freshCount = new Map(STREAMS.map((s) => [s.key, articles.filter((a) => s.match(a) && isFresh(a)).length]));
  const donors = STREAMS
    .filter((s) => (freshCount.get(s.key) ?? 0) > 0)
    .sort((a, b) => (freshCount.get(b.key) ?? 0) - (freshCount.get(a.key) ?? 0));

  const items: SocialDigestItem[] = [];
  for (const slot of slots) {
    if (slot.pick) {
      items.push(toItem(slot.pick, slot.stream, rotation, null, false));
      continue;
    }
    let filled: SocialDigestItem | null = null;
    for (const d of donors) {
      const cand = orderCandidates(d, articles.filter(d.match), rotation)
        .find((a) => isFresh(a) && !used.has(a.id));
      if (!cand) continue;
      used.add(cand.id);
      filled = toItem(cand, d, rotation, { stream: slot.stream.key, streamLabel: slot.stream.label }, false);
      break;
    }
    items.push(filled ?? toItem(slot.ordered[0], slot.stream, rotation, null, true));
  }
  return items;
}
