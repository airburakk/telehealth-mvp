"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AuraClosing } from "@/components/aura/closing";
import { AuraWordText } from "@/components/aura/aura-word";
import { V2Nav } from "@/components/aura/v2/nav";
import { LangProvider, langDir, useLang } from "@/lib/aura-landing/i18n";
import { LANGUAGES } from "@/lib/constants";
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
import { auraLegalHrefFor, legalDir, LANG_NATIVE_NAME, LEGAL_CANONICAL_LINK_TR, LEGAL_DISPLAY_NOTE_TR, LEGAL_DISPLAY_PARTIAL_TR } from "@/lib/aura-legal/display";
import { LEGAL_SHELL_UI, type LegalShellUi } from "@/lib/aura-legal/shell-ui";

// AURA hukuki belge kabuğu (kod Paket A, v6.268 · 2026-09-13) — /aydinlatma · /kosullar · /cerez · /kvkk-basvuru
// (· /tele-saglik yayın bayrağıyla). Vitrin dünyası: /guven-ve-gizlilik ile aynı desen (LangProvider + V2Nav + AuraClosing;
// rota CHROME_FREE_ROUTES'ta → global Header/SiteFooter girmez). Gövde AÇIK şerit (.aura-light): uzun hukuki metin gece
// zemininde okunmaz; landing'in gündüz sandwich'iyle aynı token geçişi.
//
// Paket 7 (v6.285): üç dil ekseni — nav/footer arayüz dili (air_lang) · KANONİK belge dili (tr/en; bağlayıcı) · GÖSTERİM dili
// (hastanın seçtiği 11 dilden biri; `display` prop'u doluysa gövde o dilde bilgilendirme çevirisidir, kabuk "bağlayıcı metin
// Türkçe" notunu ve kanonik bağlantısını taşır, gövde yönü ar/fa'da rtl). Dil seçici: Türkçe · English · diğer diller (select).
// 7-C (v6.286): çeviri kutusunun ilk satırı rozet — hukukçu onaylı (dondurulmuş) metinde "İncelenmiş çeviri · tarih", aksi
// hâlde "Otomatik çeviri (yapay zekâ). Henüz hukuki incelemeden geçmedi." (lib/legal-approval; tarih gösterim dilinde biçimlenir).
//
// Metin içi AURA = wordmark kuralı (2026-08-17) yalnız kabuğun vitrin satırında (işletici etiketi) uygulanır; belge gövdesi
// düz metindir — Paket B'de aynı dize hash'lenir, görsel ikame yapılmaz.
export type LegalShellDisplay = {
  name: string; // dil adı ("Rusça")
  code: string; // ru
  partial: boolean; // bazı paragraflar çevrilemedi (TR kaldı)
  ui: Record<string, string>; // TR kabuk/not dizeleri → gösterim dili (sunucu çevirdi)
  title: string; // belge başlığı (gösterim dili)
  status: "automatic" | "reviewed"; // 7-C: hukukçu onaylı dondurulmuş metin mi, otomatik çeviri mi
  reviewedAt: string | null; // ISO — status reviewed
};

export function AuraLegalShell({ slug, lang, display, children }: { slug: AuraLegalSlug; lang: AuraLegalLang; display?: LegalShellDisplay | null; children: ReactNode }) {
  return (
    <LangProvider>
      <Shell slug={slug} lang={lang} display={display ?? null}>
        {children}
      </Shell>
    </LangProvider>
  );
}

