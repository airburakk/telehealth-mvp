import { section, HERO_PROOF_LINE } from "@/lib/doctorium-landing/content";
import { LANDING_ROUTES } from "@/lib/doctorium-landing/routes";
import { DEFAULT_DEMO_MODULES, FEED_MODULE_LABEL, landingBranchLabel } from "@/lib/doctorium-landing/taxonomy";
import type { LandingSample } from "@/lib/doctorium-landing/landing-feed";
import { pickOnePerModule } from "@/lib/doctorium-landing/pick";
import { CtaLink } from "../CtaLink";
import { FeedPreview } from "../FeedPreview";
import { ProductFrame } from "../ProductFrame";
import { Eyebrow, LandingSection } from "../primitives";
import { Rich } from "../rich-text";

// HERO (belge §1 wireframe): sol — eyebrow · tek H1 · lead · CTA çifti · not · kanıt satırı;
// sağ — GERÇEK ürün görünümü (ProductFrame + ArticleCard), laptop mockup'ına hapsedilmez.
// Video/AI/platform/network kelimeleri bilinçli YOK. Hareket yok (hero'da prizma/ışıma kalktı).
export function HeroSection({ sample }: { sample: LandingSample }) {
  const copy = section("hero");
  const primary = copy.ctas?.find((c) => c.primary);
  const secondary = copy.ctas?.find((c) => !c.primary);
  return (
    <LandingSection copy={copy} padded={false}>
      <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-12 pb-20 pt-16 lg:grid-cols-[1.05fr_.95fr] lg:gap-16 lg:pb-28 lg:pt-24">
        <div>
          {copy.eyebrow && <Eyebrow>{copy.eyebrow}</Eyebrow>}
          <h1 className="aura-display mt-5 max-w-[620px] text-[clamp(42px,5.6vw,72px)] font-medium leading-[1.02] tracking-tight">
            <Rich text={copy.title} />
          </h1>
          {copy.lead && (
            <p className="mt-7 max-w-[560px] text-[19px] leading-relaxed text-[#b9bdc1]"><Rich text={copy.lead} /></p>
          )}
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            {primary && (
              <CtaLink href={LANDING_ROUTES.signup} variant="primary" event="create_doctorium_click" placement="hero">
                <Rich text={primary.label} onEmerald />
              </CtaLink>
            )}
            {secondary && (
              <CtaLink href={secondary.to as string} event="how_it_works_click" placement="hero">
                <Rich text={secondary.label} /> <span aria-hidden>↓</span>
              </CtaLink>
            )}
          </div>
          {copy.note && <p className="mt-5 text-xs text-[#777c82]">{copy.note}</p>}
          <p className="aura-mono mt-10 flex flex-wrap gap-x-3 gap-y-1 text-[11px] tracking-[0.08em] text-[#9da1a6]">
            {HERO_PROOF_LINE.map((p, i) => (
              <span key={p} className="inline-flex items-center gap-3">
                {i > 0 && <span aria-hidden className="text-[var(--dl-emerald)]">·</span>}
                {p}
              </span>
            ))}
          </p>
        </div>

        <HeroPreview sample={sample} />
      </div>
    </LandingSection>
  );
}

/** Sağ kolon: "Bugün sizin için" başlığı + bölüm sayaçları + 2 gerçek kart. Sayı = gerçek sayım;
 *  0 ise sayı yazılmaz (ölçülmemiş/şişirilmiş iddia yok). Fixture'da "örnek" etiketi görünür. */
function HeroPreview({ sample }: { sample: LandingSample }) {
  const n = sample.todayTotal;
  return (
    <ProductFrame title="Akışım" meta={landingBranchLabel(sample.branch)}>
      <div className="flex items-end justify-between gap-3 border-b border-[var(--c-hairline)] pb-3">
        <div>
          <div className="aura-mono text-[11px] uppercase tracking-[0.2em] text-emerald-300">Bugün sizin için</div>
          <div className="aura-display mt-1 text-[26px] font-medium leading-none tracking-tight text-[var(--c-ink)]">
            {n > 0 ? `${n} yeni içerik` : "Son eklenenler"}
          </div>
        </div>
        {sample.source === "fixture" && (
          <span className="aura-mono text-[10px] text-[var(--c-ink-3)]">örnek içerik</span>
        )}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
        {DEFAULT_DEMO_MODULES.map((m) => {
          const c = sample.todayByModule[m] ?? 0;
          return (
            <li key={m} className="flex items-center justify-between border-b border-[var(--c-hairline)] py-1.5">
              <span className="text-[var(--c-ink-2)]">{FEED_MODULE_LABEL[m]}</span>
              <span className="aura-mono text-[11px] text-[var(--c-ink-3)]">{c > 0 ? `${c} yeni` : "→"}</span>
            </li>
          );
        })}
      </ul>
      <div className="mt-2">
        {/* QA DESK-02: ilk görünümde TÜR çeşitliliği (akademik · etkinlik/hukuk · regülasyon) —
            birbirinin benzeri iki ClinicalTrials kartı üst üste gelmesin; 3 kart (mobilde de kısa). */}
        <FeedPreview items={pickOnePerModule(sample.items, sample.branch, 3)} branch={sample.branch} why={false} />
      </div>
    </ProductFrame>
  );
}
