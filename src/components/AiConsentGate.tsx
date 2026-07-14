"use client";

// Yapay zeka işleme AÇIK RIZASI kapısı — hastayı karşılayan AI, semptom/tanı girişinden ÖNCE bu kapıyı
// gösterir (4 kulvar: triyaj · ikinci görüş · sağlık turizmi · ücretsiz sağlık).
//   "Açık Rızam Vardır" → rıza kaydedilir (idempotent, ispatlı: /api/consent/ai) + asıl form açılır.
//   "Süreci Sonlandır" → hastanın ana sekmesine (dest) döner; asıl form hiç mount edilmez.
// Rıza verilene kadar {children} MOUNT EDİLMEZ → gate geçilmeden hiçbir semptom/AI işlemi başlamaz.
// Metin PHI değil (statik bilgilendirme) → useT ile hasta diline lokalize edilir. Kanonik TR metin
// lib/ai-consent'te; hash'lenip kayda mühürlenir. ⚖️ Metin TASLAK — hukuk müşaviri nihaileştirmeli.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/useT";
import { usePatientLang, PatientLangSelect } from "@/components/PatientLocale";
import { langDir } from "@/lib/constants";
import { AI_CONSENT_TEXT } from "@/lib/ai-consent";
import { Sparkles, ShieldCheck, Loader2, XCircle } from "lucide-react";

const UI = {
  title: "Yapay Zeka ile Ön Değerlendirme — Açık Rıza",
  yes: "Açık Rızam Vardır",
  no: "Süreci Sonlandır",
  err: "Bir hata oluştu, lütfen tekrar deneyin.",
};

export function AiConsentGate({ children, dest = "/vakalarim" }: { children: React.ReactNode; dest?: string }) {
  const router = useRouter();
  const [lang, setLang] = usePatientLang();
  const texts = useMemo(() => [AI_CONSENT_TEXT, UI.title, UI.yes, UI.no, UI.err], []);
  const { t } = useT(lang, texts);

  const [consented, setConsented] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  async function accept() {
    setSubmitting(true);
    setErr("");
    try {
      const r = await fetch("/api/consent/ai", { method: "POST" });
      if (!r.ok) throw new Error();
      setConsented(true);
    } catch {
      setErr(t(UI.err));
      setSubmitting(false);
    }
  }

  if (consented) return <>{children}</>;

  return (
    <div dir={langDir(lang)} className="mx-auto max-w-2xl px-5 py-10">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--c-accent)] text-[var(--c-bg)]">
            <Sparkles size={22} />
          </span>
          <h1 className="text-xl font-bold text-[var(--c-ink)]">{t(UI.title)}</h1>
        </div>
        <PatientLangSelect lang={lang} onChange={setLang} />
      </div>

      <div className="mt-5 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-5">
        <p className="text-[14px] leading-relaxed text-[var(--c-ink)]">{t(AI_CONSENT_TEXT)}</p>
      </div>

      {err && <p className="mt-3 text-sm text-red-300">{err}</p>}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button
          onClick={accept}
          disabled={submitting}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--c-accent)] px-5 py-3 text-sm font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />} {t(UI.yes)}
        </button>
        <button
          onClick={() => router.push(dest)}
          disabled={submitting}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-5 py-3 text-sm font-semibold text-[var(--c-ink-2)] hover:bg-[var(--c-panel)] disabled:opacity-50"
        >
          <XCircle size={16} /> {t(UI.no)}
        </button>
      </div>
    </div>
  );
}
