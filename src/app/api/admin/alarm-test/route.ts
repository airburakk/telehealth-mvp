import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sendAlert } from "@/lib/alerts";
import { isEmailConfigured, maskEmail } from "@/lib/email";

// Alarm kanalı tatbikatı (2026-09-12) — /admin "Alarm kanalı" bloğundaki "Test alarmı gönder".
//
// NEDEN: lib/alerts.ts'in e-posta kanalı (ALERT_EMAIL + RESEND_API_KEY) yalnız GERÇEK bir kritik
// olayda çalışır (onam/denetim zinciri kırığı, KEK yokluğu, cron başarısızlığı…). Kanalın bu
// dağıtımda gerçekten çalıştığını — env İKİ Vercel projesine ayrı girildiği için "girildi mi?",
// Resend kabul ediyor mu, kutuya düşüyor mu — yalnız gerçek bir gönderim kanıtlar. Bu uç, aynı
// sendAlert yolunu "alarm-test" anahtarıyla tetikler: log satırı + e-posta, aynı 30 dk cooldown.
//
// Self-auth: yalnız ADMIN (proxy /admin'i korur ama /api'yi KORUMAZ — her uç kendi kapısı).
// Alarm detayına yalnız İÇ ID geçer (asla-loglama listesi: e-posta/ad yok). Yanıt alıcıyı MASKELİ
// döner — tam adres client'a gitmez, arayüz yalnız "kime gitti"yi tanır.
export async function POST() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const recipient = process.env.ALERT_EMAIL || null;
  const result = await sendAlert("alarm-test", "Alarm kanalı tatbikatı — yönetici tetikledi", `tetikleyen=${user.id}`);

  return NextResponse.json({
    ok: true,
    result,
    recipient: recipient ? maskEmail(recipient) : null,
    providerConfigured: isEmailConfigured(),
  });
}
