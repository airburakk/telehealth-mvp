"use client";

// Tek dil kalıcılık + seçici — hasta-yüzü TÜM yüzeyler ortak "air_lang" anahtarını paylaşır.
// (Faz 1: PatientLocale + SoLocale bu factory'ye indirgendi; ayrı "air_so_lang" emekli → hasta
// bir yolda seçtiği dili diğer yolda da bulur.) Çeviri: useT/`/api/i18n`/Translation cache.
import { useEffect, useState } from "react";
import { Globe } from "lucide-react";
import { LANGUAGES } from "@/lib/constants";

// localStorage-kalıcı dil hook'u üretir. Aynı anahtar → tüm ekranlar aynı dili paylaşır.
// Dönen fonksiyon adı "use…" ile başlar → hook kurallarına uyar; bileşen üstünde çağrılır.
export function createLangPersistence(key: string, fallback = "Türkçe") {
  return function useLang(): [string, (l: string) => void] {
    const [lang, setLang] = useState(fallback);
    useEffect(() => {
      try {
        const v = localStorage.getItem(key);
        if (v && LANGUAGES.includes(v)) setLang(v);
      } catch {}
    }, []);
    function set(l: string) {
      setLang(l);
      try { localStorage.setItem(key, l); } catch {}
    }
    return [lang, set];
  };
}

// Ortak dil seçici (Globe + select) — tüm hasta-yüzü ekranlarda tek görünüm.
export function LangSelect({ lang, onChange }: { lang: string; onChange: (l: string) => void }) {
  return (
    <label className="inline-flex shrink-0 items-center gap-1.5 text-xs text-slate-500">
      <Globe size={14} />
      <select
        value={lang}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-[#14C3D0]"
      >
        {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
      </select>
    </label>
  );
}
