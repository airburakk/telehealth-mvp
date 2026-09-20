import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { BRANCHES } from "@/lib/triage";
import { decryptField } from "@/lib/crypto"; // tanı özeti at-rest şifreli (2026-08-03)
import {
  KEYSET_ORDER, PATIENT_CASE_GROUPS, PATIENT_PAGE_SIZE, keysetWhere, mergeKeysetPage, parsePatientListParams, soGroupWhere,
  soNextStep, type PatientCaseGroup,
} from "@/lib/patient-cases";
import { SoCasesList } from "./SoCasesList";

export const dynamic = "force-dynamic";

// İkinci görüş vakalarım — hastanın kendi SO başvuruları (sahiplik: patientId). Çok dilli (SoCasesList client).
// Kontrol raporu K09-hasta / H11 (v6.281): /vakalarim ile AYNI grup sözlüğü + keyset sayfalama + sıradaki adım
// (eskiden tavansız, filtresiz tek liste).
export default async function SoMyCasesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/second-opinion/vakalarim");
  if (!["PATIENT", "ADMIN"].includes(user.role)) redirect("/");
  const params = parsePatientListParams(await searchParams);
  const owner = user.role === "PATIENT" ? { patientId: user.id } : {};

  const countPairs = await Promise.all(
    PATIENT_CASE_GROUPS.map(async (g) => [g, await db.secondOpinionCase.count({ where: soGroupWhere(g, params, owner) })] as const),
  );
  const counts = Object.fromEntries(countPairs) as Record<PatientCaseGroup, number>;
  const group: PatientCaseGroup = params.group ?? (counts.aksiyon > 0 ? "aksiyon" : "devam");

  const cases = await db.secondOpinionCase.findMany({
    where: { AND: [soGroupWhere(group, params, owner), keysetWhere(params.cursor)] },
    orderBy: [...KEYSET_ORDER],
    take: PATIENT_PAGE_SIZE + 1,
    include: { requests: { where: { status: "PENDING" }, select: { id: true } } },
  });

  const rows = cases.map((c) => ({
    id: c.id,
    branchLabel: BRANCHES.find((b) => b.key === c.branch)?.label ?? c.branch,
    status: c.status,
    diagnosisSummary: decryptField(c.diagnosisSummary),
    createdAt: c.createdAt.toISOString(),
    hasPendingReq: c.requests.length > 0,
    nextStep: soNextStep(c.status, c.requests.length > 0),
  }));
  const page = mergeKeysetPage(rows, [], PATIENT_PAGE_SIZE);

  return <SoCasesList rows={page.items} group={group} counts={counts} cursor={params.cursor} nextCursor={page.nextCursor} />;
}
