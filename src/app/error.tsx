"use client";

// Rota hata sınırı — beklenmeyen render/veri hataları nötr bir kartla yakalanır.
// Metinler statik gömülü çok-dilli sözlükten (lib/error-i18n) gelir; çeviri
// zinciri/DB hata anında güvenilmez olduğundan KULLANILMAZ. error.message ASLA
// gösterilmez (iç detay/PHI sızıntısı riski); yalnız digest referans olarak
// gösterilir. "Tekrar dene": router.refresh + reset birlikte (server component
// verisi de tazelensin diye startTransition içinde).

import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { ERROR_I18N, errDir, pickLang } from "@/lib/error-i18n";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  // SSR/prerender'da navigator yok → önce TR, dil istemcide useEffect ile seçilir.
  const [lang, setLang] = useState("tr");
  useEffect(() => setLang(pickLang(navigator)), []);
  const t = ERROR_I18N[lang];

  return (
    <div lang={lang} dir={errDir(lang)} className="grid min-h-[calc(100vh-8rem)] place-items-center px-5 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-50">
          <AlertTriangle className="h-6 w-6 text-amber-500" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-slate-800">{t.errorTitle}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">{t.errorDesc}</p>
        <button
          type="button"
          onClick={() =>
            startTransition(() => {
              router.refresh();
              reset();
            })
          }
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-[#14C3D0] px-5 py-2.5 text-sm font-semibold text-[#101010] hover:bg-[#0EA5B2]"
        >
          <RefreshCw className="h-4 w-4" />
          {t.retry}
        </button>
        {error.digest && (
          <p className="mt-4 text-[11px] text-slate-400">
            {t.reference}: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
