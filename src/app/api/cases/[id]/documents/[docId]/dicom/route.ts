import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canCaseBeAccessedBy } from "@/lib/ownership";
import { staffAccessClosed } from "@/lib/postop-access";
import { loadDocument } from "@/lib/storage";
import { recordAccess, reqMeta } from "@/lib/audit";

// GET /api/cases/:id/documents/:docId/dicom — hastanın yüklediği DICOM'u kokpit görüntüleyicisine akıt
// (v6.33). Dosya ASLIYLA + at-rest şifreli saklanır (kullanıcı kararı: tıbbi kayıt aslı; tag-strip
// yalnız havuza aktarımda). Self-auth: vaka erişim kapısı (hasta sahibi + atanan/branş doktor +
// operasyon personeli) + post-op daraltma (personel için) — mevcut analyze-docs deseni.
export async function GET(req: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  const c = await db.case.findUnique({
    where: { id },
    select: { id: true, userId: true, doctorId: true, branch: true, deletionLockedAt: true },
  });
  if (!c) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
  if (!(await canCaseBeAccessedBy(user, c))) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });

  // E2EE Faz 2A — post-op takip tamamlandıysa klinik personel görüntü de açamaz (hasta-only).
  const closed = await staffAccessClosed(id, user);
  if (closed.closed) {
    return NextResponse.json({ error: "Post-op takip tamamlandı; klinik erişim hastaya devredildi." }, { status: 403 });
  }

  const doc = await db.caseDocument.findUnique({
    where: { id: docId },
    select: { id: true, caseId: true, label: true, mimeType: true, content: true },
  });
  if (!doc || doc.caseId !== id || doc.mimeType !== "application/dicom" || !doc.content) {
    return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
  }

  const dataUri = await loadDocument(doc.content);
  const b64 = typeof dataUri === "string" ? dataUri.replace(/^data:[^;]*;base64,/, "") : "";
  if (!b64) return NextResponse.json({ error: "Belge okunamadı." }, { status: 500 });

  await recordAccess({
    actor: user, action: "CASE_DICOM_VIEW", resourceType: "CASE", resourceId: c.id, subjectUserId: c.userId,
    detail: "Vaka DICOM görüntülendi (hasta yüklemesi)", ...reqMeta(req),
  });

  return new NextResponse(new Uint8Array(Buffer.from(b64, "base64")), {
    headers: {
      "Content-Type": "application/dicom",
      "Content-Disposition": `inline; filename="${encodeURIComponent(doc.label || "goruntu")}.dcm"`,
      "Cache-Control": "private, no-store",
    },
  });
}
