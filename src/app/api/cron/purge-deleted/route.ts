import { NextResponse } from "next/server";
import { purgeExpired, RETENTION_YEARS } from "@/lib/account-deletion";
import { verifyAccessChain } from "@/lib/audit";
import { verifyConsentChain } from "@/lib/consent";
import { sendAlert } from "@/lib/alerts";

// GET /api/cron/purge-deleted — saklama süresi dolan klinik kayıtları GERÇEKTEN imha eder (v6.11).
// vercel.json cron'u günde bir tetikler. registry-sync ile aynı Bearer deseni (anonim tetiklenemez).
//
// Bu uç, silme akışının SÖZÜNÜ TUTAN parçasıdır: hasta hesabını sildiğinde klinik kayıt yasal
// yükümlülük gereği saklanır ama kilitlenir; süre (RETENTION_YEARS) dolunca burası kaydı fiziken siler.
// Cron olmasaydı "süre sonunda imha edilir" yazmak boş bir vaat olurdu.
//
// Batch: purgeExpired varsayılan 50 kayıt/gün — cron zaman aşımına girmesin. Kalan ertesi gün alınır
// (idempotent: yalnız purgeAfter <= now olanlara bakar). Günde 50 imha, gerçekçi hacmin çok üstünde.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET tanımlı değil — cron devre dışı." }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  try {
    const r = await purgeExpired();

    // Kısmi başarısızlık: bozuk kayıt batch'i düşürmez (vaka-başına try/catch) ama sessiz de kalamaz —
    // imha sözü verilmiş kayıt duruyor demektir; ertesi gün yeniden denenir, o güne kadar her koşu alarm düşürür.
    if (r.failed > 0) {
      void sendAlert(
        "cron-purge",
        `purge-deleted KISMİ başarısızlık — ${r.failed} kayıt imha edilemedi (batch devam etti)`,
        `purged: ${r.purgedCases} vaka / ${r.purgedSoCases} SO / ${r.purgedUsers} kabuk`,
      );
    }

    // Günlük bütünlük NÖBETİ (Ray C): iki append-only zincir (audit + onam) baştan sona doğrulanır.
    // Kırıksa verify fonksiyonları kendi alarmını düşürür; burada yalnız sayaçlar raporlanır.
    // MVP hacminde ucuz (tüm mühürlü satırlar okunur, maxDuration=300); hacim büyüyünce artımlı
    // doğrulamaya geçilir (zincir ucu checkpoint'i) — bilinçli erteleme.
    const [audit, consent] = await Promise.all([verifyAccessChain(), verifyConsentChain()]);

    return NextResponse.json({
      ok: true,
      retentionYears: RETENTION_YEARS,
      ...r,
      chains: {
        audit: { ok: audit.ok, count: audit.count, brokenAt: audit.brokenAt, unverifiableSeals: audit.unverifiableSeals },
        consent: { ok: consent.ok, count: consent.count, brokenAt: consent.brokenAt, unverifiableSeals: consent.unverifiableSeals, purgedSeals: consent.purgedSeals },
      },
    });
  } catch (e) {
    // Saklama-imha sözünün bekçisi sessizce düşemez (Ray C): alarm + 500 (Vercel cron log'unda görünür).
    void sendAlert(
      "cron-purge",
      "purge-deleted cron BAŞARISIZ — saklama süresi dolan kayıtların imhası koşmadı",
      e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200),
    );
    return NextResponse.json({ error: "purge-deleted başarısız." }, { status: 500 });
  }
}
