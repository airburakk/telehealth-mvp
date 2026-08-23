import { AuraBraille, AuraWordSvg } from "@/components/AuraLogo";

// Letterform başlık (giriş/kurumsal kapı panel kolonu) — vitrinden taşındı
// (2026-07-12, v5.9 taşımasında atlanmıştı): "AURA" kelimesi metin yerine
// logo wordmark'ıyla yazılır — ana sayfadaki dev hero'nun küçük ölçekli
// karşılığı. Parçalar dile göre değişir: [wordBefore] / [wordmark + wordAfter]
// / [lineAfter]; boş parça render edilmez (EN "Welcome to AURA" söz dizimi).
//
// v6.137 (2026-08-23): 137×142px harf dilimleri (public/assets/letters, büyütülünce
// PİKSELLEŞİYORDU — kullanıcı bildirimi) yerine VEKTÖR wordmark (AuraWordSvg).
// Yükseklik h-[0.9em] korundu (dilimlerin harf yüksekliğiyle aynı görsel büyüklük).
//
// 🪤 wordAfter'a DİL EKİ / NOKTALAMA YAZMA (v6.13, ölçüldü): wordmark'ın doğal
// sağ boşluğu + aşağıdaki ml-1 ≈ 9-12px → "AURA 'ya" / "AURA ." gibi kopuk
// çizilir (aria-label doğru kalır, yani yalnız GÖZLE görünür — tsc/test
// yakalamaz). TR "AURA'ya hoş geldiniz" bu yüzden "AURA" / "Hoş geldiniz"e
// taşındı; ek/noktalama gerekiyorsa lineAfter'a (ayrı satır) yaz.
// braille=true → "AURA" wordmark'ının TAM ALTINA hizalı Braille (marka kuralı:
// Braille daima AURA yazısının altında — [[aura-braille-under-wordmark]]).
// Kapılarda braille artık AuraLockup'ta (GLOBAL CARE altında) → burada KAPALI.
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
        {/* "AURA" wordmark + (varsa) Braille dikey grup: Braille harflerin
            altında ortalı = AURA yazısının TAM ALTINDA (marka kuralı). */}
        <span className="mt-2 inline-flex flex-col items-center">
          <span className="aura-word flex items-end gap-[0.14em]">
            <AuraWordSvg decorative className="h-[0.9em] w-auto" />
            {wordAfter && <span className="ml-1">{wordAfter}</span>}
          </span>
          {braille && <AuraBraille height={12} className="mt-2.5 text-[var(--aura-micro)]" />}
        </span>
        {lineAfter && <span className="mt-2 block">{lineAfter}</span>}
      </span>
    </h1>
  );
}
