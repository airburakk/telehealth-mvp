// Ortak yardımcı modül (çalıştırılabilir script DEĞİL) — kongre kimlik üretimi.
//
// TEK KAYNAK: seed (seed-congresses.ts) ve mükerrer düzeltme (fix-congress-duplicates.ts)
// kimliği buradan üretir. İkisi ayrışırsa idempotentlik kırılır — v6.62-67'de yaşandı:
// kimlik `branş:ad` biçimindeydi, aynı kongre farklı branştan FARKLI kimlik aldı ve seed'in
// "branşları birleştir" güncelleme dalı hiç tetiklenmedi (prod: AATS × 2 satır).
//
// KİMLİK BRANŞSIZDIR (v6.68): aynı kongre birden çok branşın listesinde yer alabilir
// (ör. AATS = kvc + gogus-cerrahisi). Kimliğe branş girerse her branş kendi satırını
// yaratır; ad-tabanlı kimlik + seed'in branchSlugs birleşimi tek satırı garanti eder.

/** Kongre adından kararlı externalId (source="curated" ile birlikte benzersiz).
 *  tr-TR küçük harf + ASCII'leştirme + tire. ':' dahil hiçbir ayraç İÇERMEZ — eski biçim
 *  `branş:ad` idi; ':' varlığı düzeltme script'inde eski-biçim işareti olarak kullanılır. */
export function congressExternalId(name: string): string {
  return name
    .toLocaleLowerCase("tr-TR")
    .replace(/[ıİ]/g, "i").replace(/[şŞ]/g, "s").replace(/[ğĞ]/g, "g")
    .replace(/[üÜ]/g, "u").replace(/[öÖ]/g, "o").replace(/[çÇ]/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 180);
}
