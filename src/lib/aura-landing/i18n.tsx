"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { LANG_NAME_BY_CODE, langCodeFor } from "@/lib/constants";
import { COPY, LANG_CODES, type Copy, type Lang } from "./copy";

// AURA landing dil sağlayıcısı (vitrinden taşındı, 2026-07-12). Veri (COPY,
// VIDEOS, LINKS...) ./copy'de "use client"sız durur — server sayfalar
// (JSON-LD) oradan import eder. Bu modül yalnız context/hook katmanıdır.
//
// Kalıcılık PLATFORM anahtarıyla: `air_lang` dil ADI tutar (hasta yüzeyleri
// ve PortamedLanding ile ortak) — vitrindeki `aura_lang` kod-anahtarı yerine.
// Landing'de olmayan dil (Kazakça/Kırgızca) → görüntü EN'e düşer, anahtar ezilmez.

export * from "./copy";

const LangContext = createContext<{
  lang: Lang;
  t: Copy;
  setLang: (l: Lang) => void;
}>({ lang: "en", t: COPY.en, setLang: () => {} });

// initialLang (v6.17, locale rotaları): /tr /ar gibi bir locale rotasından
// gelindiğinde URL'deki dil KAZANIR — SSR ilk boyamada o dilde çizilir ve
// air_lang okuması ATLANIR (URL açık bir istek; kayıtlı tercih ezilMEZ, yalnız
// o sayfada devre dışı). Prop verilmediğinde davranış BİREBİR eski: EN başla,
// mount'ta air_lang'dan düzelt. setLang her iki modda da air_lang'a yazar.
export function LangProvider({
  children,
  initialLang,
}: {
  children: ReactNode;
  initialLang?: Lang;
}) {
  const [lang, setLangState] = useState<Lang>(initialLang ?? "en");

  useEffect(() => {
    if (initialLang) return; // URL dili kazandı — depolama okuması yok
    try {
      const code = langCodeFor(window.localStorage.getItem("air_lang"));
      if (code && (LANG_CODES as string[]).includes(code)) {
        setLangState(code as Lang);
      }
    } catch {
      // depolama engellenmiş olabilir; dil EN kalır
    }
  }, [initialLang]);

  // Kök <html> dir/lang'a DOKUNULMAZ (birleşik uygulamada diğer sayfalara
  // sızardı) — RTL/lang landing'in kendi konteynerine uygulanır
  // (AuraLanding: <div dir={langDir(lang)} lang={lang}> — PortamedLanding
  // deseni; flex/grid akışları konteyner dir'iyle de aynalanır).
  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem("air_lang", LANG_NAME_BY_CODE[l]);
    } catch {
      // depolama engellenmiş olabilir; dil yalnız oturumluk kalır
    }
  };

  return (
    <LangContext.Provider value={{ lang, t: COPY[lang], setLang }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
