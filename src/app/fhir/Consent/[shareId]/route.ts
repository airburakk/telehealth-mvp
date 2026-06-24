import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ownsCase } from "@/lib/ownership";
import { shareLinkToConsent } from "@/lib/fhir";
import { fhirJson, operationOutcome } from "@/lib/fhir-http";
import { recordAccess, reqMeta } from "@/lib/audit";
import { decryptField } from "@/lib/crypto";

// GET /fhir/Consent/:shareId
// M4 Güvenli Paylaşım iznini (ShareLink) FHIR R4 Consent olarak verir (contained Patient).
// Erişim: oturum + paylaşımın bağlı olduğu vakanın sahipliği.
export async function GET(req: Request, { params }: { params: Promise<{ shareId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return operationOutcome(401, "login", "Kimlik doğrulama gerekli.");

  const { shareId } = await params;
  const s = await db.shareLink.findUnique({
    where: { id: shareId },
    include: {
      case: { select: { id: true, userId: true, patientName: true, country: true, language: true, patientIdentifier: true, patientIdentifierType: true } },
      accesses: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!s) return operationOutcome(404, "not-found", "Paylaşım kaydı bulunamadı.");
  if (!ownsCase(user, s.case)) return operationOutcome(403, "forbidden", "Bu paylaşıma erişim yetkiniz yok.");

  // Denetim: FHIR dışa aktarım (paylaşım izni export).
  await recordAccess({ actor: user, action: "FHIR_EXPORT", resourceType: "FHIR_CONSENT", resourceId: s.id, subjectUserId: s.case.userId, detail: "Consent (paylaşım izni)", ...reqMeta(req) });
  // Kimlik at-rest şifreli → FHIR Patient için çöz (E2EE inc.2c)
  return fhirJson(shareLinkToConsent({ ...s, case: { ...s.case, patientName: decryptField(s.case.patientName), patientIdentifier: decryptField(s.case.patientIdentifier) } }));
}