function Shell({ slug, lang, display, children }: { slug: AuraLegalSlug; lang: AuraLegalLang; display: LegalShellDisplay | null; children: ReactNode }) {
  const { lang: uiLang } = useLang();
  const doc = auraLegalRoute(slug);
  if (!doc) throw new Error(`Hukuki belge bulunamadı: ${slug}`);
  const base = LEGAL_SHELL_UI[lang];
  // Gösterim dili TR/EN dışıysa kabuk dizeleri de o dilde (sunucu çevirdi); eksik anahtar → kanonik dil.
  const ui: LegalShellUi = display
    ? (Object.fromEntries(Object.entries(LEGAL_SHELL_UI.tr).map(([k, v]) => [k, display.ui[v] ?? base[k as keyof LegalShellUi]])) as LegalShellUi)
    : base;
  const bodyLang = display?.code ?? lang;
  const bodyDir = display ? legalDir(display.code) : "ltr";
  const otherLangs = LANGUAGES.filter((l) => l !== "Türkçe" && l !== "İngilizce");
  const dateLabel = display ? new Intl.DateTimeFormat(display.code, { dateStyle: "long" }).format(new Date(AURA_LEGAL_DATE)) : AURA_LEGAL_DATE_LABEL[lang];

  return (
    <div dir={langDir(uiLang)} lang={uiLang} className="aura-page min-h-dvh">
      <V2Nav />
      <main className="pt-16">
        <section dir={bodyDir} lang={bodyLang} className="mx-auto max-w-6xl px-5 pb-10 pt-14 md:px-8 md:pt-24">
          <p className="aura-mono text-sm text-[var(--aura-accent)]">/ {ui.eyebrow}</p>
          <h1 className="aura-display mt-4 max-w-4xl text-3xl font-bold leading-tight tracking-tight text-[var(--aura-ink)] md:text-5xl">
            {display?.title ?? doc.title[lang]}
          </h1>
          <p className="mt-5 text-sm text-[var(--aura-grey)]">
            {ui.version} {AURA_LEGAL_VERSION} · <time dateTime={AURA_LEGAL_DATE}>{dateLabel}</time> · {ui.operator}:{" "}
            <AuraWordText text={AURA_OPERATOR_LABEL[lang]} />
          </p>
          <div role="group" aria-label={ui.langGroup} className="mt-6 flex flex-wrap items-center gap-2">
            {(["tr", "en"] as const).map((l) => {
              const active = !display && l === lang;
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
                  {LEGAL_SHELL_UI.tr[l]}
                </Link>
              );
            })}
            {/* Diğer diller — bilgilendirme çevirisi (Paket 7); seçim tam sayfa gezintisi (?lang=<kod>); adlar dilin kendi adıyla */}
            <label className="inline-flex items-center gap-2 text-xs text-[var(--aura-grey)]">
              <span className="sr-only">{ui.other}</span>
              <select
                value={display?.name ?? ""}
                onChange={(e) => { if (e.target.value) window.location.assign(auraLegalHrefFor(doc.path, e.target.value)); }}
                aria-label={ui.other}
                className={`rounded-full border px-3 py-1 text-xs font-medium outline-none ${
                  display ? "border-[var(--aura-accent)] bg-[var(--aura-accent)] text-[var(--aura-bg)]" : "border-[var(--aura-hairline)] bg-transparent text-[var(--aura-grey)]"
                }`}
              >
                <option value="">{ui.other}…</option>
                {otherLangs.map((l) => <option key={l} value={l}>{LANG_NATIVE_NAME[l] ?? l}</option>)}
              </select>
            </label>
          </div>
          <p className="mt-4 max-w-2xl text-xs leading-relaxed text-[var(--aura-micro)]">{ui.note}</p>
          {display && (
            <div className="mt-3 max-w-2xl rounded-2xl border border-[var(--aura-accent)]/40 bg-[var(--aura-accent)]/[0.08] px-4 py-3 text-xs leading-relaxed text-[var(--aura-ink)]">
              <p className="font-medium">
                {display.status === "reviewed" && display.reviewedAt ? (
                  <>
                    {ui.reviewed}{" "}
                    <time dateTime={display.reviewedAt}>{new Intl.DateTimeFormat(display.code, { dateStyle: "long" }).format(new Date(display.reviewedAt))}</time>
                  </>
                ) : (
                  ui.auto
                )}
              </p>
              <p className="mt-1">{display.ui[LEGAL_DISPLAY_NOTE_TR] ?? LEGAL_DISPLAY_NOTE_TR}</p>
              {display.partial && <p className="mt-1 text-[var(--aura-grey)]">{display.ui[LEGAL_DISPLAY_PARTIAL_TR] ?? LEGAL_DISPLAY_PARTIAL_TR}</p>}
              <Link href={auraLegalHref(doc.path, "tr")} className="mt-1.5 inline-block font-medium text-[var(--aura-accent-stronger)] underline underline-offset-2">
                {display.ui[LEGAL_CANONICAL_LINK_TR] ?? LEGAL_CANONICAL_LINK_TR} (Türkçe · English)
              </Link>
            </div>
          )}
        </section>

        <section className="aura-light">
          <div dir={bodyDir} lang={bodyLang} className="mx-auto max-w-3xl px-5 py-12 md:px-8 md:py-16">
            <nav aria-label={ui.nav} className="flex flex-wrap gap-2">
              {AURA_LEGAL_PUBLISHED.map((d) => {
                const active = d.slug === slug;
                return (
                  <Link
                    key={d.slug}
                    href={display ? auraLegalHrefFor(d.path, display.name) : auraLegalHref(d.path, lang)}
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
