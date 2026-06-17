import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ownsSecondOpinionCase } from "@/lib/ownership";
import { logSoEvent } from "@/lib/second-opinion-service";

// GET /api/second-opinion/cases/[id]/documents/[docId] — belgeyi görüntüle (sahip hasta veya klinik personel).
// EXTERNAL_LINK → harici bağlantıya yönlendir; FILE_UPLOAD → base64'ü çöz, dosyayı döndür.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  const c = await db.secondOpinionCase.findUnique({ where: { id }, select: { patientId: true } });
  if (!c) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });
  if (!ownsSecondOpinionCase(user, c)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });

  const doc = await db.secondOpinionDocument.findFirst({ where: { id: docId, caseId: id } });
  if (!doc) return NextResponse.json({ error: "Belge bulunamadı." }, { status: 404 });

  await logSoEvent(id, { actorId: user.id, actorRole: user.role, action: "DOC_VIEW", detail: doc.type });

  if (doc.deliveryMethod === "EXTERNAL_LINK" && doc.externalRef) {
    return NextResponse.redirect(doc.externalRef);
  }
  if (!doc.fileRef) return NextResponse.json({ error: "Dosya yok." }, { status: 404 });

  const m = doc.fileRef.match(/^data:([^;]+);base64,([\s\S]*)$/);
  if (!m) return NextResponse.json({ error: "Dosya biçimi geçersiz." }, { status: 400 });
  const buf = Buffer.from(m[2], "base64");
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": m[1],
      "Content-Disposition": `inline; filename="${doc.type.toLowerCase()}-${docId.slice(0, 6)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
