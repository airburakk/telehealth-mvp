"use client";

import { useEffect, useState } from "react";

// Public (giriş gerektirmeyen) sayfalar için EN/TR dil anahtarı.
// Landing (PortamedLanding) ile AYNI localStorage anahtarını ("pm_locale") kullanır
// → landing'de seçilen dil bu sayfalarda da geçerli olur. Varsayılan "en" (landing ile aynı).
export type Locale = "en" | "tr";

export function usePublicLocale(): [Locale, (l: Locale) => void] {
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => {
    const saved = localStorage.getItem("pm_locale");
    if (saved === "tr" || saved === "en") setLocale(saved);
  }, []);
  function update(l: Locale) {
    setLocale(l);
    localStorage.setItem("pm_locale", l);
  }
  return [locale, update];
}

export function LocaleToggle({ locale, onChange }: { locale: Locale; onChange: (l: Locale) => void }) {
  return (
    <div className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-slate-200 bg-white p-0.5 text-[12px] font-semibold">
      {(["en", "tr"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          aria-pressed={locale === l}
          className={`rounded-full px-3 py-1 uppercase tracking-wide transition-colors ${
            locale === l ? "bg-[#101010] text-white" : "text-slate-500 hover:text-[#101010]"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
