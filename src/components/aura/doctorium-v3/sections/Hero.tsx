import Link from "next/link";
import { DOCTORIUM_PALETTE } from "@/components/aura/doctorium-brand";
import { DoctoriumBgVideo } from "@/components/aura/doctorium-bg-video";
import { section, HERO_PROOF_LINE } from "@/lib/doctorium-landing/content";
import { LANDING_ROUTES } from "@/lib/doctorium-landing/routes";
import { Rich } from "../../doctorium-v2/rich-text";
import { FadeInUp } from "../motion";
import { Eyebrow } from "../primitives";
import { buttonVariants } from "../ui/button";

// V3 Hero — VİDEO ZEMİNLİ (kullanıcı 2026-08-26: "bundan önce kullandığımız hero videosunu
// arkaya yerleştir"): v1 landing'in film13 arka planı (DoctoriumBgVideo — IO'da oynat,
// Save-Data/reduced-motion'da poster, ofis sekansı üst-anchor, AI şeffaflık rozeti dahil)
// v1'in skrimiyle birebir taşındı. v1 kararı da taşındı: video oynarken sağda ürün kartı
// KALABALIKTI → tek kolon metin, sağ yarı videoya açık ("Bugün sizin için" önizlemesi zaten
// Today bölümünde). Video koyu sahne olduğundan bu bölüm DOCTORIUM_PALETTE ile koyu-metin
// dünyasında yaşar — sayfanın kalan 13 bölümü açık; zemin düz koyu DEĞİL, filmdir.
// LandingSection KULLANILMAZ: bölüm bg'si videoyu örterdi; isolate + kendi section'ı.
// (id="hero" MobileStickyCta'nın gözlediği çapa; data-section analytics section_view.)
export function HeroSection() {
  const copy = section("hero");
  const primary = copy.ctas?.find((c) => c.primary);
  const secondary = copy.ctas?.find((c) => !c.primary);
  return (
    <section
      id="hero"
      data-section="hero"
      style={DOCTORIUM_PALETTE}
      // bg fallback: poster/video inene dek düz koyu — CSS boyama sırası gereği -z-10 video
      // kendi stacking context'inde (isolate) section zemininin ÜSTÜNE çizilir.
      className="relative isolate overflow-hidden bg-[#0d0e10] text-[var(--dl-ink)] scroll-mt-4 md:scroll-mt-24"
    >
      <DoctoriumBgVideo overlay="linear-gradient(to top, rgba(13,14,16,.93) 0%, rgba(13,14,16,.58) 45%, rgba(13,14,16,.38) 100%)" />
      <div className="mx-auto w-full max-w-6xl px-5 pb-28 pt-20 lg:pb-40 lg:pt-32">
        <FadeInUp>
          {copy.eyebrow && <Eyebrow>{copy.eyebrow}</Eyebrow>}
          <h1 className="mt-5 max-w-[820px] text-[clamp(42px,5.6vw,72px)] font-medium leading-[1.05] tracking-[-0.03em]">
            <Rich text={copy.title} />
          </h1>
          {copy.lead && (
            <p className="mt-7 max-w-[560px] text-[19px] leading-relaxed text-[var(--dl-body)]"><Rich text={copy.lead} /></p>
          )}
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            {primary && (
              <Link href={LANDING_ROUTES.signup} className={buttonVariants({ variant: "primary" })}>
                <Rich text={primary.label} />
              </Link>
            )}
            {secondary && (
              <Link href={secondary.to as string} className={buttonVariants({ variant: "secondary" })}>
                <Rich text={secondary.label} />
              </Link>
            )}
          </div>
          {copy.note && <p className="mt-5 text-xs text-[var(--dl-muted)]">{copy.note}</p>}
          <p className="mt-10 flex flex-wrap gap-x-3 gap-y-1 text-[12px] tracking-[0.02em] text-[var(--dl-muted)]">
            {HERO_PROOF_LINE.map((p, i) => (
              <span key={p} className="inline-flex items-center gap-3">
                {i > 0 && <span aria-hidden className="text-[var(--dl-emerald)]">·</span>}
                {p}
              </span>
            ))}
          </p>
        </FadeInUp>
      </div>
    </section>
  );
}
