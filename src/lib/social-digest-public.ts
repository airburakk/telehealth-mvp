// Herkese açık "Günlük Seçki" sayfasının (doctorium.tr/secki) veri katmanı — v6.315 (2026-10-02, 👤 "bio'daki seçki sayfasını yapalım").
//
// Neden var: Reels/hikâye/altyazılar "Detaylar bio'daki bağlantıda" der; Instagram'da tıklanabilir link YOKTUR (API'de parametre yok,
// uygulamada ücretli Meta Verified'a bağlı) → okurun her habere ulaşacağı tek yer bio'daki kararlı bir sayfadır. Bu modül o sayfanın
// verisini üretir; `/api/social-digest` (n8n kartının kaynağı, Bearer'lı) ile AYNI seçki kuralını (`pickSocialDigest`) ve AYNI sorguyu
// kullanır — ikisi ayrışırsa sayfa ile sabah kartı farklı başlık gösterir.
//
// 🔑 SABİT AN (anchor): sosyal kart 07:45 TR'de üretilir ve o günün seçkisini yayınlar. `pickSocialDigest` ise koşu anına göre "taze"
// (son 24 saatte akışa düşen) ayıklar; sayfayı her istekte `now` ile hesaplasak öğleden sonra FARKLI başlıklar çıkardı (sabah kartı ≠ sayfa).
// Çözüm: sayfa kartın üretildiği ANI yeniden kurar — son 07:45 TR (= 04:45 UTC; Türkiye'de yaz saati yok) ≤ now. Hem `now` yerine bu an
// kullanılır hem anchor SONRASI ingest edilen satırlar dışlanır (createdAt ≤ anchor). 07:45'ten önce açılan sayfa DÜNKÜ seçkiyi gösterir
// (o sabahın kartı henüz çıkmadı). Anchor saati değişirse (n8n zamanlaması) YALNIZ buradaki sabit güncellenir.
import { db } from "@/lib/db";
import { trDayString } from "./daily-digest";
import {
  ARCHIVE_MIN_YEAR,
  archiveCutoff,
  pickArchiveCandidate,
  pickSocialDigest,
  rotationBranchFor,
  SOCIAL_WINDOW_MS,
  type SocialArchive,
  type SocialDigestItem,
} from "./social-digest";

/** 07:45 TR = 04:45 UTC (n8n "Sabah Bülteni" tetiği). */
export const SOCIAL_ANCHOR_UTC = { hour: 4, minute: 45 } as const;

/** now'dan önceki (veya eşit) en son anchor anı. SAF. */
export function socialDigestAnchor(now: Date): Date {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), SOCIAL_ANCHOR_UTC.hour, SOCIAL_ANCHOR_UTC.minute, 0, 0);
  return new Date(today <= now.getTime() ? today : today - 86_400_000);
}

/** `/api/social-digest` ile ORTAK select — iki yüzey tek şekil okur (SocialArticle arayüzüyle bire bir). */
const SOCIAL_ARTICLE_SELECT = {
  id: true, source: true, module: true, kind: true, title: true, sourceName: true,
  summary: true, url: true, branchSlugs: true, publishedAt: true, createdAt: true,
} as const;

/**
 * Seçki penceresindeki makaleler, createdAt DESC + ikincil id (tek-alanlı orderBy tuzağı — prisma-cursor-sayfalama dersi).
 * `to` verilirse üst sınır (sayfa için anchor); verilmezse sınırsız (API: gerçek koşu anı).
 */
export function loadSocialArticles(from: Date, to?: Date) {
  return db.newsArticle.findMany({
    where: { createdAt: to ? { gte: from, lte: to } : { gte: from } },
    select: SOCIAL_ARTICLE_SELECT,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 500,
  });
}

/**
 * 🗄️ Hukuk cephaneliği (2026-10-26): günün İçtihat/Doktrin arşiv adayı. İki adım — havuz HAFİF okunur (karar metni `summary`
 * yüzlerce satırda MB'larca tutar), seçim saf `pickArchiveCandidate`'te yapılır, yalnız seçilen ≤2 satırın tamamı okunur.
 * FAIL-SOFT: hata → boş cephanelik (yuva eskisi gibi donörden dolar); sabah kartı cephanelik yüzünden düşmez.
 */
export async function loadSocialArchive(now: Date): Promise<SocialArchive> {
  try {
    const pool = await db.newsArticle.findMany({
      where: {
        module: "mevzuat",
        createdAt: { lt: archiveCutoff(now) },
        OR: [
          { kind: "ictihat", publishedAt: { gte: new Date(Date.UTC(ARCHIVE_MIN_YEAR.ictihat, 0, 1)) } },
          { kind: "doktrin", publishedAt: { gte: new Date(Date.UTC(ARCHIVE_MIN_YEAR.doktrin, 0, 1)) } },
        ],
      },
      select: { id: true, kind: true, title: true, publishedAt: true, createdAt: true },
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      take: 3000,
    });
    const ids = (["ictihat", "doktrin"] as const)
      .map((k) => pickArchiveCandidate(pool, k, now))
      .filter((id): id is string => id !== null);
    if (ids.length === 0) return {};
    const rows = await db.newsArticle.findMany({ where: { id: { in: ids } }, select: SOCIAL_ARTICLE_SELECT });
    const out: SocialArchive = {};
    for (const r of rows) if (r.kind === "ictihat" || r.kind === "doktrin") out[r.kind] = r;
    return out;
  } catch {
    return {};
  }
}

export interface PublicDigest {
  /** Seçkinin TR gün etiketi ("2026-10-02") — anchor'un günü. */
  day: string;
  rotation: { key: string; label: string };
  items: SocialDigestItem[];
}

/**
 * Sayfanın seçkisi. Boş gün → `items: []` (sayfa "henüz hazır değil" der; sahte/örnek içerik GÖSTERİLMEZ).
 * DB hatası bir kez yeniden denenir (Neon soğuk başlangıcı); ikinci hata ÇAĞIRANA fırlar — sayfa kendi hata durumunu çizer.
 */
export async function loadPublicDigest(now: Date = new Date()): Promise<PublicDigest> {
  const anchor = socialDigestAnchor(now);
  const day = trDayString(anchor);
  const rotation = rotationBranchFor(day);
  const from = new Date(anchor.getTime() - SOCIAL_WINDOW_MS);
  let articles;
  try {
    articles = await loadSocialArticles(from, anchor);
  } catch {
    await new Promise((r) => setTimeout(r, 400));
    articles = await loadSocialArticles(from, anchor);
  }
  // Cephanelik de ANCHOR'a göre seçilir (gün tabanlı) → sayfa sabah kartıyla aynı arşiv başlığını gösterir.
  const archive = await loadSocialArchive(anchor);
  return {
    day,
    rotation: { key: rotation.key, label: rotation.label },
    items: pickSocialDigest(articles, rotation, anchor, archive),
  };
}
