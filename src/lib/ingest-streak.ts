// İçerik hattı "sessiz kuruma" nöbeti — v6.337 (2026-10-07, 👤 "hata metnini görünür yap").
//
// Neden var: Yargıtay içtihat cron'u 11 Ağustos'tan beri neredeyse her koşuda İLK aramada hata verip
// `yeni=0/0 sorun=1` yazdı; yedi hafta fark edilmedi, çünkü (1) audit satırı hatanın yalnız SAYISINI
// tutuyordu, metnini değil; (2) arama hatası iş-çöküşü sayılmadığı için alarm hiç tetiklenmedi.
// Bu modül iki boşluğu kapatır — SAF yardımcılar (birim testli), rota yalnız çağırır:
//   · `firstErrorTag`: ilk hatanın kısa metni audit `detail`'ine girer (teşhis tahminle değil ölçümle).
//   · `dryStreak` + `shouldAlertStreak`: art arda N koşu "hiçbir şey bulunamadı + hata" ise alarm.
//
// DURUMSUZ: seri ayrı tabloda tutulmaz — son audit satırları (`CRON_MAINTENANCE`/ingest-hukuk) okunur.
// Kalıp eski satırlarla UYUMLUDUR ("ictihat yeni=0/0 sorun=1" v6.86'dan beri aynı) → ilk koşuda geçmiş
// seri de sayılır. Alarm e-postası üretimde AÇIK (lib/alerts) → her gün değil, eşikte bir kez + haftalık
// hatırlatma (gürültü kör ediciydi, sessizlik de).
//
// Asla-loglama listesi (lib/alerts başlığı): hata metinleri arama ibaresi (sabit anahtar kelime sözlüğü),
// karar/yayın KİMLİĞİ ve HTTP/ağ hata kodu taşır — kişisel/sağlık verisi YOK.

/** Audit `detail`'i içinde bir işin segment adı (rota "ictihat … · doktrin … · ttb …" biçiminde yazar). */
export type IngestSegment = "ictihat" | "doktrin";

/** Alarm eşiği: bu kadar ARDIŞIK kuru koşu (bugün dahil). Günlük kadansta = 3 gün. */
export const DRY_STREAK_THRESHOLD = 3;
/** Seri sürerken hatırlatma aralığı (koşu sayısı; günlük kadansta haftalık). */
export const DRY_STREAK_REMIND_EVERY = 7;

const ERROR_TAG_MAX = 120;
const CAUSE_MAX = 60;

/**
 * Hata metni + ASIL neden (v6.341, 2026-10-08). Node `fetch` (undici) ağ katmanı hatalarını hep aynı genel
 * mesajla verir ("fetch failed"); bağlantı reddi / sıfırlama / zaman aşımı / DNS ayrımı yalnız `error.cause`
 * içindedir (`code`: ECONNRESET · ECONNREFUSED · UND_ERR_CONNECT_TIMEOUT · ENOTFOUND …). v6.337'nin ilk
 * ölçümü (08.10 05:20) yalnız `arama 'malpraktis': fetch failed` gördü → teşhis bir adım eksik kaldı.
 * Biçim: `<mesaj> [<cause.code | cause.message>]`; nedensiz hata aynen döner. En çok 140 karakter.
 */
export function describeError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const cause = e instanceof Error ? (e as Error & { cause?: unknown }).cause : undefined;
  let tag = "";
  if (cause && typeof cause === "object") {
    const c = cause as { code?: unknown; message?: unknown };
    const raw = typeof c.code === "string" && c.code ? c.code : typeof c.message === "string" ? c.message : "";
    if (raw) tag = ` [${raw.replace(/\s+/g, " ").trim().slice(0, CAUSE_MAX)}]`;
  } else if (typeof cause === "string" && cause) {
    tag = ` [${cause.slice(0, CAUSE_MAX)}]`;
  }
  return (msg + tag).slice(0, 140);
}

/**
 * İlk hatanın kısa, tek satırlık etiketi: ` ilk="HTTP 403"` — hata yoksa boş dize.
 * Ayraç " · " ve çift tırnak metinden ayıklanır ki `detail` segmentleri bölünebilir kalsın.
 */
