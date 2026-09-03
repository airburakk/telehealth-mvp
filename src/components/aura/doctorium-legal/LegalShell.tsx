import Link from "next/link";
import type { CSSProperties } from "react";
import { LandingFooterV3 } from "@/components/aura/doctorium-v3/Footer";
import {
  DOCTORIUM_LEGAL_DATE, DOCTORIUM_LEGAL_DATE_TR, DOCTORIUM_LEGAL_VERSION, DOCTORIUM_OPERATOR_LABEL, LEGAL_DOCS, type LegalDoc,
} from "@/lib/doctorium-legal";
import { LegalMarkdown } from "./LegalMarkdown";

// Doctorium hukuki sayfa kabuğu (v6.210 · 2026-09-03) — /doctorium/aydinlatma · kosullar · cerez ·
// icerik-politikasi · kvkk-basvuru ortak sarmalayıcısı. DoctoriumSignupShell ile aynı AÇIK zemin
// (#fbfbfa, landing V3 dünyası) ve zümrüt vurgu; bu rotalar CHROME_FREE_ROUTES'ta olduğundan AURA
// Header/SiteFooter girmez, alt bilgi LandingFooterV3'tür (hukuki bağlantı satırı footer'ın kendisinde).
//
// AURA izi taşımaz (ayrışma kararı): marka lockup'ı yalnız footer'da; üstte "Doctorium'a dön" +
// belge gezinmesi. Metin Türkçe (`lang="tr"`), Inter tek aile.
const EMERALD_VARS = {
  "--c-bg": "#fbfbfa",
  "--c-accent": "#047857",
  "--c-accent-strong": "#065f46",
  "--c-accent-stronger": "#059669",
} as CSSProperties;

export function LegalShell({ doc }: { doc: LegalDoc }) {
  return (
    <div lang="tr" className="theme-light flex min-h-dvh flex-col bg-[var(--c-bg)]" style={EMERALD_VARS}>
      <div className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
        <Link
          href="/doctorium"
          className="text-[13px] text-[var(--c-ink-3)] transition-colors duration-200 hover:text-[var(--c-accent)]"
        >
          ← Doctorium&apos;a dön
        </Link>

        <nav aria-label="Hukuki belgeler" className="mt-6 flex flex-wrap gap-2">
          {LEGAL_DOCS.map((d) => {
            const active = d.slug === doc.slug;
            return (
              <Link
                key={d.slug}
                href={d.path}
                aria-current={active ? "page" : undefined}
                className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${
                  active
                    ? "border-[var(--c-accent)] bg-[var(--c-accent)] text-white"
                    : "border-[var(--c-hairline)] text-[var(--c-ink-2)] hover:border-[var(--c-accent)] hover:text-[var(--c-accent)]"
                }`}
              >
                {d.navTitle}
              </Link>
            );
          })}
        </nav>

        <header className="mt-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--c-ink-3)]">Doctorium · hukuki belge</p>
          <h1 className="mt-2 text-2xl font-semibold leading-tight text-[var(--c-ink)] md:text-3xl">{doc.title}</h1>
          <p className="mt-3 text-[13px] text-[var(--c-ink-3)]">
            Sürüm {DOCTORIUM_LEGAL_VERSION} · <time dateTime={DOCTORIUM_LEGAL_DATE}>{DOCTORIUM_LEGAL_DATE_TR}</time> · {DOCTORIUM_OPERATOR_LABEL}
          </p>
        </header>

        <article className="mt-6">
          <LegalMarkdown markdown={doc.body} />
        </article>
      </div>
      <LandingFooterV3 />
    </div>
  );
}
