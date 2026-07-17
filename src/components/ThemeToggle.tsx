"use client";

// Tema anahtarı (v6.22, kullanıcı isteği) — iç yüzey GECE varsayılan; hasta isterse gündüze
// geçer. Tercih COOKIE'de (aura_theme): kök layout ilk boyamada doğru temayı SSR'lar →
// localStorage'lı çözümlerin açılış parlaması (FOUC) yok. Landing etkilenmez (kendi
// .aura-* token'ları; Header zaten landing rotalarında gizli).
import { useState } from "react";
import { Moon, Sun } from "lucide-react";

export type ThemeName = "dark" | "light";
export const THEME_COOKIE = "aura_theme";

export function ThemeToggle({ initial, t = (s) => s }: { initial: ThemeName; t?: (s: string) => string }) {
  const [theme, setTheme] = useState<ThemeName>(initial);

  function toggle() {
    const next: ThemeName = theme === "dark" ? "light" : "dark";
    // html'deki tema sınıfını anında değiştir (classList.replace: font değişkenleri vb. korunur).
    document.documentElement.classList.replace(`theme-${theme}`, `theme-${next}`);
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
    setTheme(next);
  }

  const label = theme === "dark" ? t("Gündüz temasına geç") : t("Gece temasına geç");
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
