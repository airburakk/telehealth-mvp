import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { canAccessCase } from "@/lib/ownership";
import { getCurrentUser } from "@/lib/auth";
import { recoveryProtocol } from "@/lib/postop";
import { recoveryClosed } from "@/lib/postop-access";
import { RecoveryView, type RecoveryData } from "./RecoveryView";
import { decryptField } from "@/lib/crypto";

export const dynamic = "force-dynamic";

// Post-Op Takip — sunum + çeviri RecoveryView (client) içinde; burada access + veri çekme + serileştirme.
export default async function RecoveryPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const c = await db.case.findUnique({ where: { id: caseId } });
  if (!c) notFound();
  const user = await getCurrentUser();
  if (!(await canAccessCase(c))) notFound(); // hasta yalnız kendi vakasını görür

  const recovery = await db.recovery.upsert({
    where: { caseId: c.id },
    update: {},
    create: { caseId: c.id, branch: c.branch },
    include: { checkIns: { orderBy: { createdAt: "desc" } } },
  });

  // E2EE Faz 2A — takip tamamlandıysa klinik personel bu sayfaya giremez (hasta-only, §0.1·3).
  // Hasta kendi geçmişini görmeye devam eder (salt-okunur; yeni kontrol girişi kapalı — RecoveryView).
  const closed = recoveryClosed(recovery);
  if (closed.closed && user && user.role !== "PATIENT") notFound();

  const day = Math.max(1, Math.floor((Date.now() - new Date(recovery.startedAt).getTime()) / 86400000) + 1);

  const data: RecoveryData = {
    caseId: c.id,
    patientName: decryptField(c.patientName), // kimlik at-rest şifreli → çöz (E2EE inc.2c)
    branch: c.branch,
    day,
    closed: closed.closed, // E2EE Faz 2A — takip tamamlandı → hasta yeni kontrol giremez (salt-okunur)
    protocol: recoveryProtocol(c.branch),
    checkIns: recovery.checkIns.map((ci) => ({
      id: ci.id,
      createdAt: ci.createdAt.toISOString(),
      severity: ci.severity,
      pain: ci.pain,
      feverC: ci.feverC,
      meds: ci.meds,
      note: decryptField(ci.note), // post-op not/foto at-rest şifreli → çöz
      photo: decryptField(ci.photo),
    })),
  };

  return <RecoveryView data={data} />;
}
