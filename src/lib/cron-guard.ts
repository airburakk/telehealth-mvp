import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

// Cron rotalarının ORTAK KAPISI (v6.204, 2026-09-02) — bakım nöbeti altı cron'a bölünürken
// (kullanıcı kararı "bölelim"; Vercel planı Pro, cron kısıtı kalktı) iki korkuluk tek yere alındı:
//
//  1) Ayrışma Faz A (2026-08-24): vercel.json cron'ları HER İKİ Vercel projesinde de kayıt olur
//     (aynı repo). Cron'lar YALNIZ AURA projesinde koşar — ortak DB'de çift koşum / çift
//     hatırlatma / çift baskı olmasın. Doctorium deploy'unda (BRAND_MODE=doctorium) no-op.
//  2) CRON_SECRET Bearer'ı: Vercel, env tanımlıysa cron isteğine `Authorization: Bearer <sır>`
//     ekler; elle tetikleme de aynı başlığı ister (anonim tetiklenemez — dış siteye istek fırlatma
//     yüzeyi olmasın). Env yoksa 503 (site etkilenmez, cron devre dışı). Karşılaştırma sabit-zamanlı
//     (social-digest deseni) — eski `!==` kıyası zaman kanalına açıktı.
//
// Bu modül BİLİNÇLİ olarak db/audit içe aktarmaz: saf kalır, birim testi hafif olur
// (tests/unit/cron-guard.test.ts). Koşu izini (audit CRON_MAINTENANCE satırı) rotalar kendisi yazar.

/** Kapı: null → geç; NextResponse → onu döndür (skipped / 503 / 401). */
export function cronGate(req: Request, label: string): NextResponse | null {
  if (process.env.BRAND_MODE === "doctorium") {
    return NextResponse.json({ skipped: `doctorium-deploy — ${label} cron'u AURA projesinde koşar` });
  }
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET tanımlı değil — cron devre dışı." }, { status: 503 });
  }
  const given = req.headers.get("authorization") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(`Bearer ${secret}`);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  return null;
}

/** Hata metni (yanıt/audit için kısa): Error → mesajın ilk 120 karakteri; başka şey → fallback. */
export function errText(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message.slice(0, 120) : fallback;
}

/**
 * Cron zamanlaması (vercel.json ile BİREBİR — tests/unit/cron-routes.test.ts sözleşmesi).
 * UTC; TR = UTC+3. Sıra bilinçli: içerik cron'ları Post baskısından (daily-digest) ÖNCE biter ki
 * "sabah gazetesi" o gecenin içeriğini görsün; hasta hatırlatması insanca saatte (10:00 TR).
 */
export const CRON_SCHEDULES: Record<string, string> = {
  "/api/cron/ingest-doctorium": "0 2 * * *",         // 05:00 TR — akademik + haber (PubMed/EPMC/DOAJ/RSS/…)
  "/api/cron/ingest-hukuk": "20 2 * * *",            // 05:20 TR — Yargıtay + Doktrin + TTB (Pazartesi)
  "/api/cron/registry-sync": "0 3 * * *",            // 06:00 TR — HealthTürkiye dizini (değişmedi)
  "/api/cron/purge-deleted": "30 3 * * *",           // 06:30 TR — KVKK imha + zincirler + günlük damga + diploma süpürmesi
  "/api/cron/daily-digest": "30 3 * * *",            // 06:30 TR — Doctorium Post + etkinlik alarmı
  "/api/cron/pending-docs-reminders": "0 7 * * *",   // 10:00 TR — DOCS_PENDING hasta hatırlatması
};
