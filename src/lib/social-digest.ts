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
//    gizler).
//  · 🧩 HER ZAMAN ALTI YUVA (v6.336, 2026-10-07, 👤 karar): 48 saatte HİÇ içeriği olmayan akış da
//    (tipik: hafta sonu sonrası Mevzuat/İçtihat/Doktrin) artık DÜŞMEZ — yuvası açık kalır ve aynı
//    donör geçişiyle dolar. Eski "boş akış düşer, doldurulmaz" istisnası kart 5–7 Ekim'de 3 başlığa
//    inince kaldırıldı. Donör de kalmadıysa boş yuva düşer (eski başlığı olmadığı için `stale`
//    bile kurulamaz) — kart hiçbir zaman sahte/boş öğe taşımaz.
//    DURUMSUZ: dünkü seçki DB'den okunmaz. Günlük kadansta bir akışın "o gün gelmemiş" en taze
//    başlığı dünkü pencerede de en tazeydi → dün basıldı; "yeni yok" = "tekrar edecek" demektir.
//    Gün içi elle koşulan ingest bir sonraki koşuda "yeni" sayılır (24 saat kayan pencere —
//    takvim günü DEĞİL; daily-digest'in trDayStart dersi).
//  · 🗄️ HUKUK CEPHANELİĞİ (2026-10-26, 👤 karar): hukuk akışları doğası gereği seyrek (Yargıtay haftalık, TR Dizin
//    ayda birkaç makale) → 24 saat kuralıyla yuvaları neredeyse her gün donöre gidiyor, kart akademikle doluyordu.
//    · İçtihat / Doktrin: taze yoksa yuva DB'deki mevcut kararlar/makalelerden (cephanelik) deterministik gün
//      rotasyonuyla dolar; etiket "Arşivden İçtihat" / "Arşivden Doktrin" (`archive: true`) — okur bunun bugünün
//      haberi olmadığını görür. Son 30 günde akışa düşen satır cephaneliğe girmez (yakında zaten gösterildi).
//      Doktrin cephaneliği başlığında hukuk/malpraktis/onam/sorumluluk geçenlerle daraltılır (adli diş vaka
//      prevalansı gibi zayıf hukuki içerik girmesin).
//    · Mevzuat: YALNIZ taze Resmî Gazete — yeni yoksa yuva donöre gider; eski başlık `stale` olarak da KALMAZ.
//    · 🔒 İçtihatta HAM KARAR METNİ KULLANILMAZ (taze ya da arşiv): Yargıtay anonimleştirmesi kusurlu ("davacının
//      Mina'nın…" sızıntısı — İçerik Takvimi notu) → özet yerine sözlükten türeyen "Konu … Dayanak …" satırı
//      (lib/hukuk-keywords); başlığı kimlik taramasına (social-calendar/identity) takılan karar cephanelikten seçilmez.
//  · 📰 SEKTÖREL İKİNCİ HABER (2026-10-26, 👤 karar): altı yuva korunur; açık yuvaya İLK donör sektöreldir ve ikinci
//    haber birincinin karşı kökeninden gelir (biri yerli, biri uluslararası). Sektörel tükenince eski donör sırası.
import { BRANCHES } from "./triage";
import { trimSummary } from "./daily-digest";
import { decodeFeedText } from "./doctorium";
import { isNativeTurkishSource } from "./news-language";
import { buildSummaryLong } from "./social-summary-long";
import { normalizeTrialPhasePrefix } from "./trial-phase";
import { extractKeywords, extractLawRefs } from "./hukuk-keywords";
import { scanIdentity } from "./social-calendar/identity";

type Branch = (typeof BRANCHES)[number];

/** Seçki penceresi: son 48 saatte İNGEST edilenler (06:30 TR cron'u sonrası taze; zayıf günde
 *  önceki günün içeriği açığı kapatır — boş akışın yuvası donörle dolar, boş kart üretilmez). */
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
  /** Hikâye/Reels açıklaması (v6.317): aynı özetten ≤400 karakter, CÜMLE sınırından kırpılmış (teaser `summary` 160'tır).
   *  Özet kullanılamıyorsa (boş / çok kısa / çevrilmemiş-İngilizce) dürüst yedek cümle: kaynak + yayın günü + "ayrıntı kaynak
   *  bağlantısında" — UYDURMA YOK. Kaynak artıkları (HTML etiketi, "The post … first appeared on …") ayıklanır.
   *  Yalnız jetonlu uç → n8n/kart; halka açık /secki sayfası göstermez. Kaynak: lib/social-summary-long. */
  summaryLong: string;
  /** true → `summaryLong` yedek cümledir (özet kullanılamadı); hikâye tarafı isterse farklı sunar. */
  summaryLongFallback: boolean;
  url: string | null;
  publishedAt: string; // ISO
  /** Yalnız akademik akışta ve rotasyon branşından seçilebildiyse dolu. */
  branch: { key: string; label: string } | null;
  /** Bu başlık başka bir akışın YERİNE girdiyse (o akışta o gün yeni başlık yoktu): o akış.
   *  stream/streamLabel donör akışındır; kart iki kez aynı akış etiketi görebilir — bilinçli. */
  replaces: { stream: string; streamLabel: string } | null;
  /** O gün yeni başlık yok VE donör bulunamadı → eski başlık kaldı (dünkü seçkiyle aynı olabilir). */
  stale: boolean;
  /** true → başlık hukuk cephaneliğinden (taze değil); streamLabel "Arşivden …" taşır (🗄️ 2026-10-26). */
  archive: boolean;
}

