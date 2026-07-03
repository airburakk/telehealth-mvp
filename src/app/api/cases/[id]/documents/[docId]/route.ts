import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canCaseBeAccessedBy } from "@/lib/ownership";
import { staffAccessClosed } from "@/lib/postop-access";
import { recordAccess, reqMeta } from "@/lib/audit";
import { loadDocument } from "@/lib/storage";

// GET /api/cases/:id/documents/:docId — orijinal belge içeriği (base64 → ikili akış, tarayıcıda görüntüle).
// Klinik personel (DOCTOR/COORDINATOR/ADMIN) + vaka sahipliği (BOLA düzeltmesi: rol tek başına yetmez,
// doktor yalnız kendisine atanmış/kuyruk vakasının belgesini açabilir). İçerik DB'de base64.
export async function GET(req: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const { id, docId } = await params;
  const doc = await db.caseDocument.findFirst({
    where: { id: docId, caseId: id },
    select: { content: true, mimeType: true, label: true, case: { select: { userId: true, doctorId: true, branch: true } } },
  });
  if (!doc || !doc.content) return NextResponse.json({ error: "Belge bulunamadı." }, { status: 404 });
  if (!(await canCaseBeAccessedBy(user, doc.case))) {
    return NextResponse.json({ error: "Bu vakaya erişim yetkiniz yok." }, { status: 403 });
  }

  // E2EE Faz 2A — post-op takip tamamlandıysa klinik personelin belge erişimi kapalı (hasta-only, §0.1·3).
  const closed = await staffAccessClosed(id, user);
  if (closed.closed) {
    await recordAccess({ actor: user, action: "POSTOP_ACCESS_DENIED", resourceType: "CASE_DOCUMENT", resourceId: docId, subjectUserId: doc.case?.userId ?? null, detail: `post-op kapalı (${closed.reason}) — belge`, ...reqMeta(req) });
    return NextResponse.json({ error: "Post-op takip tamamlandı; klinik erişim hastaya devredildi." }, { status: 403 });
  }

  const content = await loadDocument(doc.content); // object storage'tan (varsa) yükle + çöz (T11)
  const m = content ? /^data:([^;]+);base64,(.+)$/.exec(content) : null;
  if (!m) return NextResponse.json({ error: "İçerik biçimi geçersiz." }, { status: 422 });

  // Denetim: hasta belgesinin orijinaline erişim (kim/ne zaman/hangi belge).
  await recordAccess({ actor: user, action: "DOCUMENT_VIEW", resourceType: "CASE_DOCUMENT", resourceId: docId, subjectUserId: doc.case?.userId ?? null, detail: doc.label, ...reqMeta(req) });

  const bytes = Buffer.from(m[2], "base64");
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": doc.mimeType || m[1] || "application/octet-stream",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(doc.label)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
