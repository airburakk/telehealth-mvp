"use client";

// Genel hasta arayüzü dil durumu — hastanın ana yüzeyleri (Vakalarım vb.) için kalıcı dil seçimi
// (localStorage). İkinci Görüş akışı kendi anahtarını (air_so_lang) kullanır; bu genel hasta dilidir.
// Çeviri mekanizması mevcut useT/`/api/i18n`/Translation cache'ini kullanır.
import { useEffect, useState } from "react";
import { Globe } from "lucide-react";
import { LANGUAGES } from "@/lib/constants";

const KEY = "air_lang";

export function usePatientLang(): [string, (l: string) => void] {
  const [lang, setLang] = useState("Türkçe");
  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (v && LANGUAGES.includes(v)) setLang(v);
    } catch {}
  }, []);
  function set(l: string) {
    setLang(l);
    try { localStorage.setItem(KEY, l); } catch {}
  }
  return [lang, set];
}

export function PatientLangSelect({ lang, onChange }: { lang: string; onChange: (l: string) => void }) {
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
