import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { MyCasesList, type MergedRow } from "./MyCasesList";
import { decryptField } from "@/lib/crypto";
import { BRANCHES } from "@/lib/triage";
import {
  KEYSET_ORDER, PATIENT_CASE_GROUPS, PATIENT_PAGE_SIZE, caseGroupWhere, caseNextStep, keysetWhere, mergeKeysetPage,
  parsePatientListParams, soGroupWhere, soNextStep, type PatientCaseGroup,
} from "@/lib/patient-cases";

export const dynamic = "force-dynamic";

// Vakalarım — hastanın kendi başvuruları (hasta↔vaka sahipliği). Hasta yalnız kendi vakalarını görür.
// Tam birleşme (2026-07-12, kullanıcı kararı): İkinci Görüş vakaları da aynı listede — tüm kulvarlar
// tek akışta (MyCasesList kartları rozetle ayırt eder). SO derin listesi (/second-opinion/vakalarim) doğrudan
// bağlantılar için yaşıyor.
// Kontrol raporu 2026-09-17 K09-hasta / H11 (v6.281): tür başına `take:100` + filtresiz kart listesi yerine
// ÜÇ GRUP (işlem gerekiyor · devam eden · tamamlanan; sayılar sunucuda) + branş/tarih filtresi + KEYSET sayfalama
// (createdAt+id; iki model aynı imleçle birleştirilir — lib/patient-cases) + kart başına tek "sıradaki adım".
// Sunum + çeviri MyCasesList (client) içinde; burada yalnız auth + veri çekme + serileştirme.
export default async function MyCasesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user || !["PATIENT", "ADMIN"].includes(user.role)) redirect("/giris?next=/vakalarim");
  const params = parsePatientListParams(await searchParams);
  // Sahiplik where'i BURADA kurulur; grup/filtre yardımcıları onu genişletemez (AND ile birleşir).
  const caseOwner = user.role === "PATIENT" ? { userId: user.id } : {};
  const soOwner = user.role === "PATIENT" ? { patientId: user.id } : {};

  // Grup sayıları SUNUCUDA (filtre uygulanmış) — sekme rozetleri gerçek toplamdır, görünür dilimden türetilmez (K09).
  const countPairs = await Promise.all(
    PATIENT_CASE_GROUPS.map(async (g) => {
      const [c, s] = await Promise.all([
        db.case.count({ where: caseGroupWhere(g, params, caseOwner) }),
        db.secondOpinionCase.count({ where: soGroupWhere(g, params, soOwner) }),
      ]);
      return [g, c + s] as const;
    }),
  );
  const counts = Object.fromEntries(countPairs) as Record<PatientCaseGroup, number>;
  // Varsayılan sekme: işlem gerektiren başvuru varsa o (kaybolmasın), yoksa devam edenler.
  const group: PatientCaseGroup = params.group ?? (counts.aksiyon > 0 ? "aksiyon" : "devam");
  const after = keysetWhere(params.cursor);

  const [cases, soCases] = await Promise.all([
    db.case.findMany({
      where: { AND: [caseGroupWhere(group, params, caseOwner), after] },
      orderBy: [...KEYSET_ORDER],
      take: PATIENT_PAGE_SIZE + 1, // +1: sonraki sayfa var mı (mergeKeysetPage keser)
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
      where: { AND: [soGroupWhere(group, params, soOwner), after] },
      orderBy: [...KEYSET_ORDER],
      take: PATIENT_PAGE_SIZE + 1,
      include: { requests: { where: { status: "PENDING" }, select: { id: true } } },
    }),
  ]);

  const rows: MergedRow[] = cases.map((c) => {
    const b = c.bookings[0];
    return {
      kind: "general",
      id: c.id,
      createdAt: c.createdAt.toISOString(),
      row: {
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
        lane: c.tourismPlan ? "tourism" : c.freeCare ? "free" : "telehealth",
        nextStep: caseNextStep(c.status, { hasRecovery: !!c.recovery }),
      },
    };
  });

  const soRows: MergedRow[] = soCases.map((c) => ({
    kind: "so",
    id: c.id,
    createdAt: c.createdAt.toISOString(),
    row: {
      id: c.id,
      branchLabel: BRANCHES.find((b) => b.key === c.branch)?.label ?? c.branch,
      status: c.status,
      diagnosisSummary: decryptField(c.diagnosisSummary),
      createdAt: c.createdAt.toISOString(),
      hasPendingReq: c.requests.length > 0,
      nextStep: soNextStep(c.status, c.requests.length > 0),
    },
  }));

  const page = mergeKeysetPage(rows, soRows, PATIENT_PAGE_SIZE);

  return (
    <MyCasesList
      items={page.items}
      group={group}
      counts={counts}
      filters={{ branch: params.branch, from: params.from, to: params.to }}
      cursor={params.cursor}
      nextCursor={page.nextCursor}
    />
  );
}
