// AŞAMA 2 güvenlik katmanları — SMS OTP + iş e-postası OTP + klinik telefonu teyidi (v6.126).
// Doximity uyarlaması; tasarım: vault wiki/kavramlar/doktor-kimlik-dogrulama.md §8.2.
//
// KAPI KURALI (kullanıcı kararı 2026-08-19): SMS ZORUNLU (kişi-cihaz bağı) + [iş e-postası ∨
// klinik telefonu geri-arama] (kurum bağı — biri yeterli; ikisini de zorlamak bağımsız çalışan /
// kurumsal e-postası olmayan doktoru tıkardı). Diploma bu katmanların DIŞINDA — Aşama 1'in işi.
//
// 🟡 DORMANT: şart yalnız AURA_LAYER_GATE=1 iken canActivate'e girer. Kanallar (SMS/Resend) zaten
// env'siz simülasyona düşer; gate kapalıyken davranış v6.124 ile birebir aynıdır. Aktivasyon
// sırası: önce SMS sağlayıcısı + Resend aktive edilir, katman damgaları dolmaya başlar, SONRA
// gate açılır (ters sıra tüm doktorları kilitlerdi).
//
// 🔒 GÜVENLİK NOTLARI:
//  - OTP kodu HİÇBİR yere düz yazılmaz: DB'de sha256(kod+satırId), log'da yok (kanal simülasyonu
//    yalnız başlık/konu basar — kod daima BODY'de taşınır, başlıkta ASLA).
//  - Hedef (telefon/e-posta) at-rest şifreli (encryptField — mmssPolicyNo deseni).
//  - Deneme sınırı + süre aşımı fail-closed; kanal başına TEK aktif meydan okuma.
//  - İş e-postası SERBEST sağlayıcı olamaz (FREE_MAIL) — kurum bağı kanıtıdır. Tam kurum-alan-adı
//    kürasyonu (HealthTürkiye tesis domain'leri) ayrı iş: vault §8.2 todo.
import { createHash, randomInt } from "node:crypto";
import { db } from "@/lib/db";
import { encryptField, decryptField } from "@/lib/crypto";
import { sendChannelMessage } from "@/lib/messaging";
import { sendEmail } from "@/lib/email";

export const OTP_TTL_MS = 10 * 60 * 1000; // 10 dk
export const MAX_ATTEMPTS = 5;

export type VerifyChannel = "SMS" | "WORK_EMAIL";

// ── Saf yardımcılar (birim testlenebilir) ─────────────────────────────────────────────────────

/** Aşama 2 katman kapısı: SMS zorunlu + kurum bağından biri (§8.2). */
export function hasStage2Layers(d: {
  smsVerifiedAt: Date | null;
  workEmailVerifiedAt: Date | null;
  clinicPhoneVerifiedAt: Date | null;
}): boolean {
  return !!d.smsVerifiedAt && (!!d.workEmailVerifiedAt || !!d.clinicPhoneVerifiedAt);
}

/** Katman şartı devrede mi (dormant varsayılan — açmadan önce kanalları aktive et!). */
export function layerGateEnabled(): boolean {
  return process.env.AURA_LAYER_GATE === "1";
}

/**
 * Doktor-yüzü "Güvenlik Doğrulamaları" bölümü GÖRÜNSÜN mü (v6.127, kullanıcı kararı):
 * kod gönderemeyen kart doktoru boşuna uğraştırır → bölüm ancak EN AZ BİR kanal gerçekten
 * aktifken (SMS sağlayıcısı ∨ Resend) ya da gate açıkken çizilir. Koordinatör tarafındaki
 * klinik-telefon teyidi bundan BAĞIMSIZ hep açıktır (damgalar gate'ten önce dolmalı).
 */
export function verifyUiVisible(): boolean {
  return (
    layerGateEnabled() ||
    !!(process.env.SMS_API_KEY && process.env.SMS_SENDER_ID) ||
    !!process.env.RESEND_API_KEY
  );
}

// Serbest e-posta sağlayıcıları — kurum bağı KANITLAMAZ, reddedilir. Liste bilinçli olarak yaygın
// tüketici alan adlarıyla sınırlı: yanlış-pozitif ret (küçük klinik domain'i) istemiyoruz;
// asıl güvence pozitif kürasyon gelince (§8.2 todo) sıkılaşır.
const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "hotmail.com", "outlook.com", "outlook.com.tr", "live.com",
  "yahoo.com", "yandex.com", "yandex.com.tr", "yandex.ru", "icloud.com", "me.com", "mail.ru",
  "protonmail.com", "proton.me", "mynet.com", "gmx.com", "gmx.net", "aol.com",
]);

/** İş e-postası olarak kabul edilebilir mi (biçim + serbest-sağlayıcı reddi). */
export function isWorkEmail(email: string): boolean {
  const m = /^[^\s@]+@([^\s@]+\.[^\s@]{2,})$/.exec(email.trim().toLowerCase());
  if (!m) return false;
  return !FREE_MAIL.has(m[1]);
}

