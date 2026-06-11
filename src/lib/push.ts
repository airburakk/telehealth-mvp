// Web Push gönderimi (PWA faz 2) — tarayıcı kapalıyken cihaza bildirim.
// VAPID anahtarları yoksa sessizce devre dışı (uygulama anahtarsız da tam çalışır).
// Fire-safe: push hatası ana akışı ASLA bozmaz; ölü abonelikler (410/404) otomatik silinir.
import webpush from "web-push";
import { db } from "./db";

export interface PushPayload {
  title: string;
  body?: string;
  href?: string;
}

export function pushEnabled(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let configured = false;
function ensureConfigured(): boolean {
  if (!pushEnabled()) return false;
  if (!configured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:admin@air.test",
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );
    configured = true;
  }
  return true;
}

async function sendTo(
  subs: { id: string; endpoint: string; p256dh: string; auth: string }[],
  payload: PushPayload
): Promise<void> {
  if (!subs.length || !ensureConfigured()) return;
  const body = JSON.stringify(payload);
  const dead: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
          { TTL: 60 * 60 } // 1 saat — cihaz çevrimdışıysa bu süre içinde teslim edilir
        );
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(s.id); // abonelik iptal edilmiş/süresi dolmuş
        else console.warn("[push] gönderilemedi:", code ?? (e instanceof Error ? e.message : e));
      }
    })
  );
  if (dead.length) {
    try { await db.pushSubscription.deleteMany({ where: { id: { in: dead } } }); } catch {}
  }
}

export async function sendPushToRoles(roles: string[], payload: PushPayload): Promise<void> {
  try {
    const subs = await db.pushSubscription.findMany({ where: { role: { in: roles } } });
    await sendTo(subs, payload);
  } catch (e) {
    console.warn("[push] rol gönderimi hatası:", e instanceof Error ? e.message : e);
  }
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  try {
    const subs = await db.pushSubscription.findMany({ where: { userId } });
    await sendTo(subs, payload);
  } catch (e) {
    console.warn("[push] kullanıcı gönderimi hatası:", e instanceof Error ? e.message : e);
  }
}
