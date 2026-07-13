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
    <div lang={lang} dir={errDir(lang)} className="grid min-h-[calc(100vh-8rem)] place-items-center bg-[var(--c-bg)] px-5 py-10">
      <div className="w-full max-w-md rounded-[22px] border border-[var(--c-hairline)] bg-[var(--c-panel)] p-8 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-500/10">
          <AlertTriangle className="h-6 w-6 text-amber-300" />
        </div>
        <h1 className="mt-4 font-serif text-xl font-semibold text-[var(--c-ink)]">{t.errorTitle}</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--c-ink-2)]">{t.errorDesc}</p>
        <button
          type="button"
          onClick={() =>
            startTransition(() => {
              router.refresh();
              reset();
            })
          }
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--c-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)]"
        >
          <RefreshCw className="h-4 w-4" />
          {t.retry}
        </button>
        {error.digest && (
          <p className="mt-4 text-[11px] text-[var(--c-ink-3)]">
            {t.reference}: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
