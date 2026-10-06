// İçerik takvimi — PAYLAŞILAN sınırlar ve editör metni yardımcısı (v6.328, 2026-10-06). SAF ve BAĞIMSIZ: hiçbir içe aktarma yok.
//
// Neden ayrı dosya: istemci bileşeni (admin/icerik-takvimi/SlotEditor) sınırları `maxLength` olarak ve çıkarım metnini canlı sayaç için kullanır; ama
// payload.ts → timestamp.ts → Node `crypto` zinciri tarayıcı paketine GİREMEZ. Burası sunucu (payload/gates/plan) ve istemci tarafından ortak okunur.
// payload.ts / gates.ts bu sabitleri YENİDEN DIŞA AKTARIR (mevcut içe aktarmalar bozulmaz).

export const LIMITS = {
  minSlides: 3,
  maxSlides: 10, // Instagram CAROUSEL 2–10 görsel
  title: 140,
  body: 1200,
  bullet: 320,
  bullets: 6,
  caption: 2200,
  hashtags: 5, // Instagram uygulaması 5'e indirdi (hafıza: doctorium-instagram-hikaye-reels)
  hashtag: 40,
  sources: 6,
  sourceLabel: 200,
  sourceRef: 300,
  note: 3000,
} as const;

/** "Doktor için çıkarım" onay kapısı eşikleri. */
export const MIN_NOTE_BULLETS = 3;
export const MIN_NOTE_BULLET_CHARS = 12;
export const MIN_CAPTION_CHARS = 20;

/** Satır başı madde işaretlerini ("1)", "2.", "-", "•", "*") atıp boş olmayan satırları madde yapar. */
export function noteLines(note: string | null | undefined): string[] {
  if (!note) return [];
  return note
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/^\s*(?:\d{1,2}[.)]|[-•*–])\s*/, "").trim())
    .filter(Boolean);
}
