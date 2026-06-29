import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { recordAccess, reqMeta } from "@/lib/audit";
import { loadDocument } from "@/lib/storage";

// GET /api/cases/:id/documents/:docId — orijinal belge içeriği (base64 → ikili akış, tarayıcıda görüntüle).
// Klinik personel (DOCTOR/COORDINATOR/ADMIN). İçerik DB'de base64 (gerçek object storage TODO).
export async function GET(req: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const { id, docId } = await params;
  const doc = await db.caseDocument.findFirst({
    where: { id: docId, caseId: id },
    select: { content: true, mimeType: true, label: true, case: { select: { userId: true } } },
  });
  if (!doc || !doc.content) return NextResponse.json({ error: "Belge bulunamadı." }, { status: 404 });

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
