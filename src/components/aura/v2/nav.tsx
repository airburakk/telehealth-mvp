"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuraMark } from "@/components/PortamedLogo";
import { LANGS, useLang, type Lang } from "@/lib/aura-landing/i18n";

// /v2 üst bandı (v6.16) — kök nav'dan AYRI bileşen, bilerek.
//
// NEDEN AYRI: kök `aura/nav.tsx` hem `/` hem `/how-it-works` tarafından
// kullanılıyor. Buradaki "Bakım" sekmesi `#care` çapasına gider ve o çapa
// YALNIZ /v2'de var (entry-paths bölümü) → kök nav'ı değiştirmek canlı
// landing'e KIRIK LİNK koyardı. v2/ klasörü zaten "taşıma anında köke geçer"
// deseniyle kurulu; taşımada bu dosya kök nav'ın yerini alır.
//
// NE DEĞİŞTİ: dört hizmet sekmesi (Telehealth · İkinci Görüş · Sağlık Turizmi ·
// Ücretsiz Sağlık) → tek bakım mimarisi (Bakım · Nasıl Çalışır · Güven ·
// Doktorlar İçin). Sayfa "tek bakım yolculuğu, dört giriş kapısı" derken nav'ın
// dört ayrı hizmet sıralaması sayfayla çelişiyordu.
//
// KORUNAN: logo (AuraMark + wordmark), `aura-nav-how` nefes animasyonu, turkuaz
// durak noktalı CTA giysisi, 8 dil anahtarı, SSR'da kapalı başlayan mobil panel.
// t.nav.menu/close kök sözlükten yeniden kullanılır (8 dilde zaten çevrili).
export function V2Nav() {
  const { lang, t, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const menuId = "v2-nav-menu";
  const nav = t.v2.nav;

  // Escape mobil paneli kapatır (klavye kullanıcısı panele hapsolmasın).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--aura-hairline)] bg-[color-mix(in_srgb,var(--aura-bg)_82%,transparent)] backdrop-blur-md">
      <nav aria-label="AURA" className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 md:px-8">
        {/* Taşıma yapıldı (2026-07-16): logo + #care çapası "/" kökünde. Nav artık
            SİTE GENELİ (/, /how-it-works, /for-clinicians…) — çapalar kök-göreli
            (/#care) ki her sayfadan çalışsın (kök nav'ın eski sözleşmesiyle aynı). */}
        <Link href="/" className="flex items-center gap-2.5" aria-label="AURA">
          <AuraMark size={32} />
          <img src="/assets/aura-word-dark.png" alt="AURA" className="h-4 w-auto" />
        </Link>

        <div className="hidden items-center gap-6 lg:flex">
          <NavLink href="/#care" label={nav.care} accent />
          <Link href="/how-it-works" className="aura-nav-how inline-flex min-h-[44px] items-center text-sm">
            {nav.how}
          </Link>
          <NavLink href="/guven-ve-gizlilik" label={nav.trust} />
          {/* Doktorlar İçin → /for-clinicians (v6.17; önceki geçici hedef
              /kurumsal-giris idi — sayfa artık var). */}
          <NavLink href="/for-clinicians" label={nav.clinicians} />
        </div>

        <div className="flex items-center gap-4 md:gap-6">
          <LangSwitch lang={lang} setLang={setLang} />
          <Link
            href="/giris"
            className="group hidden min-h-[44px] items-center gap-2 text-sm font-medium text-[var(--aura-ink)] md:flex"
          >
            <span
              aria-hidden
              className="h-2 w-2 rounded-full border border-[var(--aura-accent)] transition-colors duration-200 group-hover:bg-[var(--aura-accent)]"
            />
            <span className="aura-mono text-[13px] transition-colors duration-200 group-hover:text-[var(--aura-accent)]">
              {nav.cta}
            </span>
          </Link>

          {/* Hamburger: lg altı (mobil + tablet) — dokunma hedefi 44px. */}
          <button
            type="button"
            aria-label={open ? t.nav.close : t.nav.menu}
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen((o) => !o)}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--aura-hairline)] text-[var(--aura-ink)] transition-colors duration-200 active:scale-[0.96] lg:hidden"
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
              {open ? <path d="m3.5 3.5 9 9M12.5 3.5l-9 9" /> : <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />}
            </svg>
          </button>
        </div>
      </nav>

      {open && (
        <div
          id={menuId}
          className="border-t border-[var(--aura-hairline)] bg-[var(--aura-bg)]/95 px-5 pb-6 pt-3 backdrop-blur-md lg:hidden"
        >
          <div className="flex flex-col gap-1">
            <MobileLink href="/#care" label={nav.care} close={() => setOpen(false)} accent />
            <Link
              href="/how-it-works"
              onClick={() => setOpen(false)}
              className="aura-nav-how flex min-h-[44px] items-center rounded-lg px-2 py-2.5 text-[15px] active:bg-[var(--aura-surface)]"
            >
              {nav.how}
            </Link>
            <MobileLink href="/guven-ve-gizlilik" label={nav.trust} close={() => setOpen(false)} />
            <MobileLink href="/for-clinicians" label={nav.clinicians} close={() => setOpen(false)} />
          </div>
          <Link
            href="/giris"
            onClick={() => setOpen(false)}
            className="mt-4 flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-[var(--aura-accent)] px-4 py-3 text-sm font-semibold text-[var(--aura-bg)] active:scale-[0.98]"
          >
            {nav.cta}
          </Link>
        </div>
      )}
    </header>
  );
}

// Link (kök nav'daki <a> değil): çapa dışı hedefler client-side geçer, tam
// sayfa yeniden yüklemesi olmaz — dil seçimi (air_lang) ve video durumu korunur.
function NavLink({ href, label, accent = false }: { href: string; label: string; accent?: boolean }) {
  return (
    <Link
      href={href}
      className={
        "inline-flex min-h-[44px] items-center text-sm transition-colors duration-200 " +
        (accent
          ? "text-[var(--aura-accent)] hover:text-[var(--aura-ink)]"
          : "text-[var(--aura-grey)] hover:text-[var(--aura-ink)]")
      }
    >
      {label}
    </Link>
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
    <Link
      href={href}
      onClick={close}
      className={
        "flex min-h-[44px] items-center rounded-lg px-2 py-2.5 text-[15px] transition-colors duration-200 active:bg-[var(--aura-surface)] " +
        (accent ? "text-[var(--aura-accent)]" : "text-[var(--aura-grey)]")
      }
    >
      {label}
    </Link>
  );
}

// Dil seçici: 8 dil (RTL dahil), seçenek adları kendi dilinde.
function LangSwitch({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <select
      aria-label="Language"
      value={lang}
      onChange={(e) => setLang(e.target.value as Lang)}
      className="aura-mono min-h-[36px] cursor-pointer rounded-full border border-[var(--aura-hairline)] bg-transparent px-2.5 py-1 text-[11px] text-[var(--aura-ink)] outline-none transition-colors duration-200 hover:border-[var(--aura-accent)]/50 focus-visible:ring-2 focus-visible:ring-[var(--aura-accent)]"
    >
      {LANGS.map((l) => (
        <option key={l.code} value={l.code} className="bg-[#161719] text-[#F4F5F3]">
          {l.native}
        </option>
      ))}
    </select>
  );
}
