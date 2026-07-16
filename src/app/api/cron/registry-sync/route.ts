import { NextResponse } from "next/server";
import { runRegistrySync, enrichHospitalDetails } from "@/lib/ht-registry";
import { sendAlert } from "@/lib/alerts";

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

  let s: Awaited<ReturnType<typeof runRegistrySync>>;
  try {
    s = await runRegistrySync();
  } catch (e) {
    // Ray C: cron sessiz düşemez — alarm + 500 (Vercel cron log'unda görünür).
    void sendAlert("cron-registry", "registry-sync cron BAŞARISIZ (beklenmeyen hata)", e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200));
    return NextResponse.json({ error: "registry-sync başarısız." }, { status: 500 });
  }
  if (s.status !== "OK") {
    // Kaynak API'den çekim başarısız — tek günlük aksama tolere edilir ama görünür olmalı (Ray C).
    void sendAlert("cron-registry", "registry-sync günlük çekimi BAŞARISIZ (FETCH_FAILED)", `date=${s.date}`);
  }

  // Detay zenginleştirme (languages/accreditations/facilities adları) — küçük günlük bütçe:
  // yeni eklenen tesisler + önceki koşularda ağ hatası alanlar sırayla dolar. Senkron sonucunu
  // riske atmaz (hata yutulur; kalanlar yarınki koşuya kalır).
  let enrich: Awaited<ReturnType<typeof enrichHospitalDetails>> | { error: string } | null = null;
  if (s.status === "OK") {
    try { enrich = await enrichHospitalDetails(40); }
    catch (e) { enrich = { error: e instanceof Error ? e.message : String(e) }; }
  }

  return NextResponse.json({
    status: s.status,
    date: s.date,
    doctorsTotal: s.doctorsTotal,
    hospitalsTotal: s.hospitalsTotal,
    added: { doctors: s.addedDoctors.length, hospitals: s.addedHospitals.length },
    removed: { doctors: s.removedDoctors.length, hospitals: s.removedHospitals.length },
    updated: { doctors: s.updatedDoctors, hospitals: s.updatedHospitals },
    enrich,
    detail: s.detail,
  });
}
