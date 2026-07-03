// WebRTC sinyalleşme yetki kapısı — PAYLAŞILAN (signal route + ably-token route aynı kaynağı kullanır).
// Erişim: oturum + görüşme katılımcısı. Kanal kimliği üç şemadan biri:
//  • Consultation.id (genel akış) · • SecondOpinionAppointment.id (SO izole oda — FK yok) ·
//  • ConsultationVideoAppointment.id (M5 Faz 3 konsültasyon — anonim doktor↔partner).
// Taraf oturumdan türetilir (gövde/istemciye güvenilmez → taraf taklidi engellenir).
import { db } from "@/lib/db";
import { canCaseBeAccessedBy, canSoCaseBeAccessedBy } from "@/lib/ownership";
import type { Side } from "@/lib/signal-token";
import type { SessionUser } from "@/lib/session";

export async function resolveSignalSide(user: SessionUser, channelId: string): Promise<Side | null> {
  const consult = await db.consultation.findUnique({
    where: { id: channelId },
    select: { case: { select: { userId: true, doctorId: true } } },
  });
  if (consult) return (await canCaseBeAccessedBy(user, consult.case)) ? (user.role === "PATIENT" ? "patient" : "doctor") : null;

  // İkinci Görüş kanalı — PHI transkript taşır → ATAMA-daraltmalı canSoCaseBeAccessedBy ŞART
  // (BOLA fix 2026-07-02): doktor yalnız DOĞRULANMIŞ + bu randevuya ATANMIŞ (appt.doctorId) ise;
  // PARTNER ve atanmamış/doğrulanmamış doktor REDDEDİLİR. Hasta yalnız kendi vakası; koordinatör/etik/admin geniş.
  const appt = await db.secondOpinionAppointment.findUnique({
    where: { id: channelId },
    select: { patientId: true, doctorId: true },
  });
  if (appt) {
    const ok = await canSoCaseBeAccessedBy(user, { patientId: appt.patientId, assignedDoctorId: appt.doctorId });
    if (!ok) return null;
    return user.role === "PATIENT" ? "patient" : "doctor";
  }

  // Konsültasyon görüntülü görüşme (anonim). Partner "patient" tarafına eşlenir (non-doktor uç).
  const va = await db.consultationVideoAppointment.findUnique({
    where: { id: channelId },
    select: { doctorId: true, partnerId: true },
  });
  if (va) {
    if (user.role === "DOCTOR") {
      const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
      return me?.doctorId === va.doctorId ? "doctor" : null;
    }
    if (user.role === "PARTNER") {
      const me = await db.user.findUnique({ where: { id: user.id }, select: { partnerId: true } });
      return me?.partnerId === va.partnerId ? "patient" : null;
    }
    return null;
  }
  return null; // tanınmayan kanal
}
