// Uygulama içi bildirim yardımcısı — rol hedefli yazma.
// Fire-safe: bildirim yazılamazsa ana akış (vaka/rezervasyon/şikayet...) ASLA bozulmaz.
// Her bildirim aynı zamanda Web Push olarak da gönderilir (tarayıcı kapalıyken cihaza düşer;
// VAPID anahtarı yoksa push sessizce atlanır).
import { db } from "./db";
import { sendPushToRoles, sendPushToUser } from "./push";
import { sendChannelMessage, type MessageChannel } from "./messaging";
import { decryptField } from "./crypto";
import { sendEmail } from "./email";
import { SITE_URL } from "./aura-landing/seo";
import { publishLiveNudge } from "./ably-server";

// v6.33 — bildirim zili dürtüsü: her bildirim yazımında "live:notify" kanalına İÇERİKSİZ nudge
// (kime/ne yazıldığı kanala ÇIKMAZ; her istemci kendi auth'lu fetch'ini yapar). Fan-out'ta tek dürtü
// yeter → instance-yerel 2sn throttle (serverless örnek-başına; yeterli — güvenlik ağı polling'i var).
let lastNotifyNudgeAt = 0;
async function nudgeNotify(): Promise<void> {
  const now = Date.now();
  if (now - lastNotifyNudgeAt < 2000) return;
  lastNotifyNudgeAt = now;
  await publishLiveNudge("notify");
}

export interface NotifyInput {
  type: "NEW_CASE" | "RED_FLAG" | "BOOKING" | "OFFER" | "COMPLAINT" | "DECISION" | "SHARE_ACCESS" | "MISSING_DOCS" | "FREECARE_MATCH" | "FREECARE_TREATMENT" | "SO_REVIEW" | "SO_REQUEST" | "SO_ASSIGNED" | "SO_OPINION" | "SO_VIDEO" | "CLINIC_OFFER" | "CLINIC_MATCH" | "CONSULT_ANSWERED" | "CONSULT_MESSAGE" | "CONSULT_VIDEO" | "ACCOUNT_VERIFIED" | "AGENCY_FILE" | "DISCHARGE_REQUEST" | "REGISTRY_REPORT" | "TOURISM_DISCLAIMER" | "TOURISM_MESSAGE" | "TOURISM_OFFER";
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
  await nudgeNotify();
}

// Kişisel bildirim — vaka sahibi hasta gibi tek kullanıcıya.
export async function notifyUser(userId: string, n: NotifyInput): Promise<void> {
  let createdId: string | null = null;
  try {
    const created = await db.notification.create({
      data: { userId, type: n.type, title: n.title, body: n.body ?? null, href: n.href ?? null },
    });
    createdId = created.id;
  } catch (e) {
    console.warn("[notify] bildirim yazılamadı:", e instanceof Error ? e.message : e);
  }
  await sendPushToUser(userId, { title: n.title, body: n.body, href: n.href });
  await routePatientChannel(userId, createdId); // hasta EMAIL/SMS tercihi (dormant) — içeriksiz dürtü
  await nudgeNotify();
}

// Hastanın intake'te seçtiği dış kanala (EMAIL/SMS) İÇERİKSİZ dürtü — routeDoctorChannel'ın hasta
// eşleniği (dormant desen: RESEND_API_KEY / SMS anahtarı yoksa simülasyon izi, anahtar takılınca canlanır).
// PHI kuralı: dış kanala bildirim BAŞLIĞI/GÖVDESİ dahil HİÇBİR içerik geçmez (e-posta üçüncü tarafta
// saklanır; href yolu bile dolaylı sağlık bilgisi sızdırır) → tam jenerik "yeni bildiriminiz var" +
// giriş bağlantısı. Bu yüzden fonksiyon NotifyInput'u parametre olarak ALMAZ (yapısal güvence).
// Sıklık: son QUIET penceresinde kullanıcıya başka bildirim yazıldıysa atlanır (art arda olaylarda tek
// dürtü yeter; in-app + Web Push zaten anlık gidiyor). Fire-safe: hata ana akışı bozmaz.
const PATIENT_CHANNEL_QUIET_MS = 6 * 60 * 60 * 1000; // 6 saat

