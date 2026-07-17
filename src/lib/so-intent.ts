// İkinci Görüş niyet algılama (2026-07-17, kullanıcı kararı) — telehealth triyajına
// "ikinci görüş istiyorum" yazan hastaya SO kulvarını ÖNERMEK için deterministik
// anahtar-kelime denetimi. Bilinçli olarak LLM'e bağlanmadı: klinik triyaj prompt'una
// dokunmadan, 10 desteklenen dilde test edilebilir sabit liste. Yalnız ÖNERİ üretir —
// yönlendirme kararı hastanındır (triyaj sayfasındaki banner).
//
// 🪤 Türkçe küçük-harf tuzağı: "İ".toLowerCase() = "i" + U+0307 (combining dot) →
// düz includes kaçırır. normalize("NFD") + combining-mark temizliği (U+0300-036F Latin/Kiril
// + U+064B-0652 Arapça hareke/tenvin) bunu tek yerden çözer.

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ًͯ-ْ]/g, "");

// Desteklenen hasta dillerinde "ikinci görüş" kalıpları (norm'lanmış halleriyle karşılaştırılır).
const PHRASES = [
  "ikinci görüş", // TR
  "ikinci bir görüş", // TR varyant
  "ikinci rəy", // AZ
  "ikinci fikir", // AZ konuşma dili
  "second opinion", // EN
  "رأي ثان", // AR (tenvin norm'da düşer: "رأي ثانٍ" da eşleşir)
  "رأي آخر", // AR "başka bir görüş"
  "نظر دوم", // FA
  "deuxième avis", // FR
  "second avis", // FR varyant
  "zweitmeinung", // DE
  "zweite meinung", // DE varyant
  "екінші пікір", // KK
  "экинчи пикир", // KY
].map(norm);

// RU çekimleri tek kalıba sığmaz ("второе мнение/второго мнения/второму мнению") → regex.
const PATTERNS = [/второ\S*\s+мнени\S*/u];

/** Serbest metin semptom girişinde İkinci Görüş niyeti geçiyor mu? */
export function detectSecondOpinionIntent(text: string): boolean {
  if (!text) return false;
  const n = norm(text);
  return PHRASES.some((p) => n.includes(p)) || PATTERNS.some((r) => r.test(n));
}