type ArchiveKind = "ictihat" | "doktrin";

type Stream = {
  key: string;
  label: string;
  match: (a: SocialArticle) => boolean;
  /** Tazesi yoksa yuvayı dolduran cephanelik (🗄️). */
  archive?: ArchiveKind;
  /** false → tazesi ve donörü yoksa eski başlık `stale` olarak da KALMAZ, yuva düşer (Mevzuat). */
  staleOk?: false;
};

/** Altı akışın NewsArticle eşlemesi — daily-digest SECTIONS ile aynı ayrım (tek doğruluk oradaki
 *  yorumda: module=mevzuat üç akışa kind ile ayrılır). */
const STREAMS: Stream[] = [
  { key: "akademik", label: "Akademik", match: (a) => a.module === "akademik" },
  { key: "ilac", label: "İlaç & Cihaz", match: (a) => a.module === "ilac" },
  { key: "sektorel", label: "Sektörel", match: (a) => a.module === "sektorel" },
  { key: "mevzuat", label: "Mevzuat", match: (a) => a.module === "mevzuat" && a.kind === "mevzuat", staleOk: false },
  { key: "ictihat", label: "İçtihat", match: (a) => a.module === "mevzuat" && a.kind === "ictihat", archive: "ictihat" },
  { key: "doktrin", label: "Doktrin", match: (a) => a.module === "mevzuat" && a.kind === "doktrin", archive: "doktrin" },
];

// ── 🗄️ Hukuk cephaneliği ────────────────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;
/** Türkiye UTC+3, yaz saati yok — TR gününün sırası (epoch'tan). Aynı TR günü aynı cephanelik seçimi. */
const trDayIndex = (now: Date) => Math.floor((now.getTime() + 3 * 3_600_000) / DAY_MS);

/** Son bu kadar günde akışa düşen satır cephaneliğe girmez (yakında zaten gösterildi). */
export const ARCHIVE_EXCLUDE_RECENT_DAYS = 30;
/** Cephaneliğin en eski yayın yılı — eski içtihat/doktrin güncel hukuku yansıtmayabilir. */
export const ARCHIVE_MIN_YEAR: Record<ArchiveKind, number> = { ictihat: 2021, doktrin: 2019 };

/** Cephanelik adayı — hafif satır (karar metni gibi büyük `summary` havuz sorgusunda taşınmaz). */
export interface SocialArchiveRow {
  id: string;
  kind: string;
  title: string;
  publishedAt: Date;
  createdAt: Date;
}

/** Cephanelikten seçilip TAM satırı okunmuş adaylar (lib/social-digest-public yükler). */
export type SocialArchive = Partial<Record<ArchiveKind, SocialArticle>>;

/** Doktrin cephaneliğine girecek kadar hukuki mi? (👤 onaylı daraltma: hukuk/malpraktis/onam/sorumluluk) */
export function isDoctrineArchiveWorthy(title: string): boolean {
  return /hukuk|malpraktis|malpractice|onam|sorumlu/.test(title.toLocaleLowerCase("tr"));
}

/** Cephaneliğin `now` TR gününde dışladığı en yeni akışa-düşme anı (gün tabanlı → kart ile /secki aynı sonucu verir). */
export function archiveCutoff(now: Date): Date {
  return new Date((trDayIndex(now) - ARCHIVE_EXCLUDE_RECENT_DAYS) * DAY_MS - 3 * 3_600_000);
}

/**
 * Cephanelikten günün adayı — SAF ve deterministik. Havuz yayın tarihi DESC + id ASC sıralıdır (sorgu); uygun satırlar
 * süzülür (tür · yıl · son 30 gün dışı · doktrinde hukuki başlık), indeks = TR gün sırası mod havuz boyu. Başlığı kimlik
 * taramasına takılan aday atlanır (sıradakine geçilir). Durumsuz: havuz büyüdükçe kayma olur, nadir tekrar kabul.
 */
