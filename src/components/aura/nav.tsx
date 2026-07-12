"use client";

import Link from "next/link";
import { useState } from "react";
import { LANGS, useLang, type Lang } from "@/lib/aura-landing/i18n";

// Ust bant v2: kullanicinin logosu (sembol + acik yazi markasi) + iki
// baglanti + EN/TR anahtari + CTA. Nav CTA giysisi: turkuaz durak noktasi +
// mono okuma (hero/kapanis bloklarindan farkli, ayni etiket = ayni niyet).
// Mobil: baglantilar + CTA hamburger paneline tasinir (dil anahtari bantta
// kalir); panel SSR'da kapali baslar.
export function AuraNav() {
  const { lang, t, setLang } = useLang();
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--aura-hairline)] bg-[color-mix(in_srgb,var(--aura-bg)_82%,transparent)] backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 md:px-8">
        {/* Logo → ana sayfa (Next Link: / üzerindeyken en üste kaydırır,
            alt sayfalardan client-nav ile döner). */}
        <Link href="/" className="flex items-center gap-2.5" aria-label="AURA">
          <img src="/assets/aura-symbol.png" alt="" aria-hidden className="h-8 w-8" />
          <img src="/assets/aura-word-dark.png" alt="AURA" className="h-4 w-auto" />
        </Link>

        {/* How-It-Works basta (beyaz<->turkuaz nefes animasyonu) + 4 chapter
            sekmesi; TR etiketler md'de tasar → lg. Capalar kok-goreli (/#...)
            — nav /how-it-works sayfasinda da kullanildigi icin her sayfadan
            calisir. */}
        <div className="hidden items-center gap-6 lg:flex">
          <Link href="/how-it-works" className="aura-nav-how text-sm">
            {t.nav.how}
          </Link>
          <NavLink href="/#ch-consult" label={t.nav.telehealth} accent />
          <NavLink href="/#ch-so" label={t.nav.so} />
          <NavLink href="/#ch-tourism" label={t.nav.tourism} accent />
          <NavLink href="/#ch-freecare" label={t.nav.freecare} />
        </div>

        <div className="flex items-center gap-4 md:gap-6">
          <LangSwitch lang={lang} setLang={setLang} />
          <Link
            href="/giris"
            className="group hidden items-center gap-2 text-sm font-medium text-[var(--aura-ink)] md:flex"
          >
            <span
              aria-hidden
              className="h-2 w-2 rounded-full border border-[var(--aura-accent)] transition-colors duration-200 group-hover:bg-[var(--aura-accent)]"
            />
            <span className="aura-mono text-[13px] transition-colors duration-200 group-hover:text-[var(--aura-accent)]">
              {t.nav.cta}
            </span>
          </Link>

          {/* Hamburger: lg alti (mobil + tablet) */}
          <button
            type="button"
            aria-label={open ? t.nav.close : t.nav.menu}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--aura-hairline)] text-[var(--aura-ink)] transition-colors duration-200 active:scale-[0.96] lg:hidden"
          >
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            >
              {open ? (
                <path d="m3.5 3.5 9 9M12.5 3.5l-9 9" />
              ) : (
                <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobil/tablet menu paneli */}
      {open && (
        <div className="border-t border-[var(--aura-hairline)] bg-[var(--aura-bg)]/95 px-5 pb-6 pt-3 backdrop-blur-md lg:hidden">
          <div className="flex flex-col gap-1">
            <Link
              href="/how-it-works"
              onClick={() => setOpen(false)}
              className="aura-nav-how rounded-lg px-2 py-2.5 text-[15px] active:bg-[var(--aura-surface)]"
            >
              {t.nav.how}
            </Link>
            <MobileLink href="/#ch-consult" label={t.nav.telehealth} close={() => setOpen(false)} accent />
            <MobileLink href="/#ch-so" label={t.nav.so} close={() => setOpen(false)} />
            <MobileLink href="/#ch-tourism" label={t.nav.tourism} close={() => setOpen(false)} accent />
            <MobileLink href="/#ch-freecare" label={t.nav.freecare} close={() => setOpen(false)} />
          </div>
          <Link
            href="/giris"
            onClick={() => setOpen(false)}
            className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-[var(--aura-accent)] px-4 py-3 text-sm font-semibold text-[var(--aura-bg)] active:scale-[0.98]"
          >
            {t.nav.cta}
          </Link>
        </div>
      )}
    </header>
  );
}

function NavLink({
  href,
  label,
  accent = false,
}: {
  href: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <a
      href={href}
      className={
        "text-sm transition-colors duration-200 " +
        (accent
          ? "text-[var(--aura-accent)] hover:text-[var(--aura-ink)]"
          : "text-[var(--aura-grey)] hover:text-[var(--aura-ink)]")
      }
    >
      {label}
    </a>
  );
}

function MobileLink({
  href,
  label,
  close,
  accent = false,
}: {
  href: string;
  label: string;
  close: () => void;
  accent?: boolean;
}) {
  return (
    <a
      href={href}
      onClick={close}
      className={
        "rounded-lg px-2 py-2.5 text-[15px] transition-colors duration-200 active:bg-[var(--aura-surface)] " +
        (accent ? "text-[var(--aura-accent)]" : "text-[var(--aura-grey)]")
      }
    >
      {label}
    </a>
  );
}

// Dil secici: 8 dil (platform landing seti, RTL dahil) — kompakt yerli
// select; secenek adlari kendi dilinde (native). Acilir liste koyu boyanir.
function LangSwitch({
  lang,
  setLang,
}: {
  lang: Lang;
  setLang: (l: Lang) => void;
}) {
  return (
    <select
      aria-label="Language"
      value={lang}
      onChange={(e) => setLang(e.target.value as Lang)}
      className="aura-mono cursor-pointer rounded-full border border-[var(--aura-hairline)] bg-transparent px-2.5 py-1 text-[11px] text-[var(--aura-ink)] outline-none transition-colors duration-200 hover:border-[var(--aura-accent)]/50"
    >
      {LANGS.map((l) => (
        <option key={l.code} value={l.code} className="bg-[#161719] text-[#F4F5F3]">
          {l.native}
        </option>
      ))}
    </select>
  );
}
