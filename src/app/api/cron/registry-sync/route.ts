import { NextResponse } from "next/server";
import { runRegistrySync } from "@/lib/ht-registry";

// GET /api/cron/registry-sync — HealthTürkiye günlük senkronu (FAZ 6, 2026-07-10).
// vercel.json cron'u günde bir tetikler (03:00 UTC ≈ 06:00 İstanbul; Vercel, CRON_SECRET env'i
// tanımlıysa isteğe otomatik `Authorization: Bearer <CRON_SECRET>` başlığı ekler).
// Elle tetikleme de aynı Bearer'ı ister — anonim tetiklenemez (dış siteye istek fırlatma yüzeyi olmasın).
// İlk tam çekim yerelden 138sn sürdü (kaynak API sayfa başına ~5sn yavaş) → 60sn yetmez.
// Fluid compute'ta (bu proje 2026-06, varsayılan açık) Hobby planda da 300sn'e izin var.
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

  const s = await runRegistrySync();
  return NextResponse.json({
    status: s.status,
    date: s.date,
    doctorsTotal: s.doctorsTotal,
    hospitalsTotal: s.hospitalsTotal,
    added: { doctors: s.addedDoctors.length, hospitals: s.addedHospitals.length },
    removed: { doctors: s.removedDoctors.length, hospitals: s.removedHospitals.length },
    detail: s.detail,
  });
}