export function pickArchiveCandidate(pool: SocialArchiveRow[], kind: ArchiveKind, now: Date): string | null {
  const cutoff = archiveCutoff(now).getTime();
  const eligible = pool.filter(
    (r) =>
      r.kind === kind &&
      r.publishedAt.getUTCFullYear() >= ARCHIVE_MIN_YEAR[kind] &&
      r.createdAt.getTime() < cutoff &&
      (kind !== "doktrin" || isDoctrineArchiveWorthy(r.title)),
  );
  if (eligible.length === 0) return null;
  const start = trDayIndex(now) % eligible.length;
  for (let i = 0; i < eligible.length; i++) {
    const r = eligible[(start + i) % eligible.length];
    if (scanIdentity(r.title).length === 0) return r.id;
  }
  return null;
}

/**
 * İçtihatın kamuya giden özeti — HAM KARAR METNİ YERİNE sözlükten türeyen konu/dayanak satırı (🔒). Sözlük etiketleri ve
 * kanun maddesi atıfları kimlik taşıyamaz; hiçbiri bulunmazsa boş döner (özet yedeği devreye girer).
 */
export function ictihatTopicLine(text: string): string {
  const konu = extractKeywords(text, 3).map((k) => k.label).join(", ");
  const dayanak = extractLawRefs(text, 3).join(", ");
  return [konu && `Konu: ${konu}.`, dayanak && `Dayanak: ${dayanak}.`].filter(Boolean).join(" ");
}

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
  archive = false,
): SocialDigestItem {
  const branded = stream.key === "akademik" && isBrandedFor(a, rotation);
  // Özet BİR kez çözülür; teaser (160) ve hikâye açıklaması (400) aynı temiz metinden türer.
  // İçtihatta ham karar metni yerine konu/dayanak satırı (🔒 — akış değil SATIR türüne bakılır: donör olsa da geçerli).
  const decoded = decodeFeedText(a.summary);
  const summary = a.module === "mevzuat" && a.kind === "ictihat" ? ictihatTopicLine(decoded) : decoded;
  const long = buildSummaryLong({ summary, sourceName: decodeFeedText(a.sourceName), publishedAt: a.publishedAt });
  return {
    id: a.id,
    stream: stream.key,
    // Kart etiketi büyük harfle çizer ("ARŞİVDEN İÇTİHAT"); " · " ayırıcısı KULLANILMAZ — Reel altyazısı etiketleri " · " ile birleştirir.
    streamLabel: archive ? `Arşivden ${stream.label}` : stream.label,
    // Varlık temizliği BURADA da gerekli: bu uç NewsArticle satırını doğrudan okur, web akışının
    // toFeedItem dönüşümünden geçmez — decode olmadan "&#x2009;" sosyal medya gönderisine ham
    // giderdi. Kırpmadan ÖNCE çözülür: 160 karakterlik bütçe gerçek harfleri saymalı ve kırpma
    // bir varlığı ortadan bölmemeli ("… &#x20" gibi bozuk kuyruk).
    // Klinik araştırma faz öneki kanonik biçime gelir ("PHASE4 · …" / "FAZE 3 · …" → "Faz 4 · …" — lib/trial-phase):
    // kart LinkedIn/X'e gittiği için eski satırların ham ya da çeviride bozulmuş öneki bu sınırda düzeltilir.
    title: a.source === "clinicaltrials" ? normalizeTrialPhasePrefix(decodeFeedText(a.title)) : decodeFeedText(a.title),
    sourceName: a.sourceName,
    summary: trimSummary(summary, 160),
    summaryLong: long.text,
    summaryLongFallback: long.fallback,
    url: a.url,
    publishedAt: a.publishedAt.toISOString(),
    branch: branded ? { key: rotation.key, label: rotation.label } : null,
    replaces,
    stale,
    archive,
  };
}

