// Uygulama içi bildirim yardımcısı — rol hedefli yazma.
// Fire-safe: bildirim yazılamazsa ana akış (vaka/rezervasyon/şikayet...) ASLA bozulmaz.
// Her bildirim aynı zamanda Web Push olarak da gönderilir (tarayıcı kapalıyken cihaza düşer;
// VAPID anahtarı yoksa push sessizce atlanır).
import { db } from "./db";
import { sendPushToRoles, sendPushToUser } from "./push";

export interface NotifyInput {
  type: "NEW_CASE" | "RED_FLAG" | "BOOKING" | "OFFER" | "COMPLAINT" | "DECISION" | "SHARE_ACCESS" | "MISSING_DOCS" | "PROBONO_MATCH" | "PROBONO_TREATMENT" | "SO_REVIEW" | "SO_REQUEST" | "SO_ASSIGNED" | "SO_OPINION" | "SO_VIDEO" | "CLINIC_OFFER" | "CLINIC_MATCH" | "CONSULT_ANSWERED" | "CONSULT_MESSAGE" | "CONSULT_VIDEO" | "ACCOUNT_VERIFIED";
  title: string;
  body?: string;
  href?: string;
}

export async function notifyRoles(roles: string[], n: NotifyInput): Promise<void> {
  try {
    await db.notification.createMany({
      data: roles.map((role) => ({ role, type: n.type, title: n.title, body: n.body ?? null, href: n.href ?? null })),
    });
  } catch (e) {
    console.warn("[notify] bildirim yazılamadı:", e instanceof Error ? e.message : e);
  }
  await sendPushToRoles(roles, { title: n.title, body: n.body, href: n.href });
}

// Kişisel bildirim — vaka sahibi hasta gibi tek kullanıcıya.
export async function notifyUser(userId: string, n: NotifyInput): Promise<void> {
  try {
    await db.notification.create({
      data: { userId, type: n.type, title: n.title, body: n.body ?? null, href: n.href ?? null },
    });
  } catch (e) {
    console.warn("[notify] bildirim yazılamadı:", e instanceof Error ? e.message : e);
  }
  await sendPushToUser(userId, { title: n.title, body: n.body, href: n.href });
}

// Doktor profili (Doctor.id) üzerinden o doktorun kullanıcı hesabına KİŞİSEL bildirim.
// Atanmış tedavi eden doktora hedefli uyarı (yayın değil) — bildirim yalnız ilgili doktora gider.
export async function notifyDoctorById(doctorId: string, n: NotifyInput): Promise<void> {
  try {
    const u = await db.user.findFirst({ where: { role: "DOCTOR", doctorId }, select: { id: true } });
    if (u) await notifyUser(u.id, n);
  } catch (e) {
    console.warn("[notify] doktor bildirimi yazılamadı:", e instanceof Error ? e.message : e);
  }
}

// Bir branştaki portal doktorlarına KİŞİSEL bildirim (rol yayını DEĞİL — yalnız ilgili branş).
// Yeni vaka kuyruğa düşerken henüz atanan doktor yoktur → vakanın branşındaki doktorlara
// duyurulur (30 branşın tümüne değil). Her doktora userId-hedefli yazılır (push dahil).
export async function notifyDoctorsByBranch(branch: string, n: NotifyInput): Promise<void> {
  try {
    const doctors = await db.doctor.findMany({ where: { branch, verified: true }, select: { id: true } });
    if (!doctors.length) return;
    const users = await db.user.findMany({
      where: { role: "DOCTOR", doctorId: { in: doctors.map((d) => d.id) } },
      select: { id: true },
    });
    if (!users.length) return;
    await db.notification.createMany({
      data: users.map((u) => ({ userId: u.id, type: n.type, title: n.title, body: n.body ?? null, href: n.href ?? null })),
    });
    await Promise.all(users.map((u) => sendPushToUser(u.id, { title: n.title, body: n.body, href: n.href })));
  } catch (e) {
    console.warn("[notify] branş bildirimi yazılamadı:", e instanceof Error ? e.message : e);
  }
}
