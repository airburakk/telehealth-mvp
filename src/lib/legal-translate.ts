// Hukuki metin TAM LOKALİZASYON — sunucu (Paket 7, v6.285 · 2026-09-20; 👤 karar A: otomatik + önbellekli çeviri).
//
// Durum (kod kanıtı, lib/consent-lang S4): hukuki belgeler + onam ekranı yalnız TR kanonik + EN ikinci kanonik; diğer 9
// arayüz dilinde hasta İngilizce metni görüyordu. Artık hastanın seçtiği dilde TAM ÇEVİRİ gösterilir:
//   · kaynak daima TR kanonik markdown → lib/legal-markdown-split birimleri → lib/i18n getLegalTranslations (Claude, hukuki
//     prompt; Translation tablosunda "legal:" ad alanıyla önbellek — belge sürümü değişince birimler değişir, önbellek
//     kendiliğinden yenilenir) → aynı yapıyla geri birleştirme.
//   · Çeviri BİLGİLENDİRME amaçlıdır: bağlayıcı metin TR (ikincil EN); onam hash'i kanonik metne bağlanır, gösterilen
//     çevirinin dili + hash'i ConsentRecord.shownLang/shownTextHash'e ayrıca yazılır (ispat: hasta hangi metni okudu).
//   · Fail-open: çeviri motoru/anahtar yoksa null döner → sayfa EN kanoniğe düşer (eski davranış), asla boş sayfa yok.
// Önceden ısıtma: scripts/translate-legal.ts (ilk hasta beklemesin; DEPLOY.md).
import { getLegalTranslations } from "./i18n";
import { UI_LANGS } from "./i18n";
import { joinLegalMarkdown, legalUnits, splitLegalMarkdown } from "./legal-markdown-split";

/** Çeviri gerektiren arayüz dili mi (TR/EN kanonik dışı ve tanınan)? */
export function isTranslatableLegalLang(lang: string | null | undefined): lang is string {
  return !!lang && lang !== "Türkçe" && lang !== "İngilizce" && UI_LANGS.includes(lang);
}

export type LegalTranslation = { markdown: string; complete: boolean; units: number; translated: number };

/**
 * TR kanonik markdown → hedef dilde markdown. `complete=false` ise bazı birimler çevrilemedi (o paragraflar TR kaldı —
 * sayfa yine çizilir, üstteki not bunu söyler). Motor tamamen yoksa null (çağıran EN'e düşer).
 */
export async function translateLegalMarkdown(mdTr: string, lang: string): Promise<LegalTranslation | null> {
  if (!isTranslatableLegalLang(lang)) return null;
  const segments = splitLegalMarkdown(mdTr);
  const units = legalUnits(segments);
  const map = await getLegalTranslations(lang, units);
  // Çevrilmesi BEKLENEN birimler: en az bir 3+ harfli sözcük içerenler (tablo hücresindeki "—", URL, tarih, sürüm numarası
  // gibi simgesel birimler çeviride aynen kalır — "eksik" sayılmaz).
  const expected = units.filter((u) => /\p{L}{3,}/u.test(u));
  const translated = expected.filter((u) => map[u] !== undefined && map[u] !== u).length;
  if (translated === 0) return null; // motor yok / tümü düştü → kanonik EN'e düş
  return { markdown: joinLegalMarkdown(segments, map), complete: translated === expected.length, units: expected.length, translated };
}
