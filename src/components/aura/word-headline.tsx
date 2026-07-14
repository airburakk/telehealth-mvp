import { LETTERS } from "@/lib/aura-landing/copy";
import { AuraBraille } from "@/components/PortamedLogo";

// Letterform başlık (giriş/kurumsal kapı panel kolonu) — vitrinden taşındı
// (2026-07-12, v5.9 taşımasında atlanmıştı): "AURA" kelimesi metin yerine
// logo harf dilimleriyle yazılır — ana sayfadaki dev hero'nun küçük ölçekli
// karşılığı. Parçalar dile göre değişir: [wordBefore] / [dilimler + wordAfter]
// / [lineAfter]; boş parça render edilmez (EN "Welcome to AURA" · TR
// "AURA'ya hoş geldiniz" söz dizimi).
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
