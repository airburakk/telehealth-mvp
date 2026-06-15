import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { searchProcedures, isValidCode, floorPrice, ceilPrice } from "@/lib/procedures";

const DOCTOR_ROLES = ["DOCTOR", "COORDINATOR", "ADMIN"];

// GET /api/doctor/procedures?q=...  → tüm katalogda arama ("Diğer havuzundan ekle")
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !DOCTOR_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return NextResponse.json({ items: searchProcedures(q, 40) });
}

// POST /api/doctor/procedures  body: { selections: { "<kod>": <fiyat₺> } }
// Doktor kendi yaptığı işlemleri + taban↔tavan arası fiyatını kaydeder.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const dbUser = await db.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.doctorId) {
    return NextResponse.json({ error: "Bu hesap bir hekim profiline bağlı değil." }, { status: 400 });
  }

  const b = await req.json().catch(() => ({}));
  const raw = b?.selections;
  if (!raw || typeof raw !== "object") {
    return NextResponse.json({ error: "Geçersiz seçim." }, { status: 400 });
  }

  const clean: Record<string, number> = {};
  for (const [code, val] of Object.entries(raw)) {
    if (!isValidCode(code)) continue;
    let price = Math.round(Number(val));
    if (!Number.isFinite(price) || price < 0) continue;
    const floor = floorPrice(code);
    if (floor != null && floor > 0) {
      // taban ↔ tavan (taban×3) aralığına sıkıştır
      price = Math.min(ceilPrice(floor), Math.max(floor, price));
    }
    clean[code] = price;
    if (Object.keys(clean).length >= 3000) break; // makul üst sınır
  }

  await db.doctor.update({
    where: { id: dbUser.doctorId },
    data: { procedures: JSON.stringify(clean) },
  });

  return NextResponse.json({ ok: true, count: Object.keys(clean).length });
}
