import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { loadDocument } from "@/lib/storage";
import { recordAccess, reqMeta } from "@/lib/audit";

// Doktor mesleki belgesini (diploma/MMSS/tabip odası yazısı/sertifika) incelemeciye akıt
// (2026-08-14, doktor belge kontrolü Faz 1) — staff-applications raw ucu deseni.
// Self-auth: YALNIZ ETHICS/ADMIN (doktor-onay incelemesi). İçerik imza-tabanlı MIME kapısından
// geçmiş (yüklemede detectDocumentKind) → saklanan mimeType ile inline sunum güvenli; yine de
// no-store + audit izi düşülür. Doktorun kendisi dahil diğer roller 404 (varlık sızdırılmaz).
const REVIEWER_ROLES = ["ETHICS", "ADMIN"];

export async function GET(req: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params;
  const user = await getCurrentUser();
  if (!user || !REVIEWER_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
  }

  const doc = await db.doctorDocument.findUnique({
    where: { id: docId },
    select: { id: true, doctorId: true, type: true, label: true, mimeType: true, content: true },
  });
  if (!doc || doc.doctorId !== id) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });

  const dataUri = await loadDocument(doc.content);
  const b64 = typeof dataUri === "string" ? dataUri.replace(/^data:[^;]*;base64,/, "") : "";
  if (!b64) return NextResponse.json({ error: "Belge okunamadı." }, { status: 500 });
  const bytes = Buffer.from(b64, "base64");

  // Denetim öznesi: doktorun bağlı kullanıcı hesabı (seed/user'sız profilde null kalabilir).
  const u = await db.user.findFirst({ where: { doctorId: id }, select: { id: true } });
  await recordAccess({
    actor: user, action: "DOCTOR_DOC_VIEW", resourceType: "DOCTOR", resourceId: id,
    subjectUserId: u?.id ?? null, detail: `belge=${doc.type}:${doc.label.slice(0, 80)}`, ...reqMeta(req),
  });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(doc.label || "belge")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
