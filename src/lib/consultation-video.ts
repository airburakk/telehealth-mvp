// M5 Faz 3 — Konsültasyon görüntülü görüşme: presence/heartbeat + İcapçı offer/respond randevu.
// Sinyalleşme kanalı = ConsultationVideoAppointment.id (api/consultations/[id]/signal callerSide tanır).
// Taraflar: talebi sahiplenen/yanıtlayan doktor + talebi açan partner. Anonim (FK yok, klinik veri taşımaz).
import { db } from "./db";
import { notifyUser, notifyDoctorById } from "./notify";

export const PRESENCE_WINDOW_MS = 45_000; // son 45 sn içinde ping → online

export function isOnline(lastSeenAt: Date | null | undefined): boolean {
  return !!lastSeenAt && Date.now() - lastSeenAt.getTime() < PRESENCE_WINDOW_MS;
}

// Presence ping — oturum rolüne göre doğru tabloda lastSeenAt'i tazele (best-effort).
export async function touchPresence(role: string, ref: { doctorId?: string | null; partnerId?: string | null }): Promise<void> {
  try {
    if (role === "DOCTOR" && ref.doctorId) await db.doctor.update({ where: { id: ref.doctorId }, data: { lastSeenAt: new Date() } });
    else if (role === "PARTNER" && ref.partnerId) await db.partnerDoctor.update({ where: { id: ref.partnerId }, data: { lastSeenAt: new Date() } });
  } catch {}
}

export interface VideoApptView {
  id: string;
  status: string; // OFFERED | SCHEDULED | DECLINED | COMPLETED
  proposedAt: string;
  scheduledAt: string | null;
  doctorOnline: boolean;
  partnerOnline: boolean;
}

// Bir talebin en güncel video randevusu + her iki tarafın online durumu (UI polling için).
export async function videoForRequest(requestId: string): Promise<VideoApptView | null> {
  const a = await db.consultationVideoAppointment.findFirst({ where: { requestId }, orderBy: { createdAt: "desc" } });
  if (!a) return null;
  const [doc, par] = await Promise.all([
    db.doctor.findUnique({ where: { id: a.doctorId }, select: { lastSeenAt: true } }),
    db.partnerDoctor.findUnique({ where: { id: a.partnerId }, select: { lastSeenAt: true } }),
  ]);
  return {
    id: a.id,
    status: a.status,
    proposedAt: a.proposedAt.toISOString(),
    scheduledAt: a.scheduledAt?.toISOString() ?? null,
    doctorOnline: isOnline(doc?.lastSeenAt),
    partnerOnline: isOnline(par?.lastSeenAt),
  };
}

// Doktor görüntülü görüşme önerir (yalnız talebi sahiplenen/yanıtlayan doktor). Eski açık teklif kapanır (tek aktif).
export async function offerVideo(requestId: string, doctorId: string, proposedAt: Date): Promise<"OK" | "FORBIDDEN" | "NOT_FOUND"> {
  const req = await db.consultationRequest.findUnique({
    where: { id: requestId },
    select: { engagedByDoctorId: true, answeredByDoctorId: true, requestedByPartnerId: true, branch: true },
  });
  if (!req || !req.requestedByPartnerId) return "NOT_FOUND";
  const owner = req.answeredByDoctorId ?? req.engagedByDoctorId;
  if (owner !== doctorId) return "FORBIDDEN";

  await db.consultationVideoAppointment.updateMany({ where: { requestId, status: "OFFERED" }, data: { status: "DECLINED" } });
  await db.consultationVideoAppointment.create({
    data: { requestId, doctorId, partnerId: req.requestedByPartnerId, proposedAt, status: "OFFERED" },
  });

  const pu = await db.user.findFirst({ where: { role: "PARTNER", partnerId: req.requestedByPartnerId }, select: { id: true } });
  if (pu) await notifyUser(pu.id, { type: "CONSULT_VIDEO", title: "📹 Görüntülü görüşme teklifi", body: `${req.branch ?? "Genel"} · uzman doktor görüntülü görüşme önerdi`, href: "/partner" });
  return "OK";
}

// Partner en güncel OFFERED teklife yanıt verir: accept → SCHEDULED · decline → DECLINED. Doktora bildirir.
export async function respondVideo(requestId: string, partnerId: string, action: "accept" | "decline"): Promise<"OK" | "FORBIDDEN" | "NOT_FOUND" | "GONE"> {
  const a = await db.consultationVideoAppointment.findFirst({ where: { requestId, status: "OFFERED" }, orderBy: { createdAt: "desc" } });
  if (!a) return "GONE";
  if (a.partnerId !== partnerId) return "FORBIDDEN";

  const status = action === "accept" ? "SCHEDULED" : "DECLINED";
  await db.consultationVideoAppointment.update({
    where: { id: a.id },
    data: { status, scheduledAt: action === "accept" ? a.proposedAt : null },
  });
  await notifyDoctorById(a.doctorId, {
    type: "CONSULT_VIDEO",
    title: action === "accept" ? "✅ Görüntülü görüşme onaylandı" : "🔁 Görüntülü görüşme reddedildi",
    body: action === "accept" ? "Partner görüşmeyi onayladı — odaya katılabilirsiniz." : "Partner farklı bir zaman istiyor.",
    href: "/doktor/konsultasyon",
  });
  return "OK";
}

// Sinyalleşme/oda erişim denetimi için randevu tarafları.
export async function appointmentParties(appointmentId: string): Promise<{ doctorId: string; partnerId: string; requestId: string; status: string } | null> {
  return db.consultationVideoAppointment.findUnique({
    where: { id: appointmentId },
    select: { doctorId: true, partnerId: true, requestId: true, status: true },
  });
}

export async function completeVideo(appointmentId: string): Promise<void> {
  try { await db.consultationVideoAppointment.update({ where: { id: appointmentId }, data: { status: "COMPLETED" } }); } catch {}
}
