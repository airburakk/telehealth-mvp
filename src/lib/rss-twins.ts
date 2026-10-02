// RSS kimlik geçişi (v6.307, 2026-10-02) — SAF modül: db/ağ YOK. İçe aktarma (doctorium-sources ingestRss), tek seferlik
// temizlik betiği (scripts/dedupe-rss-guid.ts) ve birim testi AYNI kimlik kuralını buradan okur.
//
// ARKA PLAN: 1438e05 (2026-09-29) ingestRss `externalId`'sini `link` → `guid || link` yaptı (KLİMİK gibi WordPress
// kaynaklarında yazının tarihi değişince permalink de değişiyor, aynı duyuru "yeni kayıt" sanılıyordu). Değişiklik doğruydu
// ama o güne dek yazılmış satırlar link-anahtarlı KALDI. `upsertArticle` yalnız (source, externalId) çiftine baktığı için
// guid ≠ link olan beslemelerde pencere içindeki ESKİ kalemler ilk gece (30 Eylül) yeni kimlikle YENİDEN yaratıldı:
// üretimde KLİMİK'te 7 başlık ikişer kez (ölçüm 2026-10-02; tjod / tatd / tgd-gastro / tgcd aynı sınıf).
// 🔑 DERS: kimlik anahtarının ÜRETİM KURALINI değiştirmek bir veri göçüdür — eski anahtar ya taşınır ya da okuma
// yolunda tanınır; ikisi de yapılmazsa pencere içindeki her kalem bir kez çiftlenir.

/** `NewsArticle.externalId` için RSS toplayıcısının kestiği uzunluk (sondan). */
export const RSS_EXTERNAL_ID_MAX = 180;

/** ESKİ kimlik: 1438e05 öncesi tek kural (guid'siz beslemelerde bugün de geçerli kimlik budur). */
export function legacyRssKey(link: string): string {
  return link.slice(-RSS_EXTERNAL_ID_MAX);
}

/** GÜNCEL kimlik: varsa `<guid>` (yazı düzenlense de değişmez), yoksa `<link>`. */
export function rssExternalId(guid: string, link: string): string {
  return (guid || link).slice(-RSS_EXTERNAL_ID_MAX);
}

export interface TwinRow {
  id: string;
  source: string;
  externalId: string;
  url: string | null;
  createdAt: Date;
}

export interface TwinPair<R extends TwinRow = TwinRow> {
  source: string;
  url: string;
  /** Link-anahtarlı ESKİ satır — kalır (gerçek ilk görülme tarihi + kaydetmeler onda). */
  keep: R;
  /** Guid-anahtarlı YENİ ikiz — silinir; anahtarı `keep`'e taşınır. */
  drop: R;
}

export interface TwinScan<R extends TwinRow = TwinRow> {
  pairs: TwinPair<R>[];
  /** Aynı kaynak + aynı URL ama beklenen biçimde olmayan gruplar — DOKUNULMAZ, yalnız raporlanır. */
  odd: { source: string; url: string; ids: string[]; reason: string }[];
}

/**
 * Aynı kaynak + aynı URL'li satır gruplarından kimlik-geçişi ikizlerini ayırır. Onarılabilir çift = TAM iki satır;
 * biri link-anahtarlı (externalId === legacyRssKey(url)), diğeri değil; link-anahtarlı olan daha eski. Bu kalıba uymayan
 * her grup (üç satır, iki link-anahtarlı, sıra ters…) `odd`'a düşer — tahminle silme YOK.
 */
export function scanRssTwins<R extends TwinRow>(rows: R[]): TwinScan<R> {
  const groups = new Map<string, R[]>();
  for (const r of rows) {
    if (!r.url) continue;
    const k = `${r.source}\n${r.url}`;
    const g = groups.get(k);
    if (g) g.push(r);
    else groups.set(k, [r]);
  }
  const out: TwinScan<R> = { pairs: [], odd: [] };
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const { source } = g[0];
    const url = g[0].url as string;
    const legacy = g.filter((r) => r.externalId === legacyRssKey(url));
    const rest = g.filter((r) => r.externalId !== legacyRssKey(url));
    const odd = (reason: string) => out.odd.push({ source, url, ids: g.map((r) => r.id), reason });
    if (g.length !== 2) odd(`${g.length} satır (beklenen 2)`);
    else if (legacy.length !== 1 || rest.length !== 1) odd(legacy.length === 0 ? "link-anahtarlı satır yok" : "iki satır da link-anahtarlı");
    else if (legacy[0].createdAt.getTime() > rest[0].createdAt.getTime()) odd("link-anahtarlı satır daha YENİ (beklenen: daha eski)");
    else out.pairs.push({ source, url, keep: legacy[0], drop: rest[0] });
  }
  return out;
}
