import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ownsCase } from "@/lib/ownership";
import { recordAccess, reqMeta } from "@/lib/audit";
import { decryptField } from "@/lib/crypto";

// GET /api/cases/:id — vaka detayı
// Erişim: oturum zorunlu + vaka sahipliği (hasta yalnız kendi vakası; klinik personel serbest).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  const { id } = await params;
  const item = await db.case.findUnique({
    where: { id },
    include: { doctor: true, consultations: { include: { doctor: true }, orderBy: { startedAt: "desc" } } },
  });
  if (!item) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });
  if (!ownsCase(user, item)) return NextResponse.json({ error: "Bu vakaya erişim yetkiniz yok." }, { status: 403 });

  await recordAccess({ actor: user, action: "CASE_VIEW", resourceType: "CASE", resourceId: item.id, subjectUserId: item.userId, ...reqMeta(req) });
  // Epikriz + SOAP notları at-rest şifreli → tüketici (kokpit) düz metin bekler → çöz.
  return NextResponse.json({
    ...item,
    dischargeReport: decryptField(item.dischargeReport),
    dischargeStructured: decryptField(item.dischargeStructured),
    consultations: item.consultations.map((co) => ({ ...co, notes: decryptField(co.notes) })),
  });
}
