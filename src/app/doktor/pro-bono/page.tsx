import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { quotaInfo, badgeStats, waitingCount } from "@/lib/pro-bono";
import { ProBonoConsole, type PBCase } from "@/components/ProBonoConsole";
import { decryptField } from "@/lib/crypto";

export const dynamic = "force-dynamic";

const HISTORY_STATUSES = ["CONSULT_DONE", "TREATMENT_NEEDED", "ETHICS_REVIEW", "ETHICS_APPROVED", "ETHICS_REJECTED", "COMPLETED"];

export default async function DoctorProBonoPage() {
  const session = await getCurrentUser();
  const u = session ? await db.user.findUnique({ where: { id: session.id } }) : null;
  const doctor = u?.doctorId ? await db.doctor.findUnique({ where: { id: u.doctorId } }) : null;

  if (!doctor) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center">
        <h1 className="text-xl font-bold text-[#101010]">Hekim profili bağlı değil</h1>
        <p className="mt-2 text-sm text-slate-500">Pro Bono müsaitliği yalnız hekim profiline bağlı hesaplarda açılır (ör. koordinatör hesabı değil).</p>
        <Link href="/doktor" className="mt-5 inline-flex rounded-lg bg-[#14C3D0] px-4 py-2.5 text-sm font-semibold text-[#101010] hover:bg-[#0EA5B2]">Doktor Paneli</Link>
      </div>
    );
  }

  const q = quotaInfo(doctor);
  const [badge, count, awaiting, recent] = await Promise.all([
    badgeStats(doctor.id),
    waitingCount(),
    db.case.findMany({ where: { proBono: true, doctorId: doctor.id, proBonoStatus: "IN_CONSULT" }, orderBy: { createdAt: "desc" } }),
    db.case.findMany({ where: { proBono: true, doctorId: doctor.id, proBonoStatus: { in: HISTORY_STATUSES } }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  const ser = (c: (typeof awaiting)[number]): PBCase => ({
    id: c.id,
    patientName: decryptField(c.patientName), // kimlik at-rest şifreli → çöz (E2EE inc.2c)
    country: c.country,
    language: c.language,
    branch: c.branch,
    urgency: c.urgency,
    symptoms: decryptField(c.symptoms), // at-rest şifreli → konsol gösterimi için çöz
    proBonoStatus: c.proBonoStatus ?? "",
    createdAt: c.createdAt.toISOString(),
  });

  return (
    <ProBonoConsole
      initialState={doctor.proBonoState}
      quota={{ used: q.used, quota: q.quota, left: q.left }}
      waitingCount={count}
      badge={badge}
      awaiting={awaiting.map(ser)}
      recent={recent.map(ser)}
    />
  );
}
