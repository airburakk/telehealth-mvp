// Paylaşım şifre kapısı — imzalı capability (2026-08-03 dış denetimi P0).
//
// ⚠️ SUNUCU-ONLY: `crypto` import eder. `lib/share.ts` bilinçli olarak istemci-güvenlidir (node
// importu yok) → bu mantık oraya TAŞINMAZ. "use client" bir dosyadan bu modülü import etme.
//
// SORUN: kapı `air_share_<id>=1` çerezine bakıyordu. `httpOnly` yalnız TARAYICIDAKİ JavaScript'i
// engeller; saldırganın kendi HTTP istemcisiyle `Cookie: air_share_<id>=1` başlığını göndermesini
// engellemez. Çerez doğrulanabilir hiçbir şey taşımadığı için parola kapısı, elinde paylaşım linki
// olan herkes tarafından parolayı bilmeden aşılabiliyordu — ki parolanın var oluş sebebi tam olarak
// "link yanlış kişiye ulaştı" senaryosudur.
//
// ÇÖZÜM: çerez artık sunucunun ürettiği, süreli ve İMZALI bir yetkidir. İmza olmadan üretilemez.
//
// Capability üç şeye BAĞLIDIR (hepsi MAC'in içinde):
//   1. shareId       → A paylaşımının çerezi B'yi açamaz
//   2. passwordHash  → hasta parolayı değiştirirse eldeki tüm capability'ler ANINDA geçersizleşir
//   3. exp           → süre dolunca ölür (parola yeniden sorulur)
// İptal/süre dolumu ayrıca kapsanır: görüntüleyici `shareState(link) !== "ACTIVE"` kontrolünü
// parola kapısından ÖNCE yapar.

import { createHmac, timingSafeEqual, randomBytes } from "crypto";

/** Capability ömrü — parola bir kez girilir, bu süre boyunca tekrar sorulmaz. */
export const SHARE_UNLOCK_TTL_MS = 60 * 60_000; // 1 saat (eski çerezin maxAge'i ile aynı)

// Oturum sırrıyla AYNI kaynaktan türetilir ama farklı bir etiketle → paylaşım capability'si oturum
// token'ı yerine (veya tersi) kullanılamaz. Lazy çözümleme: modül yanlışlıkla client'a sızarsa
// sayfayı çökertmesin (2026-07-31 master paneli olayının dersi, session.ts ile aynı desen).
const WEAK_SECRETS = new Set(["air-mvp-dev-secret", "change-me-to-a-long-random-secret"]);
let _key: Buffer | null = null;

function unlockKey(): Buffer {
  if (_key) return _key;
  const s = process.env.SESSION_SECRET;
  const weak = !s || WEAK_SECRETS.has(s) || s.length < 16;
  if (weak && process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET üretimde zorunlu ve güçlü olmalı — paylaşım kapısı imzalanamıyor (boot durduruldu).",
    );
  }
  const base = weak ? "air-mvp-dev-secret" : s!;
  // Etiketli türetme: aynı sırdan farklı amaçlar için farklı anahtarlar.
  _key = createHmac("sha256", base).update("aura:share-unlock:v1").digest();
  return _key;
}

function sign(shareId: string, passwordHash: string, exp: number, nonce: string): string {
  return createHmac("sha256", unlockKey())
    .update(`${shareId}|${passwordHash}|${exp}|${nonce}`)
    .digest("base64url");
}

/**
 * Parola doğrulandıktan SONRA çağrılır. Süreli, imzalı capability üretir.
 * Biçim: `<exp>.<nonce>.<imza>`
 */
export function issueUnlockToken(shareId: string, passwordHash: string, now = Date.now()): string {
  const exp = now + SHARE_UNLOCK_TTL_MS;
  const nonce = randomBytes(12).toString("base64url"); // tekrar kullanımı ayırt etmek + tahmini imkânsız kılmak
  return `${exp}.${nonce}.${sign(shareId, passwordHash, exp, nonce)}`;
}

/**
 * Görüntüleyicide çağrılır. Fail-closed: biçim bozuk, süresi dolmuş veya imzası tutmayan her şey `false`.
 */
export function verifyUnlockToken(
  token: string | undefined | null,
  shareId: string,
  passwordHash: string,
  now = Date.now(),
): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expRaw, nonce, sig] = parts;

  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp <= now) return false; // süresi dolmuş → parola yeniden sorulur

  const expected = sign(shareId, passwordHash, exp, nonce);
  // Uzunluk farkı timingSafeEqual'ı FIRLATIR → önce uzunluk kontrolü (kendisi sabit-zaman değil ama
  // yalnız uzunluk sızdırır, imza içeriğini değil).
  if (expected.length !== sig.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}
