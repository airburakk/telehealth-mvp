import Link from "next/link";
import { section } from "@/lib/doctorium-landing/content";
import { LANDING_ROUTES } from "@/lib/doctorium-landing/routes";
import { ByAura } from "@/components/aura/doctorium-brand";
import { CtaLink } from "../CtaLink";
import { Eyebrow, LandingSection } from "../primitives";
import { Rich } from "../rich-text";

// FİNAL CTA (belge §14): feature yok, kart yok, dashboard yok; bol boşluk; tek baskın CTA;
// ikincil giriş; öğrenci için küçük yol. Video/ses YOK (sonic logo web'de otomatik çalmaz).
export function FinalCtaSection() {
  const copy = section("get-started");
  const primary = copy.ctas?.find((c) => c.primary);
  const login = copy.ctas?.find((c) => c.to === "login");
  const student = copy.ctas?.find((c) => c.to === "student");
  return (
    <LandingSection copy={copy} className="text-center">
      <div className="py-6">
        {/* Marka akan metinde tek düğüm (v6.140); lockup yalnız logoda. */}
        <Eyebrow caps={false}>Doctorium <ByAura light /></Eyebrow>
        <h2 className="aura-display mx-auto mt-4 max-w-[850px] text-[clamp(36px,5.4vw,64px)] font-medium leading-[1.02] tracking-tight">
          <Rich text={copy.title} />
        </h2>
        {copy.body && (
          <p className="mx-auto mt-5 max-w-[560px] text-[17px] leading-relaxed text-[var(--dl-body)]"><Rich text={copy.body} /></p>
        )}
        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          {primary && (
            <CtaLink href={LANDING_ROUTES.signup} variant="primary" event="create_doctorium_click" placement="final">
              <Rich text={primary.label} onEmerald />
            </CtaLink>
          )}
          {login && (
            <CtaLink href={LANDING_ROUTES.login} event="login_click" placement="final">
              {login.label}
            </CtaLink>
          )}
        </div>
        {student && (
          <p className="mt-6 text-[13px] text-[var(--dl-muted)]">
            <Link href={LANDING_ROUTES.student} className="underline-offset-4 hover:text-[var(--dl-ink)] hover:underline">{student.label}</Link>
          </p>
        )}
      </div>
    </LandingSection>
  );
}
