import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ownsCase } from "@/lib/ownership";
import { staffAccessClosed } from "@/lib/postop-access";
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

  // E2EE Faz 2A — post-op erişim daraltma: takip tamamlandıysa klinik personel erişimi kapalı (hasta-only, §0.1·3).
  const closed = await staffAccessClosed(id, user);
  if (closed.closed) {
    await recordAccess({ actor: user, action: "POSTOP_ACCESS_DENIED", resourceType: "CASE", resourceId: item.id, subjectUserId: item.userId, detail: `post-op kapalı (${closed.reason})`, ...reqMeta(req) });
    return NextResponse.json({ error: "Bu vakanın post-op takibi tamamlandı; klinik erişim hastaya devredildi." }, { status: 403 });
  }

  await recordAccess({ actor: user, action: "CASE_VIEW", resourceType: "CASE", resourceId: item.id, subjectUserId: item.userId, ...reqMeta(req) });
  // Epikriz + SOAP notları at-rest şifreli → tüketici (kokpit) düz metin bekler → çöz.
  return NextResponse.json({
    ...item,
    symptoms: decryptField(item.symptoms),
    reasoning: decryptField(item.reasoning),
    extra: decryptField(item.extra),
    dischargeReport: decryptField(item.dischargeReport),
    dischargeStructured: decryptField(item.dischargeStructured),
    consultations: item.consultations.map((co) => ({ ...co, notes: decryptField(co.notes) })),
  });
}
