"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Languages, Loader2 } from "lucide-react";

// Partner doktorun haber/okuma dili seçici — kaydedince haber akışı o dile çevrilir.
export function PartnerNewsLang({ current, languages }: { current: string; languages: string[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function change(language: string) {
    if (language === current || saving) return;
    setSaving(true);
    try {
      await fetch("/api/partner/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-white/50">
      {saving ? <Loader2 size={13} className="animate-spin" /> : <Languages size={13} />}
      <select
        value={current}
        onChange={(e) => change(e.target.value)}
        disabled={saving}
        className="rounded-lg border border-white/15 bg-[#161719] px-2 py-1 text-xs outline-none focus:border-[#34d399] disabled:opacity-60"
      >
        {languages.map((l) => <option key={l} value={l}>{l}</option>)}
      </select>
    </label>
  );
}
