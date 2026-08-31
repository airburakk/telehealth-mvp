import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Akış sayfalama çubuğu (v6.192) — sonsuz kaydırmanın (FeedLoadMore) yerini alır.
 * Kullanıcı kararı 2026-08-31: sayfa 40 kalemle sınırlanır, devamı sayfa numarasıyla gezilir.
 *
 * ⚠️ NEDEN SIRALI (1→2→3), NEDEN "5. sayfaya atla" YOK: akış sekiz modülü AYRI sorgulayıp
 * birleştiriyor ve `personalFeedPage` MODÜL BAŞINA imleç taşıyor (bkz. o fonksiyonun üstündeki
 * "global cursor sessiz veri kaybı" uyarısı). Numaralı atlama offset (`skip`) ister; offset,
 * modül-birleştirme + interleaveByModule çeşitlilik geçişinin üstünde tanımsızdır ve sayfalar
 * arası tekrar/boşluk üretir. Sıralı gezinmede her sayfa kendi imleciyle sunucuda render edilir.
 *
 * Bileşen SUNUCU tarafındadır (client JS yok): her bağlantı gerçek bir URL, sayfa paylaşılabilir
 * ve tarayıcının geri düğmesi kendiliğinden çalışır.
 *
 * "Önceki" bağlantısı YALNIZ doğru hedef hesaplanabildiğinde çizilir:
 *   · sayfa 2  → ilk sayfa (imleçsiz taban URL) — daima doğru
 *   · sayfa 3+ → `?onceki=` ile taşınan bir önceki imleç varsa o
 * Aksi hâlde (ör. derin bir sayfa URL'i paylaşılmışsa) yanlış yere götüren bir bağlantı
 * çizmek yerine "İlk sayfa" gösterilir — kullanıcıyı sessizce başka içeriğe düşürmek yerine.
 */

type SearchParams = Record<string, string | undefined>;

const BASE = "/doktor/doctorium";
/** Sayfalamanın KENDİ parametreleri — href kurulurken üzerine yazılır, kopyalanmaz. */
const PAGER_KEYS = new Set(["sayfa", "imlec", "onceki"]);

/**
 * Mevcut görünümün tüm parametrelerini (sekme, branş odağı, "yalnız yeni", modül odağı, arama…)
 * KORUYARAK sayfalama parametrelerini değiştirir. Allowlist yerine "bizimkiler hariç hepsini
 * kopyala" deseni bilinçli: ileride yeni bir süzgeç parametresi eklendiğinde sayfa 2'de sessizce
 * düşmesin (allowlist unutulur, bu desen unutulmaz).
 */
function pagerHref(sp: SearchParams, next: { sayfa?: number; imlec?: string; onceki?: string }): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (PAGER_KEYS.has(k)) continue;
    if (typeof v === "string" && v) qs.set(k, v);
  }
  if (next.sayfa && next.sayfa > 1) qs.set("sayfa", String(next.sayfa));
  if (next.imlec) qs.set("imlec", next.imlec);
  if (next.onceki) qs.set("onceki", next.onceki);
  const q = qs.toString();
  return q ? `${BASE}?${q}` : BASE;
}

const LINK_CLS =
  "aura-mono inline-flex items-center gap-1 rounded-lg border border-[var(--c-hairline)] px-3 py-2 text-[11px] font-semibold tracking-[0.12em] text-[var(--c-ink-2)] transition-colors hover:border-emerald-400/60 hover:text-emerald-300";

export function FeedPager({
  sp,
  page,
  nextCursor,
  currentCursor,
  prevCursor,
}: {
  sp: SearchParams;
  /** Görüntülenen sayfa (1 tabanlı). */
  page: number;
  /** Sunucunun bu sayfadan sonrası için verdiği imleç; null = akışın sonu. */
  nextCursor: string | null;
  /** BU sayfayı üreten imleç — sonraki sayfaya `onceki` olarak taşınır ki oradan geri dönülebilsin. */
  currentCursor: string | null;
  /** URL'den gelen bir önceki sayfanın imleci (varsa). */
  prevCursor: string | null;
}) {
  const firstHref = pagerHref(sp, {});
  const prevHref =
    page <= 1 ? null : page === 2 ? firstHref : prevCursor ? pagerHref(sp, { sayfa: page - 1, imlec: prevCursor }) : null;

  return (
    <li className="mt-2 list-none">
      <nav
        aria-label="Akış sayfaları"
        className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--c-hairline)] pt-5"
      >
        <div className="flex items-center gap-2">
          {prevHref ? (
            <Link href={prevHref} className={LINK_CLS} rel="prev">
              <ChevronLeft size={13} aria-hidden /> ÖNCEKİ
            </Link>
          ) : page > 1 ? (
            <Link href={firstHref} className={LINK_CLS}>
              <ChevronLeft size={13} aria-hidden /> İLK SAYFA
            </Link>
          ) : null}
        </div>

        <span
          aria-current="page"
          className="aura-mono text-[11px] font-bold tracking-[0.14em] text-[var(--c-ink)]"
        >
          SAYFA {page}
        </span>

        <div className="flex items-center gap-2">
          {nextCursor ? (
            <Link
              href={pagerHref(sp, { sayfa: page + 1, imlec: nextCursor, onceki: currentCursor ?? undefined })}
              className={LINK_CLS}
              rel="next"
            >
              SONRAKİ <ChevronRight size={13} aria-hidden />
            </Link>
          ) : (
            <span className="aura-mono text-[11px] font-semibold tracking-[0.12em] text-[var(--c-ink-3)]">
              AKIŞIN SONU
            </span>
          )}
        </div>
      </nav>
    </li>
  );
}
