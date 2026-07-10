import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/registry/hospitals?q=... — HealthTürkiye tesis dizininde arama (FAZ 2 hastane seçici).
// Tedavi kararında doktor, FAZ 4'te acente kullanır. Kamuya açık dizin verisi (PHI değil) ama uç
// yine de oturum ister (anonim tarama/scraping yüzeyi açılmaz). Registry henüz senkronlanmadıysa
// boş döner — UI serbest metin hastane adına düşer.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "COORDINATOR", "ADMIN", "AGENCY"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const city = (url.searchParams.get("city") ?? "").trim();
  if (q.length < 2 && !city) return NextResponse.json({ items: [] });

  const items = await db.registryHospital.findMany({
    where: {
      removedAt: null, // yalnız halen kayıtlı tesisler
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      ...(city ? { cityName: { contains: city, mode: "insensitive" } } : {}),
    },
    select: {
      id: true, name: true, cityName: true, cityHasAirport: true,
      facilityTypeName: true, totalPersonnel: true, accreditationCount: true,
    },
    orderBy: [{ doctorCount: "desc" }, { name: "asc" }],
    take: 20,
  });
  return NextResponse.json({ items });
}
