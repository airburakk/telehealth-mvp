"use client";

import { useEffect, useState } from "react";
import { LANG_NAME_BY_CODE, langCodeFor } from "@/lib/constants";

// Public (giriş gerektirmeyen) sayfalar için EN/TR dil anahtarı.
// Dil kalıcılığı: tek anahtar `air_lang` (dil ADI — hasta yüzeyleri + landing ile ortak; emekli
// `pm_locale` bir defalık taşınır). Bu sayfaların statik metni yalnız EN/TR olduğundan diğer
// diller EN'e düşer (görüntü fallback — air_lang EZİLMEZ; yalnız kullanıcı toggle'a basarsa
// yazılır). Varsayılan "en" (landing ile aynı).
export type Locale = "en" | "tr";

export function usePublicLocale(): [Locale, (l: Locale) => void] {
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => {
    try {
      const airName = localStorage.getItem("air_lang");
      if (airName) { setLocale(langCodeFor(airName) === "tr" ? "tr" : "en"); return; }
      const saved = localStorage.getItem("pm_locale");
      if (saved === "tr" || saved === "en") {
        setLocale(saved);
        localStorage.setItem("air_lang", LANG_NAME_BY_CODE[saved]);
        localStorage.removeItem("pm_locale");
      }
    } catch {}
  }, []);
  function update(l: Locale) {
    setLocale(l);
    try { localStorage.setItem("air_lang", LANG_NAME_BY_CODE[l]); localStorage.removeItem("pm_locale"); } catch {}
  }
  return [locale, update];
}

export function LocaleToggle({ locale, onChange }: { locale: Locale; onChange: (l: Locale) => void }) {
  return (
    <div className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-[var(--c-hairline)] bg-[var(--c-panel)] p-0.5 text-[12px] font-semibold">
      {(["en", "tr"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          aria-pressed={locale === l}
          className={`rounded-full px-3 py-1 uppercase tracking-wide transition-colors ${
            locale === l ? "bg-[var(--c-accent)] text-[var(--c-bg)]" : "text-[var(--c-ink-3)] hover:text-[var(--c-ink)]"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
