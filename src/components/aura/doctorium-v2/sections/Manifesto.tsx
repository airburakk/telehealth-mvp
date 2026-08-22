import { section } from "@/lib/doctorium-landing/content";
import { LandingSection } from "../primitives";
import { Rich } from "../rich-text";

// MANİFESTO (belge §3): görsel nefes — derin koyu bant, iki cümle, başka hiçbir şey.
export function ManifestoSection() {
  const copy = section("manifesto");
  const [a, b] = copy.title.split(". ");
  return (
    <LandingSection copy={copy} className="border-y border-[var(--dl-line)]">
      <div className="mx-auto max-w-[900px] py-6 text-center">
        <h2 className="aura-display text-[clamp(40px,7vw,88px)] font-medium leading-[0.98] tracking-tight">
          <span className="block text-[var(--dl-muted)]">{a}.</span>
          <span className="mt-3 block">{b}</span>
        </h2>
        {copy.body && (
          <p className="mx-auto mt-10 max-w-[560px] text-[18px] leading-relaxed text-[var(--dl-body)]"><Rich text={copy.body} /></p>
        )}
      </div>
    </LandingSection>
  );
}
