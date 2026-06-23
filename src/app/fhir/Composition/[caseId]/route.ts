import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ownsCase } from "@/lib/ownership";
import { caseToComposition } from "@/lib/fhir";
import { fhirJson, operationOutcome } from "@/lib/fhir-http";
import { recordAccess, reqMeta } from "@/lib/audit";
import { decryptField } from "@/lib/crypto";

// FHIR R4 export — Faz 1 (şema değişikliği yok). Bkz. [[saglik-veri-standartlari-hl7-fhir]].
// GET /fhir/Composition/:caseId
// Vakanın epikrizini FHIR R4 Composition (taburcu özeti, LOINC 18842-5) olarak verir;
// Patient/Practitioner/Encounter/Observation kaynakları contained olarak gömülüdür.
// Erişim: oturum zorunlu + vaka sahipliği (hasta yalnız kendi vakası; klinik personel serbest).
export async function GET(req: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return operationOutcome(401, "login", "Kimlik doğrulama gerekli.");

  const { caseId } = await params;
  const c = await db.case.findUnique({
    where: { id: caseId },
    include: {
      doctor: true,
      consultations: { orderBy: { startedAt: "desc" } },
      recovery: { include: { checkIns: { orderBy: { createdAt: "asc" } } } },
    },
  });
  if (!c) return operationOutcome(404, "not-found", "Vaka bulunamadı.");
  if (!ownsCase(user, c)) return operationOutcome(403, "forbidden", "Bu vakaya erişim yetkiniz yok.");
  if (!c.dischargeStructured) {
    return operationOutcome(404, "not-found", "Bu vaka için epikriz henüz üretilmemiş. Önce doktor kokpitinden epikriz oluşturun.");
  }

  // Denetim: FHIR dışa aktarım (klinik veri export — kim/ne zaman/hangi vaka).
  await recordAccess({ actor: user, action: "FHIR_EXPORT", resourceType: "FHIR_COMPOSITION", resourceId: c.id, subjectUserId: c.userId, detail: "Composition (epikriz)", ...reqMeta(req) });
  // Epikriz at-rest şifreli → FHIR'a dönüştürmeden önce çöz (kaynak kendinden yeterli düz JSON döner).
  return fhirJson(caseToComposition({ ...c, dischargeStructured: decryptField(c.dischargeStructured) }, user.name));
}
