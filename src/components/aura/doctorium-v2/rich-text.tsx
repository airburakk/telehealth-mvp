// "{Doctorium}" yer tutucusu → DÜZ "Doctorium" metni (content.ts sözleşmesi).
//
// v6.140 (2026-08-23, kullanıcı kararı — QA-01/P0 marka tutarlılığı): iki tonlu lockup YALNIZ logoda
// (header/footer `DoctoriumWord`); akan metinde (h1, bölüm başlıkları, notlar, CTA etiketleri) marka
// TEK METİN DÜĞÜMÜ olarak yazılır — "Doctor"+"ium" span'larına bölünmez. Eski `DoctoriumInline`/
// `DoctoriumOnEmerald` çağrıları V2'de kalktı (v1 landing'de sürer; o sayfa dondurulmuş).
// `onEmerald` prop'u geriye uyum için kabul edilir, etkisizdir (CTA metni zaten düğme renginde).
export function Rich({ text }: { text: string; onEmerald?: boolean }) {
  return <>{plain(text)}</>;
}

/** Düz metin (aria-label, title gibi yerler için) — yer tutucu marka adına çevrilir. */
export function plain(text: string): string {
  return text.replaceAll("{Doctorium}", "Doctorium");
}
