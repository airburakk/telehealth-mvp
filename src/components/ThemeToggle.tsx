"use client";

// Tema anahtarı (v6.22, kullanıcı isteği) — iç yüzey GECE varsayılan; hasta isterse gündüze
// geçer. Tercih COOKIE'de (theme): kök layout ilk boyamada doğru temayı SSR'lar →
// localStorage'lı çözümlerin açılış parlaması (FOUC) yok. Landing etkilenmez (kendi
// .aura-* token'ları; Header zaten landing rotalarında gizli).
import { useState } from "react";
import { Moon, Sun } from "lucide-react";

export type ThemeName = "dark" | "light";
// Marka-nötr ad (2026-09-02): eski "aura_theme" Doctorium yüzeyinde AURA izi taşıyordu.
// ⚠️ layout.tsx'teki NO_FLASH_THEME_SCRIPT bu adı STRING olarak tekrarlar — ikisi birlikte değişir.
export const THEME_COOKIE = "theme";

// asMenuItem (2026-08-01, header hesap menüsü): ikon-buton yerine tam genişlik menü satırı —
// etiket görünür metin olur. Misafir header'ında ikon modu sürer.
export function ThemeToggle({ initial, t = (s) => s, asMenuItem = false }: { initial: ThemeName; t?: (s: string) => string; asMenuItem?: boolean }) {
  const [theme, setTheme] = useState<ThemeName>(initial);

  function toggle() {
    const next: ThemeName = theme === "dark" ? "light" : "dark";
    // html'deki tema sınıfını anında değiştir (classList.replace: font değişkenleri vb. korunur).
    document.documentElement.classList.replace(`theme-${theme}`, `theme-${next}`);
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
    setTheme(next);
  }

  const label = theme === "dark" ? t("Gündüz temasına geç") : t("Gece temasına geç");
  if (asMenuItem)
    return (
      <button
        onClick={toggle}
        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-start text-sm text-[var(--c-ink-2)] transition-colors duration-200 hover:bg-[var(--c-surface)] hover:text-[var(--c-ink)]"
      >
        {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />} {label}
      </button>
    );
  return (
    <button
      onClick={toggle}
      title={label}
      aria-label={label}
      className="grid h-9 w-9 place-items-center rounded-lg text-[var(--c-ink-3)] transition-colors duration-200 hover:bg-[var(--c-surface)] hover:text-[var(--c-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-accent)]"
    >
      {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
