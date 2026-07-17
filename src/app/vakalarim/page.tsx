import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { MyCasesList, type MyCaseRow, type SoCaseRow } from "./MyCasesList";
import { decryptField } from "@/lib/crypto";
import { BRANCHES } from "@/lib/triage";

export const dynamic = "force-dynamic";

// Vakalarım — hastanın kendi başvuruları (hasta↔vaka sahipliği). Hasta yalnız kendi vakalarını görür.
// Tam birleşme (2026-07-12, kullanıcı kararı): İkinci Görüş vakaları da aynı listede — tüm kulvarlar
// tek kronolojik akışta (MyCasesList kartları rozetle ayırt eder). SO derin listesi
// (/second-opinion/vakalarim) doğrudan bağlantılar için yaşıyor.
// Sunum + çeviri MyCasesList (client) içinde; burada yalnız auth + veri çekme + serileştirme.
export default async function MyCasesPage() {
  const user = await getCurrentUser();
  if (!user || !["PATIENT", "ADMIN"].includes(user.role)) redirect("/giris?next=/vakalarim");

  const [cases, soCases] = await Promise.all([
    db.case.findMany({
      where: user.role === "PATIENT" ? { userId: user.id } : {},
      orderBy: { createdAt: "desc" },
      take: 100, // emniyet tavanı (hasta başına vaka azdır; ADMIN görünümü de sınırlanır)
      // Dar liste-DTO: MyCasesList'in kullandığı alanlar + son rezervasyonun kart alanları (breakdown vb. taşınmaz).
      select: {
        id: true,
        patientName: true,
        country: true,
        status: true,
        urgency: true,
        branch: true,
        symptoms: true,
        createdAt: true,
        tourismPlan: true,
        freeCare: true, // kulvar rozeti (2026-07-17 fix: seçilmediği için free vakalar "Uzaktan Sağlık" görünürdü)
        bookings: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, tier: true, status: true, total: true } },
        recovery: { select: { id: true } },
      },
    }),
    db.secondOpinionCase.findMany({
      where: user.role === "PATIENT" ? { patientId: user.id } : {},
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { requests: { where: { status: "PENDING" }, select: { id: true } } },
    }),
  ]);

  const rows: MyCaseRow[] = cases.map((c) => {
    const b = c.bookings[0];
    return {
      id: c.id,
      patientName: decryptField(c.patientName), // kimlik at-rest şifreli → çöz (E2EE inc.2c)
      country: c.country,
      status: c.status,
      urgency: c.urgency,
      branch: c.branch,
      symptoms: decryptField(c.symptoms), // at-rest şifreli → liste gösterimi için çöz
      createdAt: c.createdAt.toISOString(),
      booking: b ? { id: b.id, tier: b.tier, status: b.status, total: b.total } : null,
      hasRecovery: !!c.recovery,
      // Kulvar: turizm planı varsa Health Tourism, freeCare işaretliyse Ücretsiz Sağlık,
      // aksi halde Telehealth (SO ayrı model → so kulvarı).
      lane: (c.tourismPlan ? "tourism" : c.freeCare ? "free" : "telehealth") as MyCaseRow["lane"],
    };
  });

  const soRows: SoCaseRow[] = soCases.map((c) => ({
    id: c.id,
    branchLabel: BRANCHES.find((b) => b.key === c.branch)?.label ?? c.branch,
    status: c.status,
    diagnosisSummary: c.diagnosisSummary,
    createdAt: c.createdAt.toISOString(),
    hasPendingReq: c.requests.length > 0,
  }));

  return <MyCasesList rows={rows} soRows={soRows} />;
}
