import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/api-auth";

// POST /api/patient/journey — /basla seçimini User.patientJourney'e yazar (her seçimde üzerine).
// Nav bileşimi bu değere göre kurulur (lib/nav.ts). Yalnız hasta (+ADMIN test) yazabilir.
const JOURNEYS = new Set(["GENERAL", "SECOND_OPINION", "FREE_CARE", "HEALTH_TOURISM"]);

export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (user.role !== "PATIENT" && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Bu işlem yalnız hasta hesabıyla yapılabilir." }, { status: 403 });
  }

  const b = await req.json().catch(() => ({}));
  const journey = String(b.journey ?? "");
  if (!JOURNEYS.has(journey)) {
    return NextResponse.json({ error: "Geçersiz seçim." }, { status: 400 });
  }

  await db.user.update({ where: { id: user.id }, data: { patientJourney: journey } });
  return NextResponse.json({ ok: true });
}
