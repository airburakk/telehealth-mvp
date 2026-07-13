"use client";

// 404 — Sayfa bulunamadı. Metinler statik gömülü çok-dilli sözlükten gelir
// (lib/error-i18n); hata anında çeviri zinciri/DB güvenilmez olduğundan bilinçli
// olarak KULLANILMAZ. Dil, tarayıcı tercihinden (navigator.languages) seçilir;
// eşleşme yoksa TR. Arapça/Farsça için dir="rtl" uygulanır.

import Link from "next/link";
import { useEffect, useState } from "react";
import { ERROR_I18N, errDir, pickLang } from "@/lib/error-i18n";

export default function NotFound() {
  // SSR/prerender'da navigator yok → önce TR render edilir, dil istemcide
  // useEffect ile seçilir (hydration uyuşmazlığı olmasın diye).
  const [lang, setLang] = useState("tr");
  useEffect(() => setLang(pickLang(navigator)), []);
  const t = ERROR_I18N[lang];

  return (
    <div lang={lang} dir={errDir(lang)} className="grid min-h-[calc(100vh-8rem)] place-items-center bg-[var(--c-bg)] px-5 py-10">
      <div className="w-full max-w-md rounded-[22px] border border-[var(--c-hairline)] bg-[var(--c-panel)] p-8 text-center">
        <p className="font-mono text-5xl font-semibold tracking-tight text-[var(--c-ink-3)]">404</p>
        <h1 className="mt-4 font-serif text-xl font-semibold text-[var(--c-ink)]">{t.notFoundTitle}</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--c-ink-2)]">{t.notFoundDesc}</p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-[var(--c-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)]"
        >
          {t.home}
        </Link>
      </div>
    </div>
  );
}
