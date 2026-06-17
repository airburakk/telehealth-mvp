import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { BRANCHES } from "@/lib/triage";
import { SoCasesList } from "./SoCasesList";

export const dynamic = "force-dynamic";

// İkinci görüş vakalarım — hastanın kendi SO başvuruları (sahiplik: patientId). Çok dilli (SoCasesList client).
export default async function SoMyCasesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/second-opinion/vakalarim");
  if (!["PATIENT", "ADMIN"].includes(user.role)) redirect("/");

  const cases = await db.secondOpinionCase.findMany({
    where: user.role === "PATIENT" ? { patientId: user.id } : {},
    orderBy: { createdAt: "desc" },
    include: { requests: { where: { status: "PENDING" }, select: { id: true } } },
  });

  const rows = cases.map((c) => ({
    id: c.id,
    branchLabel: BRANCHES.find((b) => b.key === c.branch)?.label ?? c.branch,
    status: c.status,
    diagnosisSummary: c.diagnosisSummary,
    createdAt: c.createdAt.toISOString(),
    hasPendingReq: c.requests.length > 0,
  }));

  return <SoCasesList rows={rows} />;
}
