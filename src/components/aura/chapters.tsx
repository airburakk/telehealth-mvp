"use client";

import Link from "next/link";

// v6.19 TEMİZLİK NOTU: Bu dosya eskiden 4 sahnelik "3D Roll chapter destesi"ni
// (AuraChapters) taşıyordu — o bileşen ESKİ landing'le (AuraLanding) birlikte
// emekli edildi (V2 taşıması 2026-07-16; videolar artık entry-paths'in arkasında).
// Geri dönüş: tag `landing-eski-v5.9-son`. Kalan iki export CANLI:
// how-it-works rehber bölümleri ChapterData + ChapterCta kullanır.
export type ChapterData = {
  n: string;
  key: string;
  strand: string;
  title: string;
  body: string;
  cta: string;
  href: string;
  external: boolean;
};

// Chapter CTA giysisi: mono makara-okuma — "01 → etiket"; hover'da rakam bir
// tur yuvarlanir (rotateX 360) ve altcizgi turkuaza akar. How-It-Works rehber
// bolumleri bu giysiyi kullanir (ayni etiket = ayni niyet).
export function ChapterCta({ c }: { c: ChapterData }) {
  const inner = (
    <>
      <span
        aria-hidden
        className="aura-mono inline-block text-[15px] text-[var(--aura-accent)] transition-transform duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateX(360deg)]"
      >
        {c.n}
      </span>
      <span aria-hidden className="aura-mono text-[15px] text-[var(--aura-grey)]">
        {"→"}
      </span>
      <span className="aura-mono relative text-[15px] text-[var(--aura-ink)]">
        {c.cta}
        <span
          aria-hidden
          className="absolute -bottom-1 left-0 h-px w-full bg-[var(--aura-grey)]/50 transition-colors duration-300 group-hover:bg-[var(--aura-accent)]"
        />
      </span>
    </>
  );

  return c.external ? (
    <a href={c.href} className="group inline-flex items-center gap-2.5">
      {inner}
    </a>
  ) : (
    <Link href={c.href} className="group inline-flex items-center gap-2.5">
      {inner}
    </Link>
  );
}
