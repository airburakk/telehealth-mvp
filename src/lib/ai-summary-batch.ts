// AI özeti gece üretiminin SAYACI + denetim satırı biçimi (v6.319, 2026-10-03). Saf modül: DB/ağ yok, birim testli.
//
// NEDEN: cron `generate-ai-summaries` iki gece üst üste `hata=11` yazdı (02.10 · 03.10). Üretimde salt-okur sınıflandırma
// bu 11'in HİÇBİRİNİN AI çağrısı olmadığını gösterdi — 6 Resmî Gazete PDF'i (metin çıkarımı yok, bilinçli sınır) + 5 gövdesi
// çekilemeyen sayfa (medscape · ttb). Yapısal atlama ile gerçek hata (kaynağa erişilemedi / AI çağrısı düştü) aynı sayaçta
// toplanınca gerçek bir arıza sabit 11'in içinde gizlenir. Bu modül ikisini ayırır; KİMİN YENİDEN DENENDİĞİ DEĞİŞMEZ
// (aiSummary null kalan her satır ertesi gece yine adaydır — yapısal olanlar ağa/LLM'e gitmeden sınıflanır, para gitmez).
//
// Denetim satırı (AccessLog CRON_MAINTENANCE/generate-ai-summaries), örnek: "ozet=62/73 pdf=6 govdesiz=3 hata=2 (medscape 2)"
//   ozet=a/b                 b aday, a üretildi (eski satırlarla aynı baş — okuma alışkanlığı bozulmaz)
//   pdf= / govdesiz= / ozetsiz=   yapısal atlama; yalnız sıfırdan farklıysa yazılır
//   hata=N (kaynak n · …)    gerçek hata, kaynak kırılımıyla — "hangi kaynak düşüyor" satırdan okunur (PHI yok, yalnız adetler)

export const AI_SUMMARY_SKIPS = ["pdf", "govdesiz", "ozetsiz"] as const;

/**
 * Yapısal atlama sınıfı — AI çağrısı YAPILMAZ:
 *   pdf      kaynak PDF (metin çıkarımı yok — bilinçli sınır, arayüz söyler)
 *   govdesiz kaynak sayfa OKUNDU ama makale gövdesi yok (yalnız bağlantı/menü/liste — KLİMİK "Yeni Sayı İçin Tıklayınız")
 *   ozetsiz  akademik kalemde abstract yok (uydurma yapılmaz)
 */
export type AiSummarySkip = (typeof AI_SUMMARY_SKIPS)[number];

export interface AiSummaryBatchResult {
  toplam: number;
  basarili: number;
  /** Gerçek hata: kaynağa erişilemedi (ağ/HTTP) ya da AI çağrısı düştü — ertesi gece yeniden denenir. */
  hata: number;
  /** Yapısal atlama sayaçları (AI çağrısı yok). */
  atlanan: Record<AiSummarySkip, number>;
  /** `hata`'nın kaynak kırılımı: NewsArticle.source → adet. */
  hataKaynak: Record<string, number>;
}

export function emptyAiSummaryBatch(toplam = 0): AiSummaryBatchResult {
  return { toplam, basarili: 0, hata: 0, atlanan: { pdf: 0, govdesiz: 0, ozetsiz: 0 }, hataKaynak: {} };
}

/** Toplam yapısal atlama (ilerleme/bitiş satırları için). */
export function atlananToplam(r: AiSummaryBatchResult): number {
  return AI_SUMMARY_SKIPS.reduce((n, k) => n + r.atlanan[k], 0);
}

/** Sayaca gerçek hata ekler (kaynak kırılımıyla). Kaynak boşsa "?" altında toplanır. */
export function hataEkle(r: AiSummaryBatchResult, source: string | null | undefined): void {
  r.hata++;
  const k = source?.trim() || "?";
  r.hataKaynak[k] = (r.hataKaynak[k] ?? 0) + 1;
}

/** Denetim satırı — sabit alan sırası; sıfır sayaçlar yazılmaz. Kaynak kırılımı adede göre azalan, eşitlikte ada göre. */
export function formatAiSummaryBatch(r: AiSummaryBatchResult): string {
  const parts = [`ozet=${r.basarili}/${r.toplam}`];
  for (const k of AI_SUMMARY_SKIPS) if (r.atlanan[k] > 0) parts.push(`${k}=${r.atlanan[k]}`);
  if (r.hata > 0) {
    const kaynak = Object.entries(r.hataKaynak)
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .map(([s, n]) => `${s} ${n}`)
      .join(" · ");
    parts.push(`hata=${r.hata}${kaynak ? ` (${kaynak})` : ""}`);
  }
  return parts.join(" ");
}
