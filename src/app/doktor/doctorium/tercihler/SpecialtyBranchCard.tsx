"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";

/**
 * "Uzmanlık branşınız" kartı (👤 2026-10-06) — yalnız branşı SINIFLANDIRILMAMIŞ üyeye çizilir (kayıtta "Diğer
 * (Sınıflandırılmamış)" seçmiş, boş ya da listede olmayan değer). Branş uyarısı (bildirim + e-posta) buraya
 * (#brans) götürür. Kaydedince Doctor.branch güncellenir → kart kaybolur, akış ve Doctorium Post bu branşa göre
 * süzülür (lib/doctorium effectiveBranches: akış tercihi yoksa kendi branşı). Kapılar sunucuda
 * (api/doctor/specialty-branch); seçenekler sunucudan prop olarak gelir (lib/specialty-branch).
 */
export function SpecialtyBranchCard({ current, options, isStudent }: {
  current: string;
  options: readonly string[];
  isStudent: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [state, setState] = useState<{ kind: "idle" | "saving" | "error"; msg?: string }>({ kind: "idle" });

  async function save() {
    if (!value) return;
    setState({ kind: "saving" });
    const res = await fetch("/api/doctor/specialty-branch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ branch: value }),
    }).catch(() => null);
    if (!res || !res.ok) {
      const j = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : {};
      setState({ kind: "error", msg: j.error ?? "Kaydedilemedi. Bağlantınızı kontrol edip tekrar deneyin." });
      return;
    }
    router.refresh();
  }

  const noun = isStudent ? "İlgilendiğiniz branş" : "Uzmanlık branşınız";
  return (
    <section
      id="brans"
      className="mt-6 scroll-mt-40 rounded-2xl border bg-[var(--c-panel)] p-4 sm:p-5"
      style={{ borderColor: "color-mix(in srgb, var(--c-warning) 50%, transparent)", borderLeft: "3px solid var(--c-warning)" }}
    >
      <div className="flex items-center gap-2 text-[14.5px] font-semibold text-[var(--c-ink)]">
        <AlertTriangle size={15} className="text-[var(--c-warning)]" />
        {noun} sınıflandırılmamış
      </div>
      <p className="mt-1.5 max-w-[68ch] text-[13px] leading-relaxed text-[var(--c-ink-2)]">
        Kayıtta branşınız <strong className="text-[var(--c-ink)]">“{current || "belirtilmemiş"}”</strong> olarak kaydedildi.
        Listeden branşınızı seçtiğinizde akışınız ve Doctorium Post bu branşa göre düzenlenir. Kaydettikten sonra bu alan
        kapanır; aşağıdaki akış tercihlerinden ilgilendiğiniz diğer branşları ayrıca seçebilirsiniz.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={value}
          onChange={(e) => { setValue(e.target.value); setState({ kind: "idle" }); }}
          aria-label={noun}
          className="w-full max-w-sm rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3 py-2 text-[13px] text-[var(--c-ink)] focus:border-[var(--c-accent)] focus:outline-none"
        >
          <option value="">Branş seçin…</option>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={save}
          disabled={!value || state.kind === "saving"}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--c-accent-fill,var(--c-accent))] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          {state.kind === "saving" && <Loader2 size={14} className="animate-spin" />}
          Branşımı kaydet
        </button>
      </div>
      {state.kind === "error" && (
        <p role="alert" className="mt-2 text-[12.5px] text-[var(--c-danger)]">{state.msg}</p>
      )}
    </section>
  );
}
