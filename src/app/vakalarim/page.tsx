import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { MyCasesList, type MyCaseRow } from "./MyCasesList";

export const dynamic = "force-dynamic";

// Vakalarım — hastanın kendi başvuruları (hasta↔vaka sahipliği). Hasta yalnız kendi vakalarını görür.
// Sunum + çeviri MyCasesList (client) içinde; burada yalnız auth + veri çekme + serileştirme.
export default async function MyCasesPage() {
  const user = await getCurrentUser();
  if (!user || !["PATIENT", "ADMIN"].includes(user.role)) redirect("/giris?next=/vakalarim");

  const cases = await db.case.findMany({
    where: user.role === "PATIENT" ? { userId: user.id } : {},
    orderBy: { createdAt: "desc" },
    include: {
      bookings: { orderBy: { createdAt: "desc" }, take: 1 },
      recovery: { select: { id: true } },
    },
  });

  const rows: MyCaseRow[] = cases.map((c) => {
    const b = c.bookings[0];
    return {
      id: c.id,
      patientName: c.patientName,
      country: c.country,
      status: c.status,
      urgency: c.urgency,
      branch: c.branch,
      symptoms: c.symptoms,
      createdAt: c.createdAt.toISOString(),
      booking: b ? { id: b.id, tier: b.tier, status: b.status, total: b.total } : null,
      hasRecovery: !!c.recovery,
    };
  });

  return <MyCasesList rows={rows} />;
}
