import { NextResponse } from "next/server";
import { purgeExpired, RETENTION_YEARS } from "@/lib/account-deletion";

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

  const r = await purgeExpired();
  return NextResponse.json({ ok: true, retentionYears: RETENTION_YEARS, ...r });
}
