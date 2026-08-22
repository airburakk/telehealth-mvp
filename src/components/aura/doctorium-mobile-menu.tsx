"use client";

import { useEffect, useState } from "react";

// /doctorium üst barının MOBİL menüsü (kullanıcı isteği 2026-08-16): landing server component
// kalır, yalnız hamburger+panel bu küçük client adasında yaşar. Desen V2Nav'ın mobil menüsüyle
// birebir (aynı SVG ikon, 44px dokunma hedefi, aria-expanded/controls, Escape kapatır, SSR'da
// kapalı başlar); renkler landing'in --dl-* değişkenlerinden — tema toggle'ına değil bölüm
// paletine bağlı (landing sözleşmesi). Panel yalnız BÖLÜM ÇAPALARINI taşır: Giriş yap + katıl
// düğmeleri mobilde barda görünür (bu isteğin asıl maddesi) — panelde tekrarlanmaz.
// v1 landing'in çapaları — varsayılan (geriye uyum). V2 landing kendi listesini `sections`
// prop'uyla verir (2026-08-23); bileşen iki sürümde de aynı.
const SECTIONS = [
  { href: "#olanaklar", label: "Olanaklar" },
  { href: "#hukuk", label: "Hukuk" },
  { href: "#puanlar", label: "Puanlar" },
  { href: "#ogrenci", label: "Tıp öğrencileri" },
];

export function DoctoriumMobileMenu({
  sections = SECTIONS,
  onOpen,
}: {
  sections?: readonly { href: string; label: string }[];
  /** V2: menü açılınca analytics (mobile_menu_open) — v1 vermez. */
  onOpen?: () => void;
} = {}) {
  const [open, setOpen] = useState(false);
  const menuId = "doctorium-nav-menu";

  // Escape paneli kapatır (V2Nav deseni — klavye kullanıcısı panele hapsolmasın).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Menüyü kapat" : "Menü"}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => { if (!o) onOpen?.(); return !o; })}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--dl-line)] text-[var(--dl-ink)] transition-colors duration-200 active:scale-[0.96] md:hidden"
      >
        <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          {open ? <path d="m3.5 3.5 9 9M12.5 3.5l-9 9" /> : <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />}
        </svg>
      </button>

      {open && (
        <div
          id={menuId}
          className="absolute inset-x-0 top-full border-b border-t border-[var(--dl-line)] bg-[color-mix(in_srgb,var(--dl-bg)_94%,transparent)] px-5 pb-4 pt-2 backdrop-blur-md md:hidden"
        >
          <nav aria-label="Bölümler" className="flex flex-col gap-1">
            {sections.map((s) => (
              <a
                key={s.href}
                href={s.href}
                onClick={() => setOpen(false)}
                className="flex min-h-[44px] items-center rounded-lg px-2 py-2.5 text-[15px] text-[var(--dl-body)] transition-colors active:bg-[var(--dl-panel)] hover:text-[var(--dl-ink)]"
              >
                {s.label}
              </a>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
