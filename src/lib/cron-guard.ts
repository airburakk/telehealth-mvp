import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

// Cron rotalarının ORTAK KAPISI (v6.205, 2026-09-02) — bakım nöbeti altı cron'a bölünürken (v6.206: yedinci, translate-news)
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
 * UTC; TR = UTC+3. Sıra bilinçli ve kronolojiktir (zincir, "en kötü bitiş" = başlangıç + maxDuration ile test edilir):
 *   PubMed (ingest-doctorium) → Europe PMC → DOAJ → … tüm ingest-* → translate-news → generate-ai-summaries → daily-digest.
 * İçerik cron'ları Post baskısından (daily-digest) ÖNCE biter ki "sabah gazetesi" o gecenin içeriğini görsün;
 * hasta hatırlatması insanca saatte (10:00 TR).
 * 🪤 2026-10-02: Europe PMC (02:44) ve DOAJ (02:47) translate-news'ten (02:40) SONRA koşuyordu → o gecenin akademik satırları
 * ertesi geceye dek İngilizce kalıp seçkiye/Post'a öyle giriyordu (v6.206 sıra testi yalnız ingest-doctorium'a bakıyordu).
 */
export const CRON_SCHEDULES: Record<string, string> = {
  "/api/cron/ingest-doctorium": "0 2 * * *",         // 05:00 TR — akademik (PubMed) + RG + sabit kaynaklar/RSS (maxDuration 800, 2026-09-05)
  "/api/cron/ingest-europepmc": "15 2 * * *",        // 05:15 TR — Europe PMC (2026-09-05 ayrıldı; 2026-10-02: 44→15 — PubMed'in 800 sn tavanından SONRA [tekilleştirme yönlü], translate-news'ten ÖNCE)
  "/api/cron/ingest-hukuk": "20 2 * * *",            // 05:20 TR — Yargıtay + Doktrin + TTB (Pazartesi)
  "/api/cron/ingest-doaj": "21 2 * * *",             // 05:21 TR — DOAJ (2026-09-05 ayrıldı, maxDuration 800; 2026-10-02: 47→21 — Europe PMC'nin 300 sn tavanından sonra, translate-news'ten ÖNCE)
  "/api/cron/ingest-dernekler": "35 2 * * *",        // 05:35 TR — uzmanlık dernekleri RSS'i (2026-09-04: ingest-doctorium'un 300 sn sınırından ayrıldı)
  "/api/cron/translate-news": "40 2 * * *",          // 05:40 TR — özet GİRİŞİ çevirisi: TÜM ingest-* bittikten SONRA (en kötü bitiş 02:36), baskıdan önce — v6.206
  "/api/cron/generate-ai-summaries": "56 2 * * *",   // 05:56 TR — AI özetinin PROAKTİF üretimi (2026-09-05: tembel üretim daily-digest'i özetsiz besliyordu; tüm ingest'ler + translate-news bittikten SONRA, Post'tan ÖNCE)
  "/api/cron/registry-sync": "0 3 * * *",            // 06:00 TR — HealthTürkiye dizini (değişmedi)
  "/api/cron/purge-deleted": "30 3 * * *",           // 06:30 TR — KVKK imha + zincirler + günlük damga + diploma/pasiflik/ret süpürmeleri (v6.272)
  "/api/cron/daily-digest": "30 3 * * *",            // 06:30 TR — Doctorium Post + etkinlik alarmı
  "/api/cron/pending-docs-reminders": "0 7 * * *",   // 10:00 TR — DOCS_PENDING hasta hatırlatması
  "/api/cron/trial-sweep": "20 7 * * *",             // 10:20 TR — Doctorium deneme: hatırlatma 7/3/1 · süre doldu · imha bildirimi (+60 g) · imha (+90 g, fail-closed) — 2026-09-05
};
