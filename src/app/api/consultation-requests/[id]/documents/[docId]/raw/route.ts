import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { loadDocument } from "@/lib/storage";
import { recordAccess, reqMeta } from "@/lib/audit";

// GET /api/consultation-requests/:id/documents/:docId/raw — havuz DICOM'unu görüntüleyiciye akıt (v6.32).
// YALNIZ application/dicom belgeler için: DICOM'lar sunucuda PHI tag-strip'ten geçmiş ANONİM dosyalardır
// → ham gösterim güvenli. PDF/görüntü belgeler için ham dosya İNDİRİLEMEZ (mevcut anonimlik kuralı sürer:
// yanıtlayan hekim onları yalnız AI özet/çeviri üzerinden görür) → 404.
// Self-auth (middleware /api'yi korumaz):
//   DOCTOR  → consultOptIn + (talep OPEN ve genel havuz/kendi branşı) VEYA talebi yanıtlayan/etkileşen doktor
//   PARTNER → talebi açan partner (kendi dosyası)
//   diğerleri → 404 (varlık sızdırılmaz)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  const doc = await db.consultationRequestDocument.findUnique({
    where: { id: docId },
    select: { id: true, requestId: true, mime: true, label: true, fileData: true },
  });
  if (!doc || doc.requestId !== id || doc.mime !== "application/dicom") {
    return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
  }
  const r = await db.consultationRequest.findUnique({
    where: { id },
    select: { id: true, status: true, branch: true, requestedByPartnerId: true, answeredByDoctorId: true, engagedByDoctorId: true },
  });
  if (!r) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });

  let allowed = false;
  if (user.role === "DOCTOR") {
    const u = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
    const doctor = u?.doctorId ? await db.doctor.findUnique({ where: { id: u.doctorId }, select: { id: true, branch: true, consultOptIn: true } }) : null;
    if (doctor?.consultOptIn) {
      const inPool = r.status === "OPEN" && (r.branch == null || r.branch === doctor.branch);
      const mine = r.answeredByDoctorId === doctor.id || r.engagedByDoctorId === doctor.id;
      allowed = inPool || mine;
    }
  } else if (user.role === "PARTNER") {
    const u = await db.user.findUnique({ where: { id: user.id }, select: { partnerId: true } });
    allowed = !!u?.partnerId && r.requestedByPartnerId === u.partnerId;
  }
  if (!allowed) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });

  // Object storage / inline şifreli ref → data URI → ham bytes (anonim DICOM).
  const dataUri = await loadDocument(doc.fileData);
  const b64 = typeof dataUri === "string" ? dataUri.replace(/^data:[^;]*;base64,/, "") : "";
  if (!b64) return NextResponse.json({ error: "Belge okunamadı." }, { status: 500 });
  const bytes = Buffer.from(b64, "base64");

  await recordAccess({
    actor: user, action: "CONSULT_DICOM_VIEW", resourceType: "CONSULT_REQUEST", resourceId: r.id,
    subjectUserId: null, // havuz dosyası anonimdir — hasta öznesi bağlanmaz
    detail: "Havuz DICOM görüntülendi (tag-strip'li anonim dosya)", ...reqMeta(_req),
  });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/dicom",
      "Content-Disposition": `inline; filename="${encodeURIComponent(doc.label || "goruntu")}.dcm"`,
      "Cache-Control": "private, no-store",
    },
  });
}
