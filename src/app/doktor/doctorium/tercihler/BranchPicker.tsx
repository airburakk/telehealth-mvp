"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";

interface Props {
  options: { slug: string; label: string }[];
  initial: string[];
  /** Hekimin kendi branşı — hiç seçim yapılmazsa akış buna düşer (bilgi notu için). */
  ownSlug: string | null;
}

// Doctorium branş tercihi seçici (Modül A). Çoklu seçim; boş bırakılırsa sunucu kendi branşına düşer.
export function BranchPicker({ options, initial, ownSlug }: Props) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<string>>(new Set(initial));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function toggle(slug: string) {
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
    setMsg(null);
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/doctor/news-branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branches: [...sel] }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setMsg("Tercihleriniz kaydedildi.");
      router.refresh();
    } catch {
      setMsg("Kaydedilemedi — tekrar deneyin.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--c-ink-2)]">
        <span>{sel.size} branş seçili</span>
        {sel.size > 0 && (
          <button type="button" onClick={() => { setSel(new Set()); setMsg(null); }} className="underline hover:text-[var(--c-ink)]">
            Tümünü temizle
          </button>
        )}
      </div>

      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {options.map((o) => {
          const on = sel.has(o.slug);
          return (
            <li key={o.slug}>
              <button
                type="button"
                onClick={() => toggle(o.slug)}
                aria-pressed={on}
                className={`flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-sm transition ${
                  on
                    ? "border-emerald-400/40 bg-emerald-500/10 text-[var(--c-ink)]"
                    : "border-[var(--c-hairline)] text-[var(--c-ink-2)] hover:bg-[var(--c-surface)]"
                }`}
              >
                <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${on ? "border-emerald-400 bg-emerald-400/90" : "border-[var(--c-hairline)]"}`}>
                  {on && <Check size={12} className="text-[#062a20]" strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">{o.label}</span>
                {o.slug === ownSlug && <span className="aura-mono shrink-0 text-[10px] text-[var(--c-ink-3)]">branşınız</span>}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/90 px-4 py-2.5 text-sm font-semibold text-[#062a20] hover:bg-emerald-400 disabled:opacity-60"
        >
          {saving && <Loader2 size={15} className="animate-spin" />}
          Tercihleri kaydet
        </button>
        {msg && <span className="text-xs text-[var(--c-ink-2)]">{msg}</span>}
      </div>
    </div>
  );
}
