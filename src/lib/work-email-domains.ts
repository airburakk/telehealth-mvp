// İş e-postası alan-adı KÜRASYONU (v6.129) — Aşama 2 "kurum bağı" katmanının pozitif listesi.
// Tasarım: vault doktor-kimlik-dogrulama.md §8.2 (kalan iş kalemi).
//
// ÜÇ KADEMELİ MODEL (kapıyı TIKAMAYAN kürasyon — bilinçli):
//   KURUM     → sonek kuralı (.edu.tr/.gov.tr — nic.tr yalnız akademik/kamu kuruma verir) VEYA
//               küratörlü sağlık-grubu listesi. En güçlü kurum bağı.
//   BILINMEYEN→ serbest-sağlayıcı DEĞİL ama listede de yok (küçük klinik/muayenehane domain'i).
//               OTP yine doğrular (adres sahipliği kanıtlanır) ve damga ATILIR — küçük klinik
//               doktorunu tıkamak katmanın amacını aşar; incelemeci doktor-onay kartında
//               "kürasyon dışı" rozetini görür ve takdirini kullanır.
//   RED       → serbest sağlayıcı (gmail/hotmail…) — kurum bağı KANITLAMAZ, kabul edilmez.
//
// ⚠️ Liste GENİŞLETİLEBİLİR TEK YERDİR: yeni sağlık grubu buraya eklenir; doctor-verify ve
// admin rozeti buradan okur. Alan adları kuruluşların kamuya açık web sitelerinden derlendi
// (2026-08-19) — e-posta alt alan adları endsWith ile kapsanır (ör. x@asm.acibadem.com.tr).

/** nic.tr politikasıyla yalnız akademik/kamu kuruluşlara verilen sonekler. */
export const KURUM_SONEKLERI = [".edu.tr", ".gov.tr"] as const;

/** Küratörlü sağlık grubu / hastane / meslek örgütü alan adları (kök domain — alt alanlar dahil). */
export const KURATORLU_SAGLIK_DOMAINLERI = [
  // Büyük özel sağlık grupları
  "acibadem.com.tr",
  "memorial.com.tr",
  "medicalpark.com.tr",
  "medicana.com.tr",
  "livhospital.com",
  "anadolusaglik.org",
  "amerikanhastanesi.org",
  "florence.com.tr",
  "guven.com.tr",
  "dunyagoz.com",
  "medipol.com.tr",
  "bayindirhastanesi.com.tr",
  "lokmanhekimsaglik.com.tr",
  "nphastanesi.com.tr",
  // Meslek örgütleri (tabip odaları merkez + büyük iller)
  "ttb.org.tr",
  "istabip.org.tr",
  "ato.org.tr",
  "izmirtabip.org.tr",
] as const;

export type WorkEmailTier = "KURUM" | "BILINMEYEN" | "RED";

// Serbest (tüketici) e-posta sağlayıcıları — kurum bağı kanıtlamaz. doctor-verify'daki asıl
// kabul kapısı da bu listeyi (oradaki FREE_MAIL) kullanır; burada tier için yineleniyor olmasın
// diye TEK kaynak buradadır ve doctor-verify buradan import eder.
export const FREE_MAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "hotmail.com", "outlook.com", "outlook.com.tr", "live.com",
  "yahoo.com", "yandex.com", "yandex.com.tr", "yandex.ru", "icloud.com", "me.com", "mail.ru",
  "protonmail.com", "proton.me", "mynet.com", "gmx.com", "gmx.net", "aol.com",
]);

/** E-postanın alan adını döndürür (biçimsizse null). */
export function emailDomain(email: string): string | null {
  const m = /^[^\s@]+@([^\s@]+\.[^\s@]{2,})$/.exec(email.trim().toLowerCase());
  return m ? m[1] : null;
}

/**
 * Kurum bağı kademesi (saf — birim testli).
 * endsWith eşleşmesi kök domain'i VE alt alan adlarını kapsar; "sahte-acibadem.com.tr.kotu.com"
 * gibi oyunlara karşı nokta sınırı aranır (tam eşit ∨ ".domain" ile biter).
 */
export function workEmailTier(email: string): WorkEmailTier {
  const d = emailDomain(email);
  if (!d) return "RED";
  if (FREE_MAIL_DOMAINS.has(d)) return "RED";
  if (KURUM_SONEKLERI.some((s) => d.endsWith(s))) return "KURUM";
  if (KURATORLU_SAGLIK_DOMAINLERI.some((k) => d === k || d.endsWith("." + k))) return "KURUM";
  return "BILINMEYEN";
}
