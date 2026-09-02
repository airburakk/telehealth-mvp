// Doctorium Post — günlük özet ("sabah gazetesi") üretimi (2026-08-24).
// Tasarım: vault output/doctorium-gunluk-ozet-tasarimi-2026-08-24.md.
//
// Akış: daily-digest cron'u (06:30 TR; v6.204 — içerik cron'ları 05:00/05:20 TR'de ÖNCE biter, sıra
// zamanlamayla korunur, cron-routes sözleşme testi kilitler) runDailyDigests()'i çağırır →
// abone (Doctor.digestChannel dolu) her doktor için kişisel akıştan (personalFeedPage —
// Özelleştir tercihleri + createdSince) o günkü baskı derlenir → DailyDigest satırı (anlık
// görüntü) + uygulama içi bildirim → kanal "email" ise Resend'e teslim (dormant'ken simülasyon).
//
// İçerik kuralları (tasarım belgesi §4):
//  · Bölümlü gazete — interleave YOK; bölüm başına en fazla MAX_PER_SECTION başlık.
//  · Sponsorlu içerik / anket / puan duyurusu GİRMEZ (pazarlama rejimi tetiklenmesin — ⚖️).
//  · Telif çizgisi: başlık + kaynak + KISA özet + link; tam metin taşınmaz.
//  · Boş gün = baskı YOK (satır yazılmaz, bildirim/e-posta gitmez — boş gazete güven öldürür).
//
// PHI: baskı içeriği haber/mevzuat metadata'sıdır — PHI DEĞİL; e-postaya içerik gömmek bu
// yüzden serbesttir (hasta dürtülerinin "içeriksiz e-posta" kuralı BURAYA uygulanmaz; o kural
// klinik bildirimler içindir — lib/notify.ts routePatientChannel).
import { randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import {
  effectiveBranches, parseFeedModules, personalFeedPage, trDayStart,
  type FeedItem,
} from "./doctorium";
import { notifyDoctorById } from "./notify";
import { sendEmail } from "./email";
import { DOCTORIUM_CANONICAL_URL } from "./brand";
import { renderDigestEmailHtml, renderDigestEmailText } from "./digest-email";

/** Ürün-yüzü adı (kullanıcı kararı 2026-08-24). Tek nokta — masthead/bildirim/tercih hep buradan. */
export const DIGEST_NAME = "Doctorium Post";

export const DIGEST_PATH = "/doktor/doctorium/ozet";

/** İlgi alanı (bölüm) başına başlık tavanı — 🔒 kullanıcı kuralı (2026-08-25): seçilen HER ilgi
 *  alanından EN FAZLA 2 içerik; 1 alan seçen 2, 6 alan seçen 12 başlık görür. Gazete boyu doktorun
 *  kendi seçiminin aynasıdır (v6.159'daki 5'lik tavanı süpersede eder). */
export const MAX_PER_SECTION = 2;

/** Özet kısaltma tavanı (karakter) — telif çizgisi "kısa özet + link" (tam metin taşınmaz). */
const SUMMARY_MAX = 220;

/** Uzun aradan sonra baskı taşmasın: pencere en fazla 72 saat geriye gider (tasarım §3). */
const WINDOW_CAP_MS = 72 * 3_600_000;
const WINDOW_FALLBACK_MS = 24 * 3_600_000; // ilk baskı: son 24 saat

export interface DigestItem {
  id: string;
  title: string;
  sourceName: string;
  url: string | null;
  summary: string;
  kind: string;
  publishedAt: string; // ISO — JSON anlık görüntüde Date taşınmaz
}

export interface DigestSection {
  key: string;
  label: string;
  items: DigestItem[];
}

export interface DigestSnapshot {
  sections: DigestSection[];
  /** Tavanlar yüzünden baskıya girmeyen başlık sayısı — "portalda N başlık daha" satırı. */
  overflow: number;
}

/** Gazete bölümleri = tercihlerdeki İLGİ ALANLARI birebir (2026-08-25 — kullanıcı kuralı
 *  "alan başına 2" ancak böyle tutar: v6.159'un birleşik "Hukuk" bölümü İçtihat+Doktrin'i tek
 *  tavana sıkıştırıyordu; iki alan seçen doktor 4 yerine 2 görürdü). Altı içerik alanı = tercihler
 *  sayfasındaki altı akış anahtarı (etkinlik/kariyer akış içeriği değildir, baskıya girmez).
 *  FeedItem.module=mevzuat üç alana kind ile ayrılır. Hukuk ailesi sonda ve bir arada. */
const SECTIONS: { key: string; label: string; match: (it: FeedItem) => boolean }[] = [
  { key: "akademik", label: "Akademik", match: (it) => it.module === "akademik" },
  { key: "ilac", label: "İlaç & Cihaz", match: (it) => it.module === "ilac" },
  { key: "sektorel", label: "Sektörel", match: (it) => it.module === "sektorel" },
  { key: "mevzuat", label: "Mevzuat", match: (it) => it.module === "mevzuat" && it.kind === "mevzuat" },
  { key: "ictihat", label: "İçtihat", match: (it) => it.module === "mevzuat" && it.kind === "ictihat" },
  { key: "doktrin", label: "Doktrin", match: (it) => it.module === "mevzuat" && it.kind === "doktrin" },
];

/** Özet metnini tek satıra indirip kelime sınırında kısaltır (telif: kısa özet + link). */
export function trimSummary(raw: string, max = SUMMARY_MAX): string {
  const flat = raw.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max).trimEnd()}…`;
}

/**
 * Akış öğelerinden gazete bölümlerini kurar — SAF fonksiyon (birim testli).
 * Girdi personalFeedPage çıktısıdır (tarihçe-sıralı); bölüm içinde bu sıra korunur.
 */
export function buildDigestSections(items: FeedItem[]): DigestSnapshot {
  let overflow = 0;
  const sections: DigestSection[] = [];
  for (const s of SECTIONS) {
    const matched = items.filter(s.match);
    if (matched.length === 0) continue;
    overflow += Math.max(0, matched.length - MAX_PER_SECTION);
    sections.push({
      key: s.key,
      label: s.label,
      items: matched.slice(0, MAX_PER_SECTION).map((it) => ({
        id: it.id,
        title: it.title,
        sourceName: it.sourceName,
        url: it.url,
        summary: trimSummary(it.summary),
        kind: it.kind,
        publishedAt: it.publishedAt.toISOString(),
      })),
    });
  }
  return { sections, overflow };
}

/** TR gününün "YYYY-MM-DD" etiketi — DailyDigest.day idempotens anahtarı. */
export function trDayString(d: Date = trDayStart()): string {
  const tr = new Date(d.getTime() + 3 * 3_600_000); // trDayStart UTC döner; TR takvim günü için ileri al
  return tr.toISOString().slice(0, 10);
}

// ── Tek-tık e-posta çıkışı (RFC 8058) ────────────────────────────────────────────────────────
// Oturum gerektirmez (e-posta istemcisi çıplak POST atar; RFC 8058). Çıkış digestChannel'ı null'a
// çeker (TAM kapanış — tasarım §5.2 kararı: "e-postayı kes ama uygulamada dürt" sürprizi olmasın;
// doktor tercihler sayfasından istediği an yeniden açar).
//
// 🔄 v6.198 — TOKEN ARTIK TÜRETİLMİYOR, DOKTOR SATIRINDA DURUYOR (`Doctor.digestUnsubToken`).
// Önce `HMAC(SESSION_SECRET, doctorId)` idi; bülten AURA projesinden gönderilip bağlantı
// doctorium.tr'de doğrulandığı için iki Vercel projesinin sırrının AYNI olmasını gerektiriyordu.
// 2026-09-02'de ÖLÇÜLDÜ: sırlar FARKLI → çıkış bağlantısı 403 verirdi. Veritabanı iki marka
// arasında zaten ORTAK olduğundan token'ı oraya taşımak bu bağımlılığı tamamen kaldırır.

/** Sabit-zamanlı token karşılaştırması (saf — birim testlenebilir). Saklı token yoksa DAİMA false. */
export function unsubTokensMatch(stored: string | null, given: string): boolean {
  if (!stored || !given || stored.length !== given.length) return false;
  try {
    return timingSafeEqual(Buffer.from(stored), Buffer.from(given));
  } catch {
    return false;
  }
}

/**
 * Doktorun kalıcı çıkış anahtarını döndürür; yoksa üretip SAKLAR (tembel).
 * Kalıcıdır — yeniden üretilseydi daha önce gönderilmiş e-postalardaki bağlantılar ölürdü.
 */
export async function ensureDigestUnsubToken(doctorId: string, existing: string | null): Promise<string> {
  if (existing) return existing;
  const token = randomBytes(24).toString("hex");
  await db.doctor.update({ where: { id: doctorId }, data: { digestUnsubToken: token } });
  return token;
}

/** Çıkış bağlantısının doğrulanması — DB'deki tokenla karşılaştırır (oturum aranmaz). */
export async function verifyDigestUnsubToken(doctorId: string, token: string): Promise<boolean> {
  if (!doctorId || !token) return false;
  const d = await db.doctor.findUnique({ where: { id: doctorId }, select: { digestUnsubToken: true } });
  return unsubTokensMatch(d?.digestUnsubToken ?? null, token);
}

/**
 * Bülten bağlantılarının TABANI — `SITE_URL` DEĞİL, Doctorium'un kanonik kökü (v6.197).
 *
 * NEDEN: bu cron AURA projesinde koşar (Doctorium deploy'unda `BRAND_MODE` ile no-op) ve
 * `SITE_URL` orada `telehealth-mvp-roan.vercel.app`tır. Taban SITE_URL kalsaydı **Doctorium
 * markalı bültenin** portal ve abonelikten-çıkış bağlantıları AURA host'una giderdi — okuyucu
 * başka bir markanın alan adına düşerdi. Bültenin markası gönderen projeye göre değişmez.
 *
 * İki hedef de doctorium.tr'de GERÇEKTEN servis edilir (ölçüldü 2026-09-02): `/doktor` ve `/api`
 * `AURA_ONLY_PREFIXES`te değil — `/doktor/doctorium/ozet` Doctorium giriş kapısına 307'ler,
 * `/api/digest/unsubscribe` 403 (parametresiz) döner; ikisi de AURA'ya YÖNLENMEZ.
 *
 * ✅ SIR PARİTESİ ARTIK GEREKMİYOR (v6.198): çıkış token'ı `SESSION_SECRET`ten türetilmiyor,
 * doktor satırında duruyor (`Doctor.digestUnsubToken`) ve veritabanı iki marka arasında ORTAK.
 * Bir zamanlar gerekiyordu ve 2026-09-02 ölçümünde sırların FARKLI olduğu görüldü — bağımlılık
 * kaldırılmasaydı ilk bültenin çıkış bağlantısı 403 verecekti.
 */
const DIGEST_LINK_BASE = DOCTORIUM_CANONICAL_URL;

/** Token ÇAĞIRANDAN gelir (ensureDigestUnsubToken) — bu fonksiyon saf kalsın diye DB okumaz. */
export function digestUnsubUrl(doctorId: string, token: string): string {
  return `${DIGEST_LINK_BASE}/api/digest/unsubscribe?d=${encodeURIComponent(doctorId)}&t=${encodeURIComponent(token)}`;
}

// ── Günlük koşu ──────────────────────────────────────────────────────────────────────────────

export interface DigestRunResult {
  checked: number;       // abone doktor sayısı
  produced: number;      // baskı üretilen
  emailed: number;       // Resend'e GERÇEKTEN giden
  emailSimulated: number; // dormant simülasyon izi (anahtar yok)
  skippedEmpty: number;  // o gün içeriği boş — baskı yok
  skippedDone: number;   // bugünkü baskı zaten var (idempotens)
  failed: number;
}

export async function runDailyDigests(): Promise<DigestRunResult> {
  const res: DigestRunResult = {
    checked: 0, produced: 0, emailed: 0, emailSimulated: 0,
    skippedEmpty: 0, skippedDone: 0, failed: 0,
  };
  const subscribers = await db.doctor.findMany({
    where: { digestChannel: { in: ["app", "email"] } },
    // digestUnsubToken (v6.198): çıkış anahtarı satırda durur; yoksa e-posta basılırken üretilir.
    select: { id: true, name: true, branch: true, newsBranches: true, feedModules: true, digestChannel: true, digestUnsubToken: true },
  });
  res.checked = subscribers.length;
  if (!subscribers.length) return res;

  const day = trDayString();
  const now = Date.now();

  for (const d of subscribers) {
    try {
      // İdempotens: doktor+gün başına tek baskı — cron yeniden koşarsa ikinci e-posta gitmez.
      const existing = await db.dailyDigest.findUnique({
        where: { doctorId_day: { doctorId: d.id, day } }, select: { id: true },
      });
      if (existing) { res.skippedDone++; continue; }

      // Pencere: son baskıdan beri (boş günler kendiliğinden bir sonraki pencereye devrolur —
      // satır yazılmadığı için `last` eski kalır); tavan 72 saat, ilk baskı 24 saat.
      const last = await db.dailyDigest.findFirst({
        where: { doctorId: d.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true },
      });
      const since = new Date(Math.max(
        last ? last.createdAt.getTime() : now - WINDOW_FALLBACK_MS,
        now - WINDOW_CAP_MS,
      ));

      const branches = effectiveBranches(d.newsBranches, d.branch);
      const modules = parseFeedModules(d.feedModules);
      const { items } = await personalFeedPage(branches, modules, {}, 60, { createdSince: since });
      const snapshot = buildDigestSections(items);
      const shown = snapshot.sections.reduce((n, s) => n + s.items.length, 0);
      if (shown === 0) { res.skippedEmpty++; continue; }

      await db.dailyDigest.create({
        data: { doctorId: d.id, day, itemsJson: JSON.stringify(snapshot), itemCount: shown },
      });
      res.produced++;

      await notifyDoctorById(d.id, {
        type: "DAILY_DIGEST",
        title: `${DIGEST_NAME} hazır — ${shown} başlık`,
        body: snapshot.sections.map((s) => `${s.label} ${s.items.length}`).join(" · "),
        href: DIGEST_PATH,
      });

      if (d.digestChannel === "email") {
        // Alıcı: doktorun kullanıcı hesabı. Doğrulanmamış adrese bülten gönderilmez
        // (teslimat hijyeni — hasta dürtüsüyle aynı çizgi).
        const u = await db.user.findFirst({
          where: { role: "DOCTOR", doctorId: d.id, deletedAt: null },
          select: { email: true, emailVerifiedAt: true },
        });
        if (u?.email && u.emailVerifiedAt) {
          // Anahtar YALNIZ e-posta gerçekten basılırken üretilir (app-only aboneye yazma yapılmaz).
          const unsubUrl = digestUnsubUrl(d.id, await ensureDigestUnsubToken(d.id, d.digestUnsubToken));
          const args = {
            doctorName: d.name,
            day,
            sections: snapshot.sections,
            overflow: snapshot.overflow,
            portalUrl: `${DIGEST_LINK_BASE}${DIGEST_PATH}`,
            unsubUrl,
          };
          const sent = await sendEmail({
            to: u.email,
            subject: `${DIGEST_NAME} · ${formatTrDate(day)}`,
            text: renderDigestEmailText(args),
            html: renderDigestEmailHtml(args),
            // RFC 8058 tek-tık çıkış — Gmail/Yahoo bülten şartı (başlık ŞART, gövde linki yetmez).
            headers: {
              "List-Unsubscribe": `<${unsubUrl}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          });
          if (sent.sent) {
            res.emailed++;
            await db.dailyDigest.update({
              where: { doctorId_day: { doctorId: d.id, day } },
              data: { emailedAt: new Date() },
            });
          } else if (sent.simulated) {
            res.emailSimulated++;
          }
        }
      }
    } catch (e) {
      res.failed++;
      console.warn(`[digest] baskı üretilemedi (doktor ${d.id}):`, e instanceof Error ? e.message : e);
    }
  }
  return res;
}

/** "2026-08-24" → "24 Ağustos 2026" — e-posta konu satırı + masthead tarih satırı. */
export function formatTrDate(day: string): string {
  const [y, m, dd] = day.split("-").map(Number);
  const months = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  if (!y || !m || !dd || m < 1 || m > 12) return day;
  return `${dd} ${months[m - 1]} ${y}`;
}
