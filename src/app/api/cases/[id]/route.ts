import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ownsCase } from "@/lib/ownership";

// GET /api/cases/:id — vaka detayı
// Erişim: oturum zorunlu + vaka sahipliği (hasta yalnız kendi vakası; klinik personel serbest).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  const { id } = await params;
  const item = await db.case.findUnique({
    where: { id },
    include: { doctor: true, consultations: { include: { doctor: true }, orderBy: { startedAt: "desc" } } },
  });
  if (!item) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });
  if (!ownsCase(user, item)) return NextResponse.json({ error: "Bu vakaya erişim yetkiniz yok." }, { status: 403 });
  return NextResponse.json(item);
}
