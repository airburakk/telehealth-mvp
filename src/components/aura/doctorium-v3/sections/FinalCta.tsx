import { GraduationCap } from "lucide-react";
import { section } from "@/lib/doctorium-landing/content";
import { LANDING_ROUTES } from "@/lib/doctorium-landing/routes";
import { TRIAL_LANDING_LINE } from "@/lib/doctorium-trial-copy";
import { isTrialEnabled } from "@/lib/doctorium-trial-flag";
import { CtaLink } from "../CtaLink";
import { Rich } from "../rich-text";
import { FadeInUp } from "../motion";
import { Eyebrow, LandingSection } from "../primitives";

export function FinalCtaSection() {
  const copy = section("get-started");
  const primary = copy.ctas?.find((c) => c.primary);
  const login = copy.ctas?.find((c) => c.to === "login");
  const student = copy.ctas?.find((c) => c.to === "student");
  // v6.262: deneme satırı yalnız bayrak açıkken (env iki projeye ayrı girer); metin tek kaynak doctorium-trial-copy.
  const trial = isTrialEnabled();
  return (
    <LandingSection copy={copy} className="text-center">
      <FadeInUp>
        <div className="py-6">
          <Eyebrow>Doctorium</Eyebrow>
          <h2 className="mx-auto mt-4 max-w-[850px] text-[clamp(36px,5.4vw,64px)] font-medium leading-[1.05] tracking-[-0.02em]">
            <Rich text={copy.title} />
          </h2>
          {copy.body && (
            <p className="mx-auto mt-5 max-w-[560px] text-[17px] leading-relaxed text-[var(--dl-body)]"><Rich text={copy.body} /></p>
          )}
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            {primary && (
              <CtaLink href={LANDING_ROUTES.signup} variant="primary" event="create_doctorium_click" placement="final">
                <Rich text={primary.label} />
              </CtaLink>
            )}
            {login && (
              <CtaLink href={LANDING_ROUTES.login} event="login_click" placement="final">
                {login.label}
              </CtaLink>
            )}
            {student && (
              // v6.262 (👤 Karar 3 · C): 13px gri satırdan İKİNCİL DÜĞMEYE — çerçeve koral (öğrenci kulvarı), metin
              // mürekkep (koral metin açık zeminde AA altı); etiket content.ts'ten, kep ikonu lucide.
              <CtaLink href={LANDING_ROUTES.student} variant="student-outline" event="student_click" placement="final">
                <GraduationCap size={16} aria-hidden className="text-[var(--dl-coral)]" />
                {student.label}
              </CtaLink>
            )}
          </div>
          {trial && <p className="mt-6 text-[13px] text-[var(--dl-muted)]">{TRIAL_LANDING_LINE}</p>}
        </div>
      </FadeInUp>
    </LandingSection>
  );
}
