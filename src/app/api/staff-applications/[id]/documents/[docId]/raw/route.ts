import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { loadDocument } from "@/lib/storage";
import { recordAccess, reqMeta } from "@/lib/audit";

// Kurumsal başvuru belgesini incelemeciye akıt (2026-08-12) — consultation raw ucu deseni.
// Self-auth: YALNIZ ETHICS/ADMIN (personel-onay incelemesi). İçerik imza-tabanlı MIME kapısından
// geçmiş (yüklemede detectDocumentKind) → saklanan mimeType ile inline sunum güvenli; yine de
// no-store + audit izi düşülür. Başvuru sahibi dahil diğer roller 404 (varlık sızdırılmaz).
const REVIEWER_ROLES = ["ETHICS", "ADMIN"];

export async function GET(req: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params;
  const user = await getCurrentUser();
  if (!user || !REVIEWER_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
  }

  const doc = await db.staffDocument.findUnique({
    where: { id: docId },
    select: { id: true, applicationId: true, label: true, mimeType: true, content: true },
  });
  if (!doc || doc.applicationId !== id) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
  const app = await db.staffApplication.findUnique({ where: { id }, select: { userId: true } });
  if (!app) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });

  const dataUri = await loadDocument(doc.content);
  const b64 = typeof dataUri === "string" ? dataUri.replace(/^data:[^;]*;base64,/, "") : "";
  if (!b64) return NextResponse.json({ error: "Belge okunamadı." }, { status: 500 });
  const bytes = Buffer.from(b64, "base64");

  await recordAccess({
    actor: user, action: "STAFF_DOC_VIEW", resourceType: "STAFF_APPLICATION", resourceId: id,
    subjectUserId: app.userId, detail: `belge=${doc.label.slice(0, 80)}`, ...reqMeta(req),
  });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(doc.label || "belge")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
