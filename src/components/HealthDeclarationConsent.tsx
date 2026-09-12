"use client";

import { useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { LegalMarkdown } from "@/components/aura/doctorium-legal/LegalMarkdown";
import { HEALTH_DECLARATION_TEXT } from "@/lib/ai-consent";
import { CONSENT_LANG_NOTE, type ConsentLang } from "@/lib/consent-lang";

// Sigorta sağlık beyanı AÇIK RIZA kapısı (kod Paket B, v6.269 · 2026-09-13; A04-d, kapsam HEALTH_DECLARATION v1).
// /paket hasta görünümünde beyan formu bu kapı geçilmeden MOUNT EDİLMEZ; sunucu ucu da aktif rıza olmadan beyanı
// reddeder (fail-closed). EKRAN = HASH: gösterilen markdown, /api/consent/health-declaration'ın kaydettiği metnin
// kendisidir (dil = hastanın dili → TR/EN kanonik). Rıza Hesabım'dan geri alınabilir (ConsentWithdrawPanel).
const UI: Record<ConsentLang, { title: string; box: string; yes: string; err: string }> = {
  tr: { title: "Sigorta sağlık beyanı — açık rıza", box: "Sağlık beyanımın yukarıda sayılan amaçla işlenmesine AÇIK RIZAM vardır.", yes: "Açık rızam vardır, formu aç", err: "Bir hata oluştu, lütfen tekrar deneyin." },
  en: { title: "Insurance health declaration — explicit consent", box: "I GIVE MY EXPLICIT CONSENT to the processing of my health declaration for the purpose stated above.", yes: "I consent, open the form", err: "Something went wrong, please try again." },
};

export function HealthDeclarationConsent({ lang, onConsented }: { lang: ConsentLang; onConsented: () => void }) {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ui = UI[lang];

  async function accept() {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/consent/health-declaration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang }),
      });
      if (!r.ok) throw new Error();
      onConsented();
    } catch {
      setErr(ui.err);
      setBusy(false);
    }
  }

  return (
    <div lang={lang} dir="ltr" className="mt-3 space-y-3">
      <div className="text-sm font-medium text-[var(--c-ink)]">{ui.title}</div>
      <div className="max-h-64 overflow-y-auto rounded-xl border border-[var(--c-hairline)] bg-[var(--c-bg)] px-3 py-2 text-[12px]">
        <LegalMarkdown markdown={HEALTH_DECLARATION_TEXT[lang]} />
      </div>
      <p className="text-[11px] leading-relaxed text-[var(--c-ink-3)]">{CONSENT_LANG_NOTE[lang]}</p>
      <label className="flex cursor-pointer items-start gap-2.5 text-sm text-[var(--c-ink-2)]">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--c-accent)]" />
        {ui.box}
      </label>
      {err && <p className="text-xs text-red-400">{err}</p>}
      <button
        type="button"
        onClick={accept}
        disabled={!agreed || busy}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--c-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--c-bg)] disabled:opacity-50"
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />} {ui.yes}
      </button>
    </div>
  );
}
