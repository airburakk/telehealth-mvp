import { AuraWordSvg, GlobalCareLine } from "@/components/AuraLogo";

// Letterform başlık (giriş/kurumsal kapı panel kolonu) — vitrinden taşındı
// (2026-07-12, v5.9 taşımasında atlanmıştı): "AURA" kelimesi metin yerine
// logo wordmark'ıyla yazılır — ana sayfadaki dev hero'nun küçük ölçekli
// karşılığı. Parçalar dile göre değişir: [wordBefore] / [wordmark + wordAfter]
// / [lineAfter]; boş parça render edilmez (EN "Welcome to AURA" söz dizimi).
//
// v6.137: 137×142px harf dilimleri (pikselleşiyordu) yerine VEKTÖR wordmark.
// v6.138 (2026-08-23, kullanıcı kararı): kapılar LOGOSUZ ve AURA bir kez yazılır —
// üstteki lockup kaldırıldı; "GLOBAL CARE" alt yazısı BU başlıktaki AURA'nın altına
// geldi (`globalCare` prop → GlobalCareLine, wordmark kutusuna hizalı). Braille site
// genelinden kaldırıldı (prop da yok).
//
// 🪤 wordAfter'a DİL EKİ / NOKTALAMA YAZMA (v6.13, ölçüldü): wordmark'ın doğal
// sağ boşluğu + aşağıdaki ml-1 ≈ 9-12px → "AURA 'ya" / "AURA ." gibi kopuk
// çizilir (aria-label doğru kalır, yani yalnız GÖZLE görünür — tsc/test
// yakalamaz). TR "AURA'ya hoş geldiniz" bu yüzden "AURA" / "Hoş geldiniz"e
// taşındı; ek/noktalama gerekiyorsa lineAfter'a (ayrı satır) yaz.
//
// Boyut: wordmark h-[0.9em] (dilimlerle aynı görsel büyüklük). GLOBAL CARE oranları H =
// harf yüksekliği = 0.9em / 1.0134 (kutu U taşmasını içerir) üzerinden hesaplanır.
export function WordHeadline({
  word,
  wordBefore,
  wordAfter,
  lineAfter,
  globalCare = false,
}: {
  word: string;
  wordBefore: string;
  wordAfter: string;
  lineAfter: string;
  globalCare?: boolean;
}) {
  const label = [wordBefore, word + (globalCare ? " Global Care" : "") + wordAfter, lineAfter]
    .filter(Boolean)
    .join(" ");

  return (
    <h1
      aria-label={label}
      className="aura-display mt-8 text-3xl font-bold leading-tight tracking-tight text-[var(--aura-ink)] md:text-4xl"
    >
      <span aria-hidden className="block">
        {wordBefore && <span className="block">{wordBefore}</span>}
        <span className="mt-2 inline-flex flex-col items-center">
          <span className="aura-word flex items-end gap-[0.14em]">
            {/* Wordmark + (varsa) GLOBAL CARE dikey grup: alt yazı wordmark kutusuna yayılır */}
            <span className="inline-flex flex-col items-stretch">
              <AuraWordSvg decorative className="h-[0.9em] w-auto" />
              {globalCare && <GlobalCareLine wordHeight="0.888em" />}
            </span>
            {wordAfter && <span className="ml-1">{wordAfter}</span>}
          </span>
        </span>
        {lineAfter && <span className="mt-2 block">{lineAfter}</span>}
      </span>
    </h1>
  );
}
