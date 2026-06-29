import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canCaseBeAccessedBy } from "@/lib/ownership";
import { shareAuditBundle } from "@/lib/fhir";
import { fhirJson, operationOutcome } from "@/lib/fhir-http";
import { decryptField } from "@/lib/crypto";

// GET /fhir/Consent/:shareId/audit
// Paylaşımın erişim denetim izini (ShareAccess) FHIR AuditEvent'lerden oluşan bir Bundle (collection) olarak verir.
// Erişim: oturum + paylaşımın bağlı olduğu vakanın sahipliği.
export async function GET(_req: Request, { params }: { params: Promise<{ shareId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return operationOutcome(401, "login", "Kimlik doğrulama gerekli.");

  const { shareId } = await params;
  const s = await db.shareLink.findUnique({
    where: { id: shareId },
    include: {
      case: { select: { id: true, userId: true, doctorId: true, patientName: true, country: true, language: true, patientIdentifier: true, patientIdentifierType: true } },
      accesses: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!s) return operationOutcome(404, "not-found", "Paylaşım kaydı bulunamadı.");
  if (!(await canCaseBeAccessedBy(user, s.case))) return operationOutcome(403, "forbidden", "Bu paylaşıma erişim yetkiniz yok.");

  // Kimlik at-rest şifreli → FHIR Patient için çöz (E2EE inc.2c)
  return fhirJson(shareAuditBundle({ ...s, case: { ...s.case, patientName: decryptField(s.case.patientName), patientIdentifier: decryptField(s.case.patientIdentifier) } }));
}
