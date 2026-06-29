// AI veri-minimizasyonu (1C) — hasta KİMLİĞİNİ (ad) AI sağlayıcısına göndermeden klinik AI çıktısı üret.
//
// SORUN: summarizeSOAP / generateDischarge / proposePackage, prompt bağlamına gerçek hasta adını
//   gömüyordu → PHI (isim) Anthropic'e gidiyordu. Klinik içerik (semptom/öykü) AI görevinin özü olduğu
//   için kalır; ama AD görev için GEREKSİZ → minimize edilir (KVKK/GDPR veri minimizasyonu ilkesi).
//
// YAKLAŞIM: prompt'ta gerçek ad yerine kararlı bir PLACEHOLDER ([HASTA]) gönderilir; AI çıktısındaki
//   placeholder, çıktı kullanıcıya/DB'ye dönmeden ÖNCE gerçek adla geri-yerleştirilir (re-identify).
//   → AI sağlayıcısı gerçek adı HİÇ görmez; doktorun gördüğü epikriz/SOAP çıktısı korunur.
//   AI placeholder'ı kullanmazsa (yeniden ifade ederse) ad çıktıda görünmez — bu da kabul edilebilir
//   (de-identify edilmiş çıktı; doktor hastayı bağlamdan zaten bilir).
//
// NOT: Yalnız AD minimize edilir (1C kapsamı). Ülke/dil kaba bağlamdır (bireysel tanımlayıcı değil),
//   klinik içerik AI görevi için zorunludur → onlar gönderilir (lib/deidentify.ts ile aynı sınır).

/** AI prompt'unda gerçek ad yerine kullanılan kararlı placeholder. */
export const AI_NAME_PLACEHOLDER = "[HASTA]";

/**
 * AI'a gönderilecek "hasta adı" değerini döndür — gerçek ad yerine placeholder.
 * (Anlamlı tek satır: çağrı yerinde ctx.patientName yerine bunu kullan.)
 */
export function minimizedName(): string {
  return AI_NAME_PLACEHOLDER;
}

/** AI çıktısındaki placeholder'ı gerçek adla geri koy (re-identify). realName boşsa metin aynen döner. */
export function reidentifyName(text: string, realName: string | null | undefined): string {
  if (!realName || !text) return text;
  return text.split(AI_NAME_PLACEHOLDER).join(realName); // split/join = regex-güvenli (özel karakterli ad)
}
