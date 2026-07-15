import { LETTERS } from "@/lib/aura-landing/copy";
import { AuraBraille } from "@/components/PortamedLogo";

// Letterform başlık (giriş/kurumsal kapı panel kolonu) — vitrinden taşındı
// (2026-07-12, v5.9 taşımasında atlanmıştı): "AURA" kelimesi metin yerine
// logo harf dilimleriyle yazılır — ana sayfadaki dev hero'nun küçük ölçekli
// karşılığı. Parçalar dile göre değişir: [wordBefore] / [dilimler + wordAfter]
// / [lineAfter]; boş parça render edilmez (EN "Welcome to AURA" söz dizimi).
//
// 🪤 wordAfter'a DİL EKİ / NOKTALAMA YAZMA (v6.13, ölçüldü): harf dilimlerinin
// doğal sağ boşluğu + aşağıdaki ml-1 ≈ 9-12px → "AURA 'ya" / "AURA ." gibi
// kopuk çizilir (aria-label doğru kalır, yani yalnız GÖZLE görünür — tsc/test
// yakalamaz). TR "AURA'ya hoş geldiniz" bu yüzden "AURA" / "Hoş geldiniz"e
// taşındı; ek/noktalama gerekiyorsa lineAfter'a (ayrı satır) yaz.
// wordAfter yalnız dilimlere BİTİŞİK durması sorun olmayan parçalar için.
// braille=true → "AURA" letterform'un TAM ALTINA hizalı Braille (marka kuralı:
// Braille daima AURA yazısının altında — [[aura-braille-under-wordmark]]).
export function WordHeadline({
  word,
  wordBefore,
  wordAfter,
  lineAfter,
  braille = false,
}: {
  word: string;
  wordBefore: string;
  wordAfter: string;
  lineAfter: string;
  braille?: boolean;
}) {
  const label = [wordBefore, word + wordAfter, lineAfter].filter(Boolean).join(" ");

  return (
    <h1
      aria-label={label}
      className="aura-display mt-8 text-3xl font-bold leading-tight tracking-tight text-[var(--aura-ink)] md:text-4xl"
    >
      <span aria-hidden className="block">
        {wordBefore && <span className="block">{wordBefore}</span>}
        {/* "AURA" letterform + (varsa) Braille dikey grup: Braille harflerin
            altında ortalı = AURA yazısının TAM ALTINDA (marka kuralı). */}
        <span className="mt-2 inline-flex flex-col items-center">
          <span className="aura-word flex items-end gap-[0.14em]">
            {LETTERS.map((letter) => (
              <img
                key={letter}
                src={`/assets/letters/${letter}.png`}
                alt=""
                draggable={false}
                className="h-[0.9em] w-auto"
              />
            ))}
            {wordAfter && <span className="ml-1">{wordAfter}</span>}
          </span>
          {braille && <AuraBraille height={12} className="mt-2.5 text-[var(--aura-micro)]" />}
        </span>
        {lineAfter && <span className="mt-2 block">{lineAfter}</span>}
      </span>
    </h1>
  );
}
