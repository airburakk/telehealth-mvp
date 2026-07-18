// WhatsApp / SMS bildirim kanalı — DORMANT sağlayıcı katmanı (FAZ 5, 2026-07-10).
// Karar (kullanıcı): gerçek sağlayıcı hesabı (Twilio/Meta) AÇILMADI → env anahtarı yokken gönderim
// SİMÜLE edilir (iz log'a düşer, akış bozulmaz). Anahtarlar eklendiğinde gerçek gönderim başlar —
// Google OAuth "dormant" deseninin aynısı (env-kapılı aktivasyon, kod değişikliği gerekmez*).
// (*gerçek sağlayıcı API çağrısı aktivasyon sırasında bu dosyada tamamlanır; arayüz sabit kalır.)
//
// Fire-safe: gönderim hatası ana akışı (bildirim yazımı) ASLA bozmaz.
// PHI / asla-loglama: msg.body console'a YAZILMAZ (savunma-derinliği — bir çağıran klinik detay
// geçirse bile log'a düşmesin); simülasyon izi yalnız title + maskeli telefon içerir.

export type MessageChannel = "APP" | "WHATSAPP" | "SMS";

export interface ChannelMessage {
  title: string;
  body?: string;
}

export interface SendResult {
  sent: boolean;      // gerçek sağlayıcıya gitti mi
  simulated: boolean; // env yok → simülasyon izi
}

function whatsappConfigured(): boolean {
  return !!(process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_ID);
}
function smsConfigured(): boolean {
  return !!(process.env.SMS_API_KEY && process.env.SMS_SENDER_ID);
}

// Tek kanal gönderimi. channel=APP no-op (uygulama içi bildirim zaten yazılır).
export async function sendChannelMessage(
  channel: MessageChannel,
  phone: string | null | undefined,
  msg: ChannelMessage,
): Promise<SendResult> {
  if (channel === "APP") return { sent: false, simulated: false };
  if (!phone) {
    console.warn(`[messaging] ${channel} kanalı seçili ama telefon yok — uygulama içi bildirimle yetinildi.`);
    return { sent: false, simulated: false };
  }

  try {
    if (channel === "WHATSAPP") {
      if (!whatsappConfigured()) {
        // DORMANT: WhatsApp Business API (Meta Cloud) anahtarı yok → simülasyon izi
        console.log(`[messaging] (simülasyon) WhatsApp → ${maskPhone(phone)}: ${msg.title}`);
        return { sent: false, simulated: true };
      }
      // AKTİVASYON NOKTASI: Meta Cloud API POST /{PHONE_ID}/messages (env: WHATSAPP_API_TOKEN, WHATSAPP_PHONE_ID)
      console.warn("[messaging] WhatsApp env tanımlı ama sağlayıcı çağrısı henüz bağlanmadı — simülasyona düşüldü.");
      return { sent: false, simulated: true };
    }
    if (channel === "SMS") {
      if (!smsConfigured()) {
        console.log(`[messaging] (simülasyon) SMS → ${maskPhone(phone)}: ${msg.title}`);
        return { sent: false, simulated: true };
      }
      // AKTİVASYON NOKTASI: SMS sağlayıcısı (ör. Twilio/NetGSM) çağrısı (env: SMS_API_KEY, SMS_SENDER_ID)
      console.warn("[messaging] SMS env tanımlı ama sağlayıcı çağrısı henüz bağlanmadı — simülasyona düşüldü.");
      return { sent: false, simulated: true };
    }
  } catch (e) {
    console.warn("[messaging] kanal gönderimi başarısız (akış bozulmaz):", e instanceof Error ? e.message : e);
  }
  return { sent: false, simulated: false };
}

// Log'a tam numara yazma — son 2 hane açık, gerisi maskeli.
function maskPhone(p: string): string {
  const digits = p.replace(/\D/g, "");
  return digits.length > 2 ? "*".repeat(Math.max(0, digits.length - 2)) + digits.slice(-2) : "**";
}
