import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/cases/:id/documents/:docId — orijinal belge içeriği (base64 → ikili akış, tarayıcıda görüntüle).
// Klinik personel (DOCTOR/COORDINATOR/ADMIN). İçerik DB'de base64 (gerçek object storage TODO).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const { id, docId } = await params;
  const doc = await db.caseDocument.findFirst({
    where: { id: docId, caseId: id },
    select: { content: true, mimeType: true, label: true },
  });
  if (!doc || !doc.content) return NextResponse.json({ error: "Belge bulunamadı." }, { status: 404 });

  const m = /^data:([^;]+);base64,(.+)$/.exec(doc.content);
  if (!m) return NextResponse.json({ error: "İçerik biçimi geçersiz." }, { status: 422 });

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
