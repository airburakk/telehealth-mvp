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
      // ✅ SAĞLAYICI BAĞLI (v6.129): NetGSM (kullanıcı kararı 2026-08-19 — hedef kitle TR
      // doktorları; başlık/gönderici adı yerli mevzuata uygun, TR gönderimi en ekonomik).
      return await sendViaNetgsm(phone, msg);
    }
  } catch (e) {
    console.warn("[messaging] kanal gönderimi başarısız (akış bozulmaz):", e instanceof Error ? e.message : e);
  }
  return { sent: false, simulated: false };
}

// ── NetGSM gönderimi (v6.129) ─────────────────────────────────────────────────────────────────
// Env sözleşmesi:
//   SMS_API_KEY   = "kullanıcıno:şifre" (NetGSM abone no + API şifresi, iki nokta ile)
//   SMS_SENDER_ID = NetGSM'de TESCİLLİ gönderici başlığı (tescilsiz başlıkta mesaj REDDEDİLİR)
// NetGSM REST: POST /sms/rest/v2/send · Basic auth · JSON. Yanıtta `code` "00"/"01"/"02" başarı
// (kuyruğa alındı), diğerleri hata (30=yetki/kimlik, 40=başlık onaysız, 20=mesaj/karakter…).
// 🔒 Mesaj GÖVDESİ (OTP kodu) ASLA loglanmaz — yalnız maskeli numara + sağlayıcı kodu.
// ⚠️ Fail-soft: hata `sent:false` döner ve akış bozulmaz (çağıran uygulama-içi bildirime güvenir);
//    OTP akışında kullanıcı "kod gelmedi" derse yeniden isteyebilir (rate-limit korur).
async function sendViaNetgsm(phone: string, msg: ChannelMessage): Promise<SendResult> {
  const cred = (process.env.SMS_API_KEY ?? "").trim();
  const sep = cred.indexOf(":");
  if (sep <= 0) {
    console.warn("[messaging] SMS_API_KEY biçimi 'kullanıcıno:şifre' olmalı — gönderim atlandı.");
    return { sent: false, simulated: false };
  }
  const body = msg.body ? `${msg.title}\n${msg.body}` : msg.title;
  const res = await fetch("https://api.netgsm.com.tr/sms/rest/v2/send", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(cred).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      msgheader: process.env.SMS_SENDER_ID,
      messages: [{ msg: body, no: phone.replace(/\D/g, "") }],
      encoding: "TR", // Türkçe karakter (aksi hâlde ı/ş/ğ bozulur)
      iysfilter: "0", // İYS: ticari İLETİ DEĞİL (OTP/bilgilendirme) → filtre uygulanmaz
    }),
  });
  const out = (await res.json().catch(() => null)) as { code?: string } | null;
  const code = out?.code ?? "?";
  const ok = res.ok && ["00", "01", "02"].includes(code);
  if (!ok) {
    console.warn(`[messaging] NetGSM reddetti → ${maskPhone(phone)} kod=${code} http=${res.status}`);
    return { sent: false, simulated: false };
  }
  console.log(`[messaging] SMS gönderildi → ${maskPhone(phone)} (NetGSM kod=${code})`);
  return { sent: true, simulated: false };
}

// Log'a tam numara yazma — son 2 hane açık, gerisi maskeli.
function maskPhone(p: string): string {
  const digits = p.replace(/\D/g, "");
  return digits.length > 2 ? "*".repeat(Math.max(0, digits.length - 2)) + digits.slice(-2) : "**";
}