/**
 * Seçkiyi kur — SAF fonksiyon (birim testli). Girdi createdAt-DESC sıralıdır (48 saatlik pencere,
 * route süzer); `now` tazelik eşiğinin referansıdır (koşu anı).
 *
 * İki geçiş:
 *  1) Birincil — akış başına tercih sırasındaki İLK TAZE aday (son SOCIAL_FRESH_MS içinde gelen).
 *     Tazesi olmayan akışın yuvası AÇIK kalır — hiç içeriği olmayan akış dahil (v6.336: altı yuva).
 *  2) Donör — açık yuvalar, o gün en çok taze başlık gelen akıştan (eşitlikte akış sırası; donör
 *     tükenince sıradaki) henüz kullanılmamış taze başlıkla dolar. Donör yoksa eski başlık
 *     `stale: true` ile kalır; eski başlığı da olmayan (boş) yuva düşer.
 * Birincil geçiş tamamen bitmeden donör geçişi başlamaz → donör hiçbir akışın kendi birincil
 * başlığını ÇALAMAZ (`used` kümesi).
 * 🗄️ Cephanelikli akış (İçtihat/Doktrin) açık yuvada önce `archive` adayını dener, sonra donörü; Mevzuat `stale` kalmaz.
 */
export function pickSocialDigest(
  articles: SocialArticle[],
  rotation: Branch,
  now: Date,
  archive: SocialArchive = {},
): SocialDigestItem[] {
  const freshSince = now.getTime() - SOCIAL_FRESH_MS;
  const isFresh = (a: SocialArticle) => a.createdAt.getTime() > freshSince;

  const slots: { stream: Stream; ordered: SocialArticle[]; pick: SocialArticle | null }[] = [];
  const used = new Set<string>();
  for (const s of STREAMS) {
    const pool = articles.filter(s.match);
    // Boş akış da yuva açar (v6.336) — donör geçişi doldurur; donör yoksa aşağıda düşer.
    const ordered = orderCandidates(s, pool, rotation);
    const pick = ordered.find(isFresh) ?? null;
    if (pick) used.add(pick.id);
    slots.push({ stream: s, ordered, pick });
  }

  // Donör sırası: SEKTÖREL İLK (📰 2026-10-26, 👤 karar — sektörel en hareketli akış, ikinci haberi hak ediyor), sonra
  // o gün en çok taze başlık gelen akış; Array.prototype.sort kararlıdır → eşitlikte STREAMS sırası korunur. Tazesi
  // olmayan akış (= açık yuvanın kendisi) donör olamaz. Kart altı yuvada kalır: sektörel ikinci haberini ancak açık
  // yuva varsa (çoğu gün Mevzuat) alır.
  const freshCount = new Map(STREAMS.map((s) => [s.key, articles.filter((a) => s.match(a) && isFresh(a)).length]));
  const donors = STREAMS
    .filter((s) => (freshCount.get(s.key) ?? 0) > 0)
    .sort((a, b) =>
      Number(b.key === "sektorel") - Number(a.key === "sektorel") ||
      (freshCount.get(b.key) ?? 0) - (freshCount.get(a.key) ?? 0));
  // Sektörelin ikinci haberi birincinin KARŞI kökeninden: biri yerli, biri uluslararası (yoksa aynı kökenden en taze).
  const sektorelPick = slots.find((s) => s.stream.key === "sektorel")?.pick ?? null;
  const donorOrder = (d: Stream) => {
    const ordered = orderCandidates(d, articles.filter(d.match), rotation);
    if (d.key !== "sektorel" || !sektorelPick) return ordered;
    const firstNative = isNativeTurkishSource(sektorelPick.source);
    return prioritize(ordered, (a) => isNativeTurkishSource(a.source) !== firstNative);
  };

  // Sektörel en çok BİR ek yuva alır (kartta toplam 2 sektörel — "1 yerine 2"); sonraki açık yuvalar eski sırayla dolar.
  let sektorelDonated = 0;
  const items: SocialDigestItem[] = [];
  for (const slot of slots) {
    if (slot.pick) {
      items.push(toItem(slot.pick, slot.stream, rotation, null, false));
      continue;
    }
    const fromArchive = slot.stream.archive ? archive[slot.stream.archive] : undefined;
    if (fromArchive && !used.has(fromArchive.id)) {
      used.add(fromArchive.id);
      items.push(toItem(fromArchive, slot.stream, rotation, null, false, true));
      continue;
    }
    let filled: SocialDigestItem | null = null;
    for (const d of donors) {
      if (d.key === "sektorel" && sektorelDonated >= 1) continue;
      const cand = donorOrder(d)
        .find((a) => isFresh(a) && !used.has(a.id));
      if (!cand) continue;
      used.add(cand.id);
      if (d.key === "sektorel") sektorelDonated++;
      filled = toItem(cand, d, rotation, { stream: slot.stream.key, streamLabel: slot.stream.label }, false);
      break;
    }
    if (filled) items.push(filled);
    else if (slot.ordered.length > 0 && slot.stream.staleOk !== false) items.push(toItem(slot.ordered[0], slot.stream, rotation, null, true));
    // else: boş akış + donör yok → yuva düşer (gösterilecek gerçek başlık yok)
  }
  return items;
}
