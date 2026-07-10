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

  const rows = await db.registryHospital.findMany({
    where: {
      removedAt: null, // yalnız halen kayıtlı tesisler
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      ...(city ? { cityName: { contains: city, mode: "insensitive" } } : {}),
    },
    select: {
      id: true, name: true, cityName: true, cityHasAirport: true,
      facilityTypeName: true, totalPersonnel: true, accreditationCount: true,
      languages: true, accreditations: true, // detay zenginleştirmesi (adlar; null = henüz dolmadı)
    },
    orderBy: [{ doctorCount: "desc" }, { name: "asc" }],
    take: 20,
  });
  // JSON kolonları diziye aç (bozuk/boş → [])
  const parse = (s: string | null): string[] => {
    if (!s) return [];
    try { const v = JSON.parse(s); return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []; }
    catch { return []; }
  };
  const items = rows.map((h) => ({ ...h, languages: parse(h.languages), accreditations: parse(h.accreditations) }));
  return NextResponse.json({ items });
}
