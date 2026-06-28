import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ConsultVideoRoom } from "./ConsultVideoRoom";

export const dynamic = "force-dynamic";

// M5 Faz 3 — Konsültasyon görüntülü görüşme odası. [id] = ConsultationVideoAppointment.id (= sinyalleşme kanalı).
// Erişim: yalnız randevunun hekimi (Doctor) veya partneri (PartnerDoctor). Anonim — hasta verisi yok.
export default async function ConsultVideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/giris?next=/konsultasyon/gorusme/${id}`);

  const appt = await db.consultationVideoAppointment.findUnique({ where: { id } });
  if (!appt) notFound();
  const req = await db.consultationRequest.findUnique({ where: { id: appt.requestId }, select: { branch: true } });
  const branchLabel = req?.branch ?? "Genel";

  let selfRole: "doctor" | "patient";
  let lang = "Türkçe";
  let remoteName = "";
  let backHref = "/doktor/konsultasyon";

  if (user.role === "DOCTOR") {
    const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
    if (!me?.doctorId || me.doctorId !== appt.doctorId) notFound();
    selfRole = "doctor";
    const partner = await db.partnerDoctor.findUnique({ where: { id: appt.partnerId }, select: { title: true, name: true } });
    remoteName = partner ? `${partner.title} ${partner.name}` : "Partner";
    backHref = "/doktor/konsultasyon";
  } else if (user.role === "PARTNER") {
    const me = await db.user.findUnique({ where: { id: user.id }, select: { partnerId: true } });
    if (!me?.partnerId || me.partnerId !== appt.partnerId) notFound();
    selfRole = "patient"; // partner = non-doktor uç
    const partner = await db.partnerDoctor.findUnique({ where: { id: appt.partnerId }, select: { language: true } });
    lang = partner?.language || "İngilizce";
    const doctor = await db.doctor.findUnique({ where: { id: appt.doctorId }, select: { title: true, name: true } });
    remoteName = doctor ? `${doctor.title} ${doctor.name}` : "Uzman hekim";
    backHref = "/partner";
  } else {
    notFound();
  }

  return (
    <ConsultVideoRoom
      roomId={appt.id}
      requestId={appt.requestId}
      selfRole={selfRole}
      lang={lang}
      remoteName={remoteName}
      branchLabel={branchLabel}
      ended={appt.status === "COMPLETED"}
      backHref={backHref}
    />
  );
}