/** 6 haneli OTP — kriptografik rastgelelik (Math.random ASLA). */
export function genOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Kod hash'i: sha256(kod + satır id) — id tuz görevi görür (gökkuşağı tablosu anlamsızlaşır). */
export function hashOtp(code: string, challengeId: string): string {
  return createHash("sha256").update(`${code}:${challengeId}`).digest("hex");
}

/** Telefon biçimi kabaca geçerli mi (uluslararası/yerel; boşluk-tire toleranslı). */
export function isPlausiblePhone(phone: string): boolean {
  const digits = phone.replace(/[\s\-()]/g, "");
  return /^\+?\d{10,15}$/.test(digits);
}

// ── DB-yan-etkili akış ────────────────────────────────────────────────────────────────────────

export interface StartResult {
  ok: boolean;
  reason: string;
  /** Kanal simülasyonda mı (env yok) — UI "geliştirme ortamında kod gönderilmez" diyebilsin. */
  simulated?: boolean;
}

/**
 * Meydan okuma başlat: kod üret → hash'le kaydet → kanaldan gönder (env yoksa simülasyon).
 * Kanal başına TEK aktif satır: eskisi silinir (tekil-belge deseni). Kod dönüşte YOKTUR.
 */
export async function startChallenge(
  doctorId: string,
  channel: VerifyChannel,
  target: string,
): Promise<StartResult> {
  const temiz = target.trim();
  if (channel === "SMS" && !isPlausiblePhone(temiz)) return { ok: false, reason: "Telefon numarası geçersiz görünüyor." };
  if (channel === "WORK_EMAIL" && !isWorkEmail(temiz)) {
    return { ok: false, reason: "Kurumsal bir e-posta adresi gerekli — serbest e-posta sağlayıcıları (gmail, hotmail...) kurum bağı kanıtlamaz." };
  }

  await db.verificationChallenge.deleteMany({ where: { doctorId, channel } });
  const code = genOtpCode();
  const row = await db.verificationChallenge.create({
    data: {
      doctorId, channel,
      target: encryptField(temiz),
      codeHash: "PENDING", // id lazım — hemen altta gerçek hash yazılır
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });
  await db.verificationChallenge.update({ where: { id: row.id }, data: { codeHash: hashOtp(code, row.id) } });

  // ⚠️ Kod DAİMA body'de: kanal simülasyonları yalnız başlık/konu logluyor (asla-loglama).
  if (channel === "SMS") {
    const r = await sendChannelMessage("SMS", temiz, {
      title: "AURA doğrulama kodu",
      body: `AURA doğrulama kodunuz: ${code} (10 dakika geçerli). Siz istemediyseniz dikkate almayın.`,
    });
    return { ok: true, reason: "Kod gönderildi.", simulated: r.simulated };
  }
  const r = await sendEmail({
    to: temiz,
    subject: "AURA iş e-postası doğrulama kodu",
    text: `AURA doğrulama kodunuz: ${code}\n\nKod 10 dakika geçerlidir. Bu talebi siz yapmadıysanız dikkate almayın.`,
  });
  return { ok: true, reason: "Kod gönderildi.", simulated: r.simulated };
}

export interface ConfirmResult {
  ok: boolean;
  reason: string;
}

/**
 * Kodu doğrula: deneme sınırı + süre + hash. Başarıda Doctor damgası atılır
 * (SMS → smsVerifiedAt + phone; WORK_EMAIL → workEmailVerifiedAt + workEmail).
 * Fail-closed: her belirsizlik ret; satır ispat izi olarak KALIR (verifiedAt'li ya da tükenmiş).
 */
export async function confirmChallenge(
  doctorId: string,
  channel: VerifyChannel,
  code: string,
): Promise<ConfirmResult> {
  const row = await db.verificationChallenge.findFirst({
    where: { doctorId, channel, verifiedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return { ok: false, reason: "Aktif doğrulama talebi yok — yeniden kod isteyin." };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: "Kodun süresi doldu — yeniden kod isteyin." };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "Deneme sınırı aşıldı — yeniden kod isteyin." };

  // Deneme sayacı KARARDAN ÖNCE artar (yanlış kodla sınırsız deneme olmasın — fail-closed).
  await db.verificationChallenge.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });

  if (hashOtp(code.trim(), row.id) !== row.codeHash) {
    return { ok: false, reason: "Kod hatalı." };
  }

  const now = new Date();
  const hedef = decryptField(row.target);
  await db.$transaction([
    db.verificationChallenge.update({ where: { id: row.id }, data: { verifiedAt: now } }),
    db.doctor.update({
      where: { id: doctorId },
      data:
        channel === "SMS"
          ? { smsVerifiedAt: now, phone: encryptField(hedef) } // doğrulanan numara bildirim hedefi de olur
          : { workEmailVerifiedAt: now, workEmail: encryptField(hedef) },
    }),
  ]);
  return { ok: true, reason: "Doğrulandı." };
}
