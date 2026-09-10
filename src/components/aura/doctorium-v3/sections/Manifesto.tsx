import { section } from "@/lib/doctorium-landing/content";
import { Rich } from "../rich-text";
import { FadeInUp } from "../motion";
import { LandingSection } from "../primitives";

// MANİFESTO — v2'de "derin koyu bant"tı; zebra kalktığı için v3'te AÇIK PANEL bandı (bir ton
// gri): durak hissi zeminle değil boşluk + büyük tipografiyle verilir.
export function ManifestoSection() {
  const copy = section("manifesto");
  const [a, b] = copy.title.split(". ");
  return (
    // v6.262 (👤 küçük paket): bölüm boşluğu yarıya — padded kapalı, kendi py'si (py-20/28 → py-10/14 + iç py-6 kalktı).
    <LandingSection copy={copy} tone="panel" padded={false} className="border-b border-[var(--dl-line)] py-10 lg:py-14">
      <FadeInUp>
        <div className="mx-auto max-w-[900px] text-center">
          <h2 className="text-[clamp(40px,7vw,88px)] font-medium leading-[1.02] tracking-[-0.03em]">
            {/* Aradaki {" "}: blok span'lar arasında metin düğümü yoksa textContent "değil.Sizin"
                olur (QA semantik bulgusu, v2'den taşındı). */}
            <span className="block text-[var(--dl-muted)]">{a}.</span>{" "}
            <span className="mt-3 block">{b}</span>
          </h2>
          {copy.body && (
            <p className="mx-auto mt-10 max-w-[560px] text-[18px] leading-relaxed text-[var(--dl-body)]"><Rich text={copy.body} /></p>
          )}
        </div>
      </FadeInUp>
    </LandingSection>
  );
}