export function firstErrorTag(errors: readonly string[]): string {
  const first = errors.find((e) => e.trim().length > 0);
  if (!first) return "";
  const clean = first.replace(/\s+/g, " ").replace(/·/g, "-").replace(/"/g, "'").trim().slice(0, ERROR_TAG_MAX);
  return ` ilk="${clean}"`;
}

/**
 * Bir audit `detail`'inde segment KURU mu: iş tamamen çöktü (`hata:`) ya da hiçbir şey bulamayıp hata
 * verdi (`yeni=0/0 sorun=N`). Hatasız "0/0" kuru SAYILMAZ (kaynak gerçekten boş olabilir — alarm hatayı
 * hedefler); segment hiç yoksa da kuru değildir (eski biçimli/ilgisiz satır seriyi KESER).
 */
export function isDrySegment(detail: string | null | undefined, segment: IngestSegment): boolean {
  if (!detail) return false;
  const part = detail.split(" · ").find((p) => p.startsWith(`${segment} `));
  if (!part) return false;
  return part.startsWith(`${segment} hata:`) || new RegExp(`^${segment} yeni=0/0 sorun=[1-9]`).test(part);
}

/** En yeniden eskiye sıralı `detail` dizisinde (bugünkü koşu dahil) baştan kaç ardışık kuru koşu var. */
export function dryStreak(detailsNewestFirst: readonly (string | null)[], segment: IngestSegment): number {
  let n = 0;
  for (const d of detailsNewestFirst) {
    if (!isDrySegment(d, segment)) break;
    n++;
  }
  return n;
}

/** Eşiğe ilk ulaşıldığı koşuda + sonra her DRY_STREAK_REMIND_EVERY koşuda bir alarm. */
export function shouldAlertStreak(streak: number): boolean {
  if (streak < DRY_STREAK_THRESHOLD) return false;
  return (streak - DRY_STREAK_THRESHOLD) % DRY_STREAK_REMIND_EVERY === 0;
}

// ── v6.343 (2026-10-10, 👤 "tazelik nöbetçisine çevir") — Yargıtay içtihadı YEREL beslenir ──────────────────────
// Kök neden (10.10 ölçüldü): karararama.yargitay.gov.tr yurt dışı / veri merkezi IP'lerini TCP düzeyinde engelliyor —
// Türkiye bağlantısı 200 · Hetzner DE 25 sn zaman aşımı · Vercel fra1 "fetch failed" (11.08'den beri). Bu yüzden
// cron artık karar ÇEKMEZ; kararları kullanıcının bilgisayarındaki haftalık görev yazar (`scripts/ingest-yargitay.ts
// --prod --yaz`) ve her yazma koşusunda bir NABIZ satırı bırakır. Cron yalnız "son TAM tarama ne zaman?" diye bakar.
//
// Ölçü neden "son yeni karar" DEĞİL: Yargıtay bir hafta ilgili karar yayımlamayabilir → yeni karar tarihi ilerlemez
// ama besleme sağlamdır (yanlış alarm). Ölçü = son TAM tarama nabzı; nabız henüz yoksa (geçiş dönemi) son yazılan
// karar yedek kanıttır. Yarım tarama (arama 429/CAPTCHA/ağ hatasında kütüphane kalan sorguları bilinçli bırakır)
// nabız sayılmaz — kuruma yine görünür olsun.

/** Yerel besleme nabzının audit `resourceId`'si (`CRON_MAINTENANCE`, actor null). */
export const ICTIHAT_LOCAL_RESOURCE = "ingest-yargitay-yerel";
/** Son tam taramadan bu kadar gün sonra alarm (haftalık görev = iki kaçırılmış hafta). */
export const ICTIHAT_STALE_DAYS = 14;
/** Bayatlık sürerken hatırlatma aralığı (gün; günlük cron'da haftalık). */
export const ICTIHAT_STALE_REMIND_EVERY = 7;

const DAY_MS = 86_400_000;

/** Arama aşaması TAM mı: kütüphane arama hatasını `arama "<sorgu>": …` biçiminde yazar ve kalan sorguları bırakır. */
export function isSearchComplete(errors: readonly string[]): boolean {
  return !errors.some((e) => e.startsWith("arama "));
}

/** Yerel besleme nabzının audit `detail`'i: `yerel yeni=4/102 sorun=2 ilk="…" tarama=yarim`. */
export function localFeedDetail(r: { created: number; found: number; deferred: number; errors: readonly string[] }): string {
  const erteli = r.deferred ? ` erteli=${r.deferred}` : "";
  const sorun = r.errors.length ? ` sorun=${r.errors.length}${firstErrorTag(r.errors)}` : "";
  return `yerel yeni=${r.created}/${r.found}${erteli}${sorun} tarama=${isSearchComplete(r.errors) ? "tam" : "yarim"}`;
}

/** Nabız satırı TAM bir taramayı mı kaydediyor. */
export function isFullLocalScan(detail: string | null | undefined): boolean {
  return !!detail && /(^| )tarama=tam( |$)/.test(detail);
}

/** İki kanıttan yenisi (biri ya da ikisi yoksa olanı; hiçbiri yoksa null). */
export function latestEvidence(...dates: readonly (Date | null | undefined)[]): Date | null {
  let best: Date | null = null;
  for (const d of dates) if (d && (!best || d.getTime() > best.getTime())) best = d;
  return best;
}

/** Tam gün cinsinden yaş (aşağı yuvarlanır); kanıt yoksa null. Gelecek tarih 0 sayılır. */
export function ageInDays(evidence: Date | null, now: Date): number | null {
  if (!evidence) return null;
  return Math.max(0, Math.floor((now.getTime() - evidence.getTime()) / DAY_MS));
}

/**
 * Bayatlık alarmı: eşik gününde bir kez + sonra her ICTIHAT_STALE_REMIND_EVERY günde bir (günlük cron).
 * Kanıt HİÇ yoksa (tablo boş — üretimde beklenmez) her koşu alarm: sessizlik burada en kötü sonuçtur.
 */
export function shouldAlertStale(ageDays: number | null): boolean {
  if (ageDays === null) return true;
  if (ageDays < ICTIHAT_STALE_DAYS) return false;
  return (ageDays - ICTIHAT_STALE_DAYS) % ICTIHAT_STALE_REMIND_EVERY === 0;
}

/** Cron audit segmenti: `tazelik son=2026-10-10 (3 gun)` · `tazelik son=yok`. (UTC gün; ASCII — segment ayracı korunur.) */
export function freshnessLine(evidence: Date | null, ageDays: number | null): string {
  if (!evidence || ageDays === null) return "tazelik son=yok";
  return `tazelik son=${evidence.toISOString().slice(0, 10)} (${ageDays} gun)`;
}
