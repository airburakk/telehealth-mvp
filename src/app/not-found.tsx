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
    <div lang={lang} dir={errDir(lang)} className="grid min-h-[calc(100vh-8rem)] place-items-center px-5 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-5xl font-semibold tracking-tight text-slate-300">404</p>
        <h1 className="mt-4 text-xl font-semibold text-slate-800">{t.notFoundTitle}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">{t.notFoundDesc}</p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-[#14C3D0] px-5 py-2.5 text-sm font-semibold text-[#101010] hover:bg-[#0EA5B2]"
        >
          {t.home}
        </Link>
      </div>
    </div>
  );
}
