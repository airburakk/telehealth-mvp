// Ortak yardımcı modül (çalıştırılabilir script DEĞİL) — KAYNAKLAR ARASI kongre eşleştirme.
//
// TEK KAYNAK: `merge-congress-sources.ts` adayı buradan alır; testler (tests/unit/
// congress-cross-source.test.ts) aynı fonksiyonu çağırır. Karar mantığı script'in içinde
// kalsaydı test edilemezdi — ve bu fonksiyonun yanlış "evet"i SESSİZ VERİ KAYBIDIR:
// birleştirme kaybeden satırı SİLER ve doktorun takibini kalan satıra TAŞIR. Yanlış eşleşme,
// hekimin takip ettiği kongreyi başka bir kongreye bağlar; hiçbir derleme/çalışma hatası vermez.
// (`congress-match.ts` ile aynı gerekçe — o modülün kendi test dosyası da bunu böyle anlatır.)
//
// SORUMLULUK SINIRI: burası "aday kim ve sinyaller ne diyor" sorusunu yanıtlar.
// EŞİKLER (skor/gün) ve yazma politikası script'te kalır — CLI'dan ayarlanabilir olmalılar
// (--esik / --gun) ve veritabanı yazımı saf mantıkla karışmamalı.
//
// AD BENZERLİĞİ YENİDEN TÜRETİLMEZ: `congress-match.ts`ten gelir. Kendi ölçütünü yazmak,
// bu aracın "aynı kongre" dediğine prune/merge araçlarının "farklı" demesi demektir.
import { congressExternalId } from "./congress-id";
import { bestMatch, identityKeyBase } from "./congress-match";

/** Eşleştirme için gereken en küçük satır sözleşmesi (Prisma satırı bunu KARŞILAR). */
export interface KongreSatiri {
  id: string;
  title: string;
  city: string | null;
  startDate: Date;
  endDate: Date | null;
}

export interface CaprazAday<T extends KongreSatiri> {
  sol: T;
  /** 1 = yapısal kimlik eşitliği · <1 = bulanık ad skoru (congress-match.bestMatch). */
  skor: number;
  yapisal: boolean;
  gunFark: number;
  /** İkisinde de şehir dolu VE farklı. Biri boşsa false (nötr) — şehir KAPI değil, doğrulayıcıdır. */
  sehirCelisiyor: boolean;
  /** İkisinde de bitiş dolu VE 2 günden fazla farklı. */
  bitisCelisiyor: boolean;
}

/** Bulanık yolun ALT sınırı — bunun altındaki aday hiç raporlanmaz (İNCELE bandına bile girmez). */
export const CAPRAZ_ALT_SINIR = 0.45;

const GUN = 86_400_000;

/** Yapısal kimlik — yıl + sondaki parantezli ek düşer, kalan ad kararlı slug'a iner. */
export const yapisalAnahtar = (baslik: string): string =>
  congressExternalId(identityKeyBase(baslik));

/** Şehir normalizasyonu. Parantezli ek atılır ("Kuzey Kıbrıs (KKTC)" → "kuzeykibris"):
 *  iki kaynak aynı yeri farklı yazıyor. Bu yüzden şehir DOĞRULAYICI sinyaldir, KAPI değil. */
export const normSehir = (s: string | null): string =>
  s
    ? s.toLocaleLowerCase("tr-TR")
        .replace(/[ıİ]/g, "i").replace(/[şŞ]/g, "s").replace(/[ğĞ]/g, "g")
        .replace(/[üÜ]/g, "u").replace(/[öÖ]/g, "o").replace(/[çÇ]/g, "c")
        .replace(/\(.*?\)/g, " ")
        .replace(/[^a-z]+/g, "")
    : "";

/** Yapısal kimlik dizini — aynı anahtara BİRDEN ÇOK satır düşerse o anahtar KULLANILMAZ
 *  (hangisi olduğunu yapısal kural söyleyemez; karar bulanık yola bırakılır). */
export function yapisalDizinKur<T extends KongreSatiri>(havuz: T[]): Map<string, T[]> {
  const dizin = new Map<string, T[]>();
  for (const s of havuz) {
    const k = yapisalAnahtar(s.title);
    if (!k) continue;
    const g = dizin.get(k);
    g ? g.push(s) : dizin.set(k, [s]);
  }
  return dizin;
}

/**
 * Bir TTB satırı için TTB-DIŞI havuzdan en olası eşi bul.
 *
 * İki yol, bu sırayla (merge-congress-research.ts ile aynı desen):
 *   1) YAPISAL — `congressExternalId(identityKeyBase(ad))` eşitliği. Bulanık kapının
 *      göremediği vakayı kesin çözer: ayırt edici belirteçlerin hepsi jenerik olduğunda
 *      ("…Türk Romatoloji Kongresi" ↔ "…(TURKROM)") IDF skoru düşük kalır ama yapısal
 *      anahtar birebir tutar.
 *   2) BULANIK — `bestMatch` ≥ CAPRAZ_ALT_SINIR, ARTI karşılıklı-en-iyi şartı: ters yönde
 *      de aynı çift çıkmalı. Bir TTB satırı iki küratörlü satıra da benziyorsa körlemesine
 *      birleştirmek veri kaybıdır.
 *
 * ⚠️ `solHavuz` TAM havuz olmalı, tarihle daraltılmış küçük bir alt küme DEĞİL: `bestMatch`
 *    IDF'i kendisine verilen havuzdan hesaplar ve küçük havuzda df anlamsızlaşır — "kanıt
 *    kapısı" (df ≤ 2 ⇒ nadir belirteç) işlevsiz kalır ve skorlar şişer. Tarih/şehir süzgeci
 *    aday BULUNDUKTAN SONRA, dönen sinyallere bakılarak uygulanır.
 *
 * Dönen `null` = aday yok. Eşik kararı ÇAĞIRANA aittir (skor + sinyaller birlikte okunur).
 */
export function caprazAdayBul<T extends KongreSatiri>(
  ttb: T,
  solHavuz: T[],
  ttbHavuz: T[],
  yapisalDizin: Map<string, T[]> = yapisalDizinKur(solHavuz),
): CaprazAday<T> | null {
  let sol: T | null = null;
  let skor = 1;
  let yapisal = true;

  const kume = yapisalDizin.get(yapisalAnahtar(ttb.title)) ?? [];
  if (kume.length === 1) {
    sol = kume[0];
  } else {
    const es = bestMatch(ttb.title, solHavuz, (r) => r.title);
    if (!es || es.score < CAPRAZ_ALT_SINIR) return null;
    const ters = bestMatch(es.item.title, ttbHavuz, (r) => r.title);
    if (!ters || ters.item.id !== ttb.id) return null; // karşılıklı-en-iyi değil
    sol = es.item;
    skor = es.score;
    yapisal = false;
  }

  const ss = normSehir(sol.city), ts = normSehir(ttb.city);
  return {
    sol,
    skor,
    yapisal,
    gunFark: Math.round(Math.abs(sol.startDate.getTime() - ttb.startDate.getTime()) / GUN),
    sehirCelisiyor: !!ss && !!ts && ss !== ts,
    bitisCelisiyor: !!(sol.endDate && ttb.endDate)
      && Math.abs(sol.endDate.getTime() - ttb.endDate.getTime()) / GUN > 2,
  };
}
