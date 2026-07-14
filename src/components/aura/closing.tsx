"use client";

import Link from "next/link";
import { AuraMark, AuraBraille } from "@/components/PortamedLogo";
import { useLang, LINKS } from "@/lib/aura-landing/i18n";

// Kapanis v2: gece paneli (22px radius — Sign Up panel dili) icinde kisa
// baslik + CTA. Kapanis CTA giysisi: genis panel-bant butonu; hover'da tum
// bant hafif yana kayar ve turkuaz kenar cizgisi dolar. Altinda koyu footer.
export function AuraClosing() {
  const { t } = useLang();

  return (
    <>
      <section className="mx-auto max-w-6xl px-5 pb-24 md:px-8">
        <div className="relative overflow-hidden rounded-[22px] border border-[var(--aura-hairline)] bg-[var(--aura-panel)] px-6 py-20 text-center md:py-24">
          <h2 className="aura-display text-4xl font-bold leading-none tracking-tighter text-[var(--aura-ink)] md:text-6xl">
            {t.closing.headline}
          </h2>
          <div className="mt-10 flex justify-center">
            <Link
              href="/giris"
              className="group relative inline-flex items-center gap-3 overflow-hidden rounded-full border border-[var(--aura-accent)]/60 px-8 py-4 text-base font-semibold text-[var(--aura-ink)] transition-transform duration-200 hover:translate-x-1 active:scale-[0.98]"
            >
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-1 bg-[var(--aura-accent)] transition-all duration-300 group-hover:w-full group-hover:opacity-15"
              />
              <span className="relative">{t.closing.cta}</span>
              <svg
                aria-hidden
                viewBox="0 0 16 16"
                className="relative h-4 w-4 text-[var(--aura-accent)] transition-transform duration-300 group-hover:translate-x-1.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M2 8h10M8 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      <AuraFooter />
    </>
  );
}

function AuraFooter() {
  const { t } = useLang();
  const f = t.footer;

  return (
    <footer className="border-t border-[var(--aura-hairline)] bg-[var(--aura-bg)]">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-[2fr_1fr_1fr] md:px-8">
        <div>
          {/* Braille "AURA" wordmark'ın TAM ALTINDA, ortalı hizalı (marka kuralı:
              Braille daima AURA yazısının altında — [[aura-braille-under-wordmark]]). */}
          <div className="flex items-center gap-2.5">
            <AuraMark size={36} />
            <span className="inline-flex flex-col items-center">
              <img src="/assets/aura-word-dark.png" alt="AURA" className="h-4 w-auto" />
              <AuraBraille height={9} className="mt-1.5 text-[var(--aura-micro)]" />
            </span>
          </div>
          <p className="mt-4 max-w-[38ch] text-sm leading-relaxed text-[var(--aura-grey)]">
            {t.chapters[0].body}
          </p>
        </div>
        <div>
          <p className="aura-display text-sm font-bold">{f.platform}</p>
          <ul className="mt-3 space-y-2 text-sm text-[var(--aura-grey)]">
            <li>
              <FooterLink href={LINKS.platformLogin} label={f.patientLogin} />
            </li>
            <li>
              <FooterLink href={LINKS.platformSignup} label={f.patientSignup} />
            </li>
            <li>
              {/* Kurumsal giris artik vitrinin kendi rol-secicili sayfasindan */}
              <Link
                href="/kurumsal-giris"
                className="transition-colors duration-200 hover:text-[var(--aura-accent)]"
              >
                {f.corporateLogin}
              </Link>
            </li>
            <li>
              <FooterLink href={LINKS.doctorSignup} label={f.doctorSignup} />
            </li>
          </ul>
        </div>
        <div>
          <p className="aura-display text-sm font-bold">{f.explore}</p>
          {/* Capalar kok-goreli: footer /how-it-works sayfasinda da render edilir. */}
          <ul className="mt-3 space-y-2 text-sm text-[var(--aura-grey)]">
            <li>
              <FooterLink href="/#ch-consult" label={f.telehealth} />
            </li>
            <li>
              <FooterLink href="/#ch-tourism" label={f.tourism} />
            </li>
            <li>
              <FooterLink href="/#doctors" label={f.doctors} />
            </li>
            <li>
              <Link
                href="/how-it-works"
                className="transition-colors duration-200 hover:text-[var(--aura-accent)]"
              >
                {t.nav.how}
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[var(--aura-hairline)]">
        <p className="aura-mono mx-auto max-w-6xl px-5 py-5 text-[11px] text-[var(--aura-micro)] md:px-8">
          {f.legal}
        </p>
      </div>
    </footer>
  );
}

function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="transition-colors duration-200 hover:text-[var(--aura-accent)]">
      {label}
    </a>
  );
}
