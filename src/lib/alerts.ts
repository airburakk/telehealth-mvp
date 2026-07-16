// Kritik operasyon alarmları — Ray C gözlemlenebilirlik temel çizgisi (Faz 5, 2026-07-16).
// Kanal 1: console.error "[ALERT]" ön-eki → Vercel log'larında tek grep'lik desen.
// Kanal 2: ALERT_EMAIL env'ine e-posta (lib/email.ts dormant Resend katmanı üzerinden) —
//   RESEND_API_KEY veya ALERT_EMAIL yoksa e-posta atlanır, log kanalı her zaman çalışır.
// Fire-safe: alarm göndermek HİÇBİR akışı bozamaz (asla throw etmez); çağıranlar `void sendAlert(...)`
// ile beklemeden tetikler. Test ortamında (NODE_ENV=test) tamamen susar — kasıtlı kurcalama testleri
// (audit tamper vb.) alarm üretmesin.
//
// ── 🚫 ASLA LOGLAMA LİSTESİ (alarm detayı + tüm log satırları için BAĞLAYICI kural) ──────────────
// İzleme, sağlık verisini log'a KOPYALAMADAN hata tespit etmelidir. Şunlar hiçbir log/alarm/hata
// mesajına giremez (README "Gözlemlenebilirlik" bölümüyle aynı liste):
//   • semptom metni · tanı/teşhis            • belge içeriği ve belge ADI (hasta adı taşıyabilir)
//   • görüşme/transkript içeriği             • hasta bilgisi içeren görüntü metadata'sı
//   • sağlık verisi içeren AI prompt'ları    • tıbbi bağlamda gerçek ad-soyad
//   • erişim token'ları · şifreleme anahtarları/materyali · oturum çerezleri
// Yerine: iç ID (userId/caseId), olay kategorisi, hata KODU, süre/adet kovası kullanılır.
// `detail` alanına yalnız bu türden teknik bağlam geçirin; emin değilseniz HİÇ geçirmeyin.
// (PHI de-id çizgisinin devamı: [translate-path], [email.ts maskEmail] desenleri.)

import { sendEmail } from "@/lib/email";

// Aynı anahtarlı alarmın tekrar bildirimi için bekleme süresi. Serverless'ta sayaç INSTANCE-BAŞINA
// yaşar → paralel instance'lar aynı alarmı birer kez daha gönderebilir (temel çizgi için kabul;
// dağıtık dedup istenirse Upstash katmanı sonraki adım).
const COOLDOWN_MS = 30 * 60_000;
const lastSentAt = new Map<string, number>();

export interface AlertResult {
  logged: boolean;
  emailed: boolean; // gerçek sağlayıcıya gitti (dormant/simülasyonda false)
  suppressed: "cooldown" | "test" | null;
}

// Kritik alarm yayınla. key = makine-okur olay sınıfı (ör. "consent-write", "audit-chain");
// cooldown ve log grep'i bu anahtar üzerinden çalışır. title/detail İNSAN-okur ve PHI'siz (üstteki liste).
export async function sendAlert(key: string, title: string, detail?: string): Promise<AlertResult> {
  try {
    if (process.env.NODE_ENV === "test") return { logged: false, emailed: false, suppressed: "test" };
    const now = Date.now();
    const last = lastSentAt.get(key);
    if (last !== undefined && now - last < COOLDOWN_MS) {
      return { logged: false, emailed: false, suppressed: "cooldown" };
    }
    lastSentAt.set(key, now);

    const env = process.env.VERCEL_ENV ?? "local";
    const d = detail ? ` — ${detail.slice(0, 400)}` : "";
    console.error(`[ALERT] ${key}: ${title}${d} (env=${env})`);

    const to = process.env.ALERT_EMAIL;
    if (!to) return { logged: true, emailed: false, suppressed: null };
    const r = await sendEmail({
      to,
      subject: `[AURA ALARM] ${key} — ${title}`,
      text:
        `Olay: ${key}\nBaşlık: ${title}\nOrtam: ${env}\nZaman: ${new Date().toISOString()}\n` +
        (detail ? `Detay: ${detail.slice(0, 400)}\n` : "") +
        `\nAynı olay için ${COOLDOWN_MS / 60_000} dk bildirim beklemesi uygulanır; Vercel log'larında "[ALERT] ${key}" ile aranır.`,
    });
    return { logged: true, emailed: r.sent, suppressed: null };
  } catch (e) {
    // Alarm altyapısının kendisi asla akış bozmaz — son çare düz log.
    try { console.error("[ALERT] alerts-self: alarm gönderimi başarısız:", e instanceof Error ? e.message : e); } catch { /* boş */ }
    return { logged: false, emailed: false, suppressed: null };
  }
}

// ── Şifre çözme hata KÜMESİ sayacı ───────────────────────────────────────────────────────────────
// Tek tük decrypt hatası eski/bozuk satırdan gelebilir; KÜME (kısa pencerede çok hata) anahtar/ortam
// sorunudur (yanlış KEK, bozuk env) → tek alarm. Sayaç instance-başına (üstteki cooldown notu geçerli).
const DECRYPT_WINDOW_MS = 10 * 60_000;
const DECRYPT_THRESHOLD = 5;
let decryptWindowStart = 0;
let decryptFailures = 0;

// crypto.ts decrypt hatasında çağırır (senkron; alarmı beklemeden ateşler). context = teknik bağlam
// (ör. "field" / "case-fields") — alan İÇERİĞİ asla geçirilmez.
export function noteDecryptFailure(context: string): void {
  const now = Date.now();
  if (now - decryptWindowStart > DECRYPT_WINDOW_MS) {
    decryptWindowStart = now;
    decryptFailures = 0;
  }
  decryptFailures++;
  if (decryptFailures === DECRYPT_THRESHOLD) {
    void sendAlert(
      "decrypt-cluster",
      `${DECRYPT_WINDOW_MS / 60_000} dk içinde ${DECRYPT_THRESHOLD}+ şifre çözme hatası`,
      `bağlam=${context} — yanlış/eksik KEK veya bozuk şifreli veri olası`,
    );
  }
}

// Yalnız birim testleri için: modül-içi durumu sıfırla (cooldown + küme sayacı).
export function __resetAlertStateForTests(): void {
  lastSentAt.clear();
  decryptWindowStart = 0;
  decryptFailures = 0;
}
