import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { BRANCHES } from "@/lib/triage";
import { SoVideoRoom } from "./SoVideoRoom";

export const dynamic = "force-dynamic";

// İzole İkinci Görüş video odası. Mevcut WebRTC sinyalleşme API'sini (string-anahtarlı) yeniden
// kullanır; Consultation/Case'e BAĞLI DEĞİL. Sinyalleşme odası = appointment.id.
export default async function SoVideoPage({
  params,
  searchParams,
}: {
  params: Promise<{ appointmentId: string }>;
  searchParams: Promise<{ role?: string }>;
}) {
  const { appointmentId } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/giris?next=/second-opinion/gorusme/${appointmentId}`);

  const appt = await db.secondOpinionAppointment.findUnique({ where: { id: appointmentId } });
  if (!appt) notFound();
  const c = await db.secondOpinionCase.findUnique({ where: { id: appt.caseId } });
  if (!c) notFound();

  // Erişim: hasta sahibi / atanmış doktor / klinik personel
  let role: "doctor" | "patient";
  if (user.role === "PATIENT") {
    if (c.patientId !== user.id) notFound();
    role = "patient";
  } else if (user.role === "DOCTOR") {
    const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
    if (!me?.doctorId || me.doctorId !== appt.doctorId) notFound();
    role = "doctor";
  } else {
    role = "doctor"; // koordinatör / admin doktor tarafından katılır
  }
  const selfRole: "doctor" | "patient" = sp.role === "patient" ? "patient" : sp.role === "doctor" ? "doctor" : role;

  const doctor = await db.doctor.findUnique({ where: { id: appt.doctorId }, select: { title: true, name: true } });
  const patient = await db.user.findUnique({ where: { id: c.patientId }, select: { name: true } });
  const branchLabel = BRANCHES.find((b) => b.key === c.branch)?.label ?? c.branch;

  return (
    <SoVideoRoom
      roomId={appt.id}
      caseId={c.id}
      selfRole={selfRole}
      ended={appt.status === "COMPLETED" || c.status === "CLOSED"}
      branchLabel={branchLabel}
      remoteName={selfRole === "doctor" ? (patient?.name ?? "Hasta") : `${doctor?.title ?? ""} ${doctor?.name ?? ""}`.trim()}
      scheduledAt={appt.scheduledAt.toISOString()}
    />
  );
}
