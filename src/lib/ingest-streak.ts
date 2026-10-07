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