async function routePatientChannel(userId: string, excludeNotificationId: string | null): Promise<void> {
  try {
    const u = await db.user.findUnique({
      where: { id: userId },
      select: { role: true, email: true, name: true, deletedAt: true, emailVerifiedAt: true, patientContactPref: true, patientPhone: true },
    });
    if (!u || u.role !== "PATIENT" || u.deletedAt) return;
    const pref = u.patientContactPref;
    if (pref !== "EMAIL" && pref !== "SMS") return; // APP/null = yalnız uygulama içi + push
    const recent = await db.notification.count({
      where: {
        userId,
        createdAt: { gt: new Date(Date.now() - PATIENT_CHANNEL_QUIET_MS) },
        ...(excludeNotificationId ? { id: { not: excludeNotificationId } } : {}),
      },
    });
    if (recent > 0) return; // yakın zamanda zaten dürtüldü — sessiz pencere
    if (pref === "EMAIL") {
      if (!u.emailVerifiedAt) return; // doğrulanmamış adrese işlem e-postası gönderilmez
      const link = `${SITE_URL}/giris`;
      await sendEmail({
        to: u.email,
        subject: "Yeni bildiriminiz var — AURA / You have a new notification",
        text:
          `Merhaba ${u.name},\n\n` +
          `AURA hesabınızda yeni bir bildiriminiz var. Görüntülemek için giriş yapın:\n${link}\n\n` +
          `Bu e-postayı, iletişim tercihi olarak e-postayı seçtiğiniz için alıyorsunuz.\n\n` +
          `---\n\n` +
          `Hello ${u.name},\n\n` +
          `You have a new notification on your AURA account. Sign in to view it:\n${link}\n\n` +
          `You are receiving this because you chose email as your contact preference.`,
      });
    } else {
      const phone = decryptField(u.patientPhone);
      if (!phone) return;
      await sendChannelMessage("SMS", phone, {
        title: "AURA",
        body: "Yeni bildiriminiz var — hesabınıza giriş yaparak görüntüleyin. / You have a new notification — sign in to view.",
      });
    }
  } catch (e) {
    console.warn("[notify] hasta kanal yönlendirme başarısız (akış bozulmaz):", e instanceof Error ? e.message : e);
  }
}

// Doktorun tercih ettiği ek kanala (WhatsApp/SMS — dormant/simülasyon) yönlendirme (FAZ 5).
// Uygulama içi bildirim + push HER ZAMAN yazılır; kanal tercihi buna EK'tir. Fire-safe.
async function routeDoctorChannel(doctorId: string, n: NotifyInput): Promise<void> {
  try {
    const d = await db.doctor.findUnique({ where: { id: doctorId }, select: { notifyChannel: true, phone: true } });
    if (!d || d.notifyChannel === "APP") return;
    await sendChannelMessage(d.notifyChannel as MessageChannel, decryptField(d.phone), { title: n.title, body: n.body });
  } catch (e) {
    console.warn("[notify] kanal yönlendirme başarısız (akış bozulmaz):", e instanceof Error ? e.message : e);
  }
}

// Doktor profili (Doctor.id) üzerinden o doktorun kullanıcı hesabına KİŞİSEL bildirim.
// Atanmış tedavi eden doktora hedefli uyarı (yayın değil) — bildirim yalnız ilgili doktora gider.
export async function notifyDoctorById(doctorId: string, n: NotifyInput): Promise<void> {
  try {
    const u = await db.user.findFirst({ where: { role: "DOCTOR", doctorId }, select: { id: true } });
    if (u) await notifyUser(u.id, n);
    await routeDoctorChannel(doctorId, n); // tercih WhatsApp/SMS ise ek kanal (dormant — simülasyon izi)
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
    // Kanal tercihi olan branş doktorlarına ek kanal (FAZ 5 — dormant; simülasyonda yalnız log izi)
    await Promise.all(doctors.map((d) => routeDoctorChannel(d.id, n)));
    await nudgeNotify();
  } catch (e) {
    console.warn("[notify] branş bildirimi yazılamadı:", e instanceof Error ? e.message : e);
  }
}
