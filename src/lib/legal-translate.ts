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
// 7-C (v6.286): hukukçu onayı lib/legal-approval'da — geçerli onay varsa dondurulmuş metin sunulur, bu modül yalnız OTOMATİK
// çeviriyi kurar. `generate:false` önbellekten okur (kuyruk/onay/inceleme — Claude'a istek yok); kuyruk dil başına tek sorgu için
// `legalMarkdownUnits` + `assembleLegalMarkdown` dışa açıktır.
import { getLegalTranslations, peekLegalTranslations, UI_LANGS } from "./i18n";
import { joinLegalMarkdown, legalUnits, splitLegalMarkdown } from "./legal-markdown-split";

/** Çeviri gerektiren arayüz dili mi (TR/EN kanonik dışı ve tanınan)? */
export function isTranslatableLegalLang(lang: string | null | undefined): lang is string {
  return !!lang && lang !== "Türkçe" && lang !== "İngilizce" && UI_LANGS.includes(lang);
}

export type LegalTranslation = { markdown: string; complete: boolean; units: number; translated: number };

/** Belgenin çeviri birimleri (paragraf/madde/hücre) — önbellek anahtarları. */
export function legalMarkdownUnits(mdTr: string): string[] {
  return legalUnits(splitLegalMarkdown(mdTr));
}

/**
 * Verilen çeviri haritasıyla belgeyi kur. Çevrilmesi BEKLENEN birimler: en az bir 3+ harfli sözcük içerenler (tablo hücresindeki
 * "—", URL, tarih, sürüm numarası gibi simgesel birimler çeviride aynen kalır — "eksik" sayılmaz). "Çevrildi" = birim HARİTADA VAR:
 * özgün metne özdeş bir çeviri de sayılır ("Vercel", "`session`" gibi özel ad/kod birimlerini model bilinçli aynen bırakır ve önbellek
 * bunu saklar; 7-C düzeltmesi — eskiden özdeş=eksik sayılıp Rusça aydınlatma %96'da "eksik" görünüyordu). Başarısız birim haritaya
 * YAZILMAZ (i18n) → TR kalır ve complete=false. Hiçbir birim yoksa null.
 */
export function assembleLegalMarkdown(mdTr: string, map: Record<string, string>): LegalTranslation | null {
  const segments = splitLegalMarkdown(mdTr);
  const units = legalUnits(segments);
  const expected = units.filter((u) => /\p{L}{3,}/u.test(u));
  const translated = expected.filter((u) => map[u] !== undefined).length;
  if (translated === 0) return null;
  return { markdown: joinLegalMarkdown(segments, map), complete: translated === expected.length, units: expected.length, translated };
}

/**
 * TR kanonik markdown → hedef dilde markdown. `complete=false` ise bazı birimler çevrilemedi (o paragraflar TR kaldı —
 * sayfa yine çizilir, üstteki not bunu söyler). Motor tamamen yoksa null (çağıran EN'e düşer). `generate:false` → yalnız önbellek.
 */
export async function translateLegalMarkdown(mdTr: string, lang: string, opts: { generate?: boolean } = {}): Promise<LegalTranslation | null> {
  if (!isTranslatableLegalLang(lang)) return null;
  const units = legalMarkdownUnits(mdTr);
  const map = opts.generate === false ? await peekLegalTranslations(lang, units) : await getLegalTranslations(lang, units);
  return assembleLegalMarkdown(mdTr, map);
}
