import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { normalizeBranchPrefs } from "@/lib/doctorium";

// POST /api/doctor/news-branches — Doctorium branş tercihleri (v6.48).
// Self-auth (middleware /api'yi korumaz): yalnız DOCTOR + kendi Doctor kaydı.
// Klinik yetkiyi DEĞİŞTİRMEZ — sadece hangi yayınların akışta görüneceğini belirler.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  if (!me?.doctorId) {
    return NextResponse.json({ error: "Doktor profili bağlı değil." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  // Bilinmeyen slug'lar elenir, tekrar temizlenir, tavan uygulanır (normalizeBranchPrefs).
  const branches = normalizeBranchPrefs(body.branches);

  await db.doctor.update({
    where: { id: me.doctorId },
    data: { newsBranches: JSON.stringify(branches) },
  });

  return NextResponse.json({ ok: true, count: branches.length });
}
