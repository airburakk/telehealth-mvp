// Uygulama içi bildirim yardımcısı — rol hedefli yazma.
// Fire-safe: bildirim yazılamazsa ana akış (vaka/rezervasyon/şikayet...) ASLA bozulmaz.
import { db } from "./db";

export interface NotifyInput {
  type: "NEW_CASE" | "RED_FLAG" | "BOOKING" | "COMPLAINT" | "DECISION" | "SHARE_ACCESS";
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
}
