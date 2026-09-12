"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AuraClosing } from "@/components/aura/closing";
import { AuraWordText } from "@/components/aura/aura-word";
import { V2Nav } from "@/components/aura/v2/nav";
import { LangProvider, langDir, useLang } from "@/lib/aura-landing/i18n";
import {
  AURA_LEGAL_DATE,
  AURA_LEGAL_DATE_LABEL,
  AURA_LEGAL_PUBLISHED,
  AURA_LEGAL_VERSION,
  AURA_OPERATOR_LABEL,
  auraLegalHref,
  auraLegalRoute,
  type AuraLegalLang,
  type AuraLegalSlug,
} from "@/lib/aura-legal/routes";

// AURA hukuki belge kabuğu (kod Paket A, v6.268 · 2026-09-13) — /aydinlatma · /kosullar · /cerez · /kvkk-basvuru
// (· /tele-saglik yayın bayrağıyla). Vitrin dünyası: /guven-ve-gizlilik ile aynı desen (LangProvider + V2Nav + AuraClosing;
// rota CHROME_FREE_ROUTES'ta → global Header/SiteFooter girmez). Gövde AÇIK şerit (.aura-light): uzun hukuki metin gece
// zemininde okunmaz; landing'in gündüz sandwich'iyle aynı token geçişi.
//
// İki dil ekseni bilinçle AYRI: nav/footer 9 arayüz dilinde air_lang'ı izler; belge yalnız TR kanonik + EN ikinci kanonik
// (S4 kararı, `?lang=en`; canonical TR, hreflang alternatifi sayfa metadata'sında). Diğer arayüz dillerinde "TR/EN esastır"
// notu. Gövde `dir="ltr"` + kendi `lang`ı taşır (Arapça/Farsça arayüzde belge sağa yaslanmasın).
//
// Metin içi AURA = wordmark kuralı (2026-08-17) yalnız kabuğun vitrin satırında (işletici etiketi) uygulanır; belge gövdesi
// düz metindir — Paket B'de aynı dize hash'lenir, görsel ikame yapılmaz.
const UI: Record<
  AuraLegalLang,
  { eyebrow: string; version: string; operator: string; note: string; nav: string; langGroup: string; tr: string; en: string }
> = {
  tr: {
    eyebrow: "Hukuki belge",
    version: "Sürüm",
    operator: "İşletici",
    note: "Bu belge Türkçe ve İngilizce yayımlanır; çelişki hâlinde Türkçe metin esastır. Diğer arayüz dillerinde de TR/EN metin geçerlidir.",
    nav: "Hukuki belgeler",
    langGroup: "Belge dili",
    tr: "Türkçe",
    en: "English",
  },
  en: {
    eyebrow: "Legal document",
    version: "Version",
    operator: "Operator",
    note: "This document is published in Turkish and English; in case of conflict the Turkish text prevails. The TR/EN text also applies in the other interface languages.",
    nav: "Legal documents",
    langGroup: "Document language",
    tr: "Türkçe",
    en: "English",
  },
};

export function AuraLegalShell({ slug, lang, children }: { slug: AuraLegalSlug; lang: AuraLegalLang; children: ReactNode }) {
  return (
    <LangProvider>
      <Shell slug={slug} lang={lang}>
        {children}
      </Shell>
    </LangProvider>
  );
}

function Shell({ slug, lang, children }: { slug: AuraLegalSlug; lang: AuraLegalLang; children: ReactNode }) {
  const { lang: uiLang } = useLang();
  const doc = auraLegalRoute(slug);
  if (!doc) throw new Error(`Hukuki belge bulunamadı: ${slug}`);
  const ui = UI[lang];

  return (
    <div dir={langDir(uiLang)} lang={uiLang} className="aura-page min-h-dvh">
      <V2Nav />
      <main className="pt-16">
        <section dir="ltr" lang={lang} className="mx-auto max-w-6xl px-5 pb-10 pt-14 md:px-8 md:pt-24">
          <p className="aura-mono text-sm text-[var(--aura-accent)]">/ {ui.eyebrow}</p>
          <h1 className="aura-display mt-4 max-w-4xl text-3xl font-bold leading-tight tracking-tight text-[var(--aura-ink)] md:text-5xl">
            {doc.title[lang]}
          </h1>
          <p className="mt-5 text-sm text-[var(--aura-grey)]">
            {ui.version} {AURA_LEGAL_VERSION} · <time dateTime={AURA_LEGAL_DATE}>{AURA_LEGAL_DATE_LABEL[lang]}</time> · {ui.operator}:{" "}
            <AuraWordText text={AURA_OPERATOR_LABEL[lang]} />
          </p>
          <div role="group" aria-label={ui.langGroup} className="mt-6 flex flex-wrap items-center gap-2">
            {(["tr", "en"] as const).map((l) => {
              const active = l === lang;
              return (
                <Link
                  key={l}
                  href={auraLegalHref(doc.path, l)}
                  hrefLang={l}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-200 ${
                    active
                      ? "border-[var(--aura-accent)] bg-[var(--aura-accent)] text-[var(--aura-bg)]"
                      : "border-[var(--aura-hairline)] text-[var(--aura-grey)] hover:border-[var(--aura-accent)] hover:text-[var(--aura-ink)]"
                  }`}
                >
                  {ui[l]}
                </Link>
              );
            })}
          </div>
          <p className="mt-4 max-w-2xl text-xs leading-relaxed text-[var(--aura-micro)]">{ui.note}</p>
        </section>

        <section className="aura-light">
          <div dir="ltr" lang={lang} className="mx-auto max-w-3xl px-5 py-12 md:px-8 md:py-16">
            <nav aria-label={ui.nav} className="flex flex-wrap gap-2">
              {AURA_LEGAL_PUBLISHED.map((d) => {
                const active = d.slug === slug;
                return (
                  <Link
                    key={d.slug}
                    href={auraLegalHref(d.path, lang)}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-full border px-3 py-1 text-[12px] transition-colors duration-200 ${
                      active
                        ? "border-[var(--aura-accent-stronger)] bg-[var(--aura-accent-stronger)] text-white"
                        : "border-[var(--aura-hairline)] text-[var(--aura-grey)] hover:border-[var(--aura-accent)] hover:text-[var(--aura-accent-stronger)]"
                    }`}
                  >
                    {d.navTitle[lang]}
                  </Link>
                );
              })}
            </nav>
            <article className="mt-8">{children}</article>
          </div>
        </section>
      </main>
      <AuraClosing />
    </div>
  );
}
