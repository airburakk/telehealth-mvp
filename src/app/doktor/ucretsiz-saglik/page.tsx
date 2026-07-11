import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { quotaInfo, badgeStats, waitingCount } from "@/lib/free-care";
import { FreeCareConsole, type PBCase } from "@/components/FreeCareConsole";
import { decryptField } from "@/lib/crypto";

export const dynamic = "force-dynamic";

const HISTORY_STATUSES = ["CONSULT_DONE", "TREATMENT_NEEDED", "ETHICS_REVIEW", "ETHICS_APPROVED", "ETHICS_REJECTED", "COMPLETED"];

export default async function DoctorFreeCarePage() {
  const session = await getCurrentUser();
  const u = session ? await db.user.findUnique({ where: { id: session.id } }) : null;
  const doctor = u?.doctorId ? await db.doctor.findUnique({ where: { id: u.doctorId } }) : null;

  if (!doctor) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center">
        <h1 className="text-xl font-bold text-[#F4F5F3]">Doktor profili bağlı değil</h1>
        <p className="mt-2 text-sm text-white/50">Ücretsiz hizmet müsaitliği yalnız doktor profiline bağlı hesaplarda açılır (ör. koordinatör hesabı değil).</p>
        <Link href="/doktor" className="mt-5 inline-flex rounded-lg bg-[#28C8D8] px-4 py-2.5 text-sm font-semibold text-[#0D0E10] hover:bg-[#1FA9B8]">Doktor Paneli</Link>
      </div>
    );
  }

  const q = quotaInfo(doctor);
  const [badge, count, awaiting, recent] = await Promise.all([
    badgeStats(doctor.id),
    waitingCount(),
    db.case.findMany({ where: { freeCare: true, doctorId: doctor.id, freeCareStatus: "IN_CONSULT" }, orderBy: { createdAt: "desc" } }),
    db.case.findMany({ where: { freeCare: true, doctorId: doctor.id, freeCareStatus: { in: HISTORY_STATUSES } }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  const ser = (c: (typeof awaiting)[number]): PBCase => ({
    id: c.id,
    patientName: decryptField(c.patientName), // kimlik at-rest şifreli → çöz (E2EE inc.2c)
    country: c.country,
    language: c.language,
    branch: c.branch,
    urgency: c.urgency,
    symptoms: decryptField(c.symptoms), // at-rest şifreli → konsol gösterimi için çöz
    freeCareStatus: c.freeCareStatus ?? "",
    createdAt: c.createdAt.toISOString(),
  });

  return (
    <FreeCareConsole
      initialState={doctor.freeCareState}
      quota={{ used: q.used, quota: q.quota, left: q.left }}
      waitingCount={count}
      badge={badge}
      awaiting={awaiting.map(ser)}
      recent={recent.map(ser)}
    />
  );
}
