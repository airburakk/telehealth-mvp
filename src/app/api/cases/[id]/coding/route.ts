import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canCaseBeAccessedBy } from "@/lib/ownership";
import { staffAccessClosed } from "@/lib/postop-access";
import { recordAccess, reqMeta } from "@/lib/audit";
import { encryptField } from "@/lib/crypto";

const ID_TYPES = new Set(["TC", "PASSPORT", "OTHER"]);

// POST /api/cases/:id/coding — vakanın FHIR kodlama alanları (ICD-10 tanı + hasta kimliği).
// Klinik personel (DOCTOR/COORDINATOR/ADMIN). FHIR Faz 0 alanlarını besler → Condition + Patient.identifier.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const { id } = await params;
  const exists = await db.case.findUnique({ where: { id }, select: { id: true, userId: true, doctorId: true, branch: true } });
  if (!exists) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });
  // BOLA düzeltmesi: rol tek başına yetmez — doktor yalnız kendisine atanmış/kuyruk vakasına kod yazabilir.
  if (!(await canCaseBeAccessedBy(user, exists))) {
    return NextResponse.json({ error: "Bu vakaya erişim yetkiniz yok." }, { status: 403 });
  }

  // E2EE Faz 2A — post-op takip tamamlandıysa klinik kodlama (yazma) kapalı (hasta-only, §0.1·3).
  const closed = await staffAccessClosed(id, user);
  if (closed.closed) {
    await recordAccess({ actor: user, action: "POSTOP_ACCESS_DENIED", resourceType: "CASE", resourceId: id, subjectUserId: exists.userId, detail: `post-op kapalı (${closed.reason}) — coding`, ...reqMeta(req) });
    return NextResponse.json({ error: "Post-op takip tamamlandı; klinik erişim hastaya devredildi." }, { status: 403 });
  }

  const b = await req.json().catch(() => ({}));
  const icd10Code =
    typeof b.icd10Code === "string" && b.icd10Code.trim() ? b.icd10Code.trim().toUpperCase().slice(0, 16) : null;
  const patientIdentifier =
    typeof b.patientIdentifier === "string" && b.patientIdentifier.trim() ? b.patientIdentifier.trim().slice(0, 64) : null;
  const rawType = typeof b.patientIdentifierType === "string" ? b.patientIdentifierType.trim().toUpperCase() : "";
  const patientIdentifierType = patientIdentifier ? (ID_TYPES.has(rawType) ? rawType : "TC") : null;

  await db.case.update({ where: { id }, data: { icd10Code, patientIdentifier: encryptField(patientIdentifier), patientIdentifierType } }); // kimlik at-rest şifreli (E2EE inc.2c)
  await recordAccess({
    actor: user, action: "CODING_WRITE", resourceType: "CASE", resourceId: id, subjectUserId: exists.userId,
    detail: `ICD-10: ${icd10Code ?? "—"}`, ...reqMeta(req),
  });
  return NextResponse.json({ ok: true });
}
