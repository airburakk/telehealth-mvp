"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Loader2, SlidersHorizontal } from "lucide-react";

interface Props {
  options: { slug: string; label: string }[];
  initial: string[];
  ownSlug: string | null;
}

// Branş tercihleri — modül sekmelerinin ALTINDA açılır alt menü (v6.49, kullanıcı isteği:
// ayrı sayfaya gitmek yerine menünün altından seçilsin). Eski /tercihler rotası korunur.
export function BranchPrefsMenu({ options, initial, ownSlug }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set(initial));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // Kaydedilmemiş değişiklik var mı — kullanıcı kaydetmeden kapatırsa uyarmak yerine rozetle göster.
  const dirty = sel.size !== initial.length || [...sel].some((s) => !initial.includes(s));

  function toggle(slug: string) {
    setSel((p) => {
      const n = new Set(p);
      if (n.has(slug)) n.delete(slug);
      else n.add(slug);
      return n;
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
      if (!res.ok) throw new Error();
      setMsg("Kaydedildi");
      router.refresh();
    } catch {
      setMsg("Kaydedilemedi — tekrar deneyin");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--c-hairline)] px-3 py-1.5 text-xs font-semibold text-[var(--c-ink-2)] hover:bg-[var(--c-surface)]"
      >
        <SlidersHorizontal size={13} /> Branş tercihleri
        <span className="aura-mono text-[10px] text-[var(--c-ink-3)]">{sel.size || "kendi branşım"}</span>
        {dirty && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-label="kaydedilmemiş değişiklik" />}
        <ChevronDown size={13} className={open ? "rotate-180 transition" : "transition"} />
      </button>

      {open && (
        <div className="mt-2 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-[var(--c-ink-2)]">
              Akışınızda görmek istediğiniz branşları seçin. Boş bırakırsanız kendi branşınız kullanılır.
            </p>
            {sel.size > 0 && (
              <button type="button" onClick={() => { setSel(new Set()); setMsg(null); }}
                className="text-xs text-[var(--c-ink-3)] underline hover:text-[var(--c-ink)]">
                Temizle
              </button>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {options.map((o) => {
              const on = sel.has(o.slug);
              return (
                <button
                  key={o.slug}
                  type="button"
                  onClick={() => toggle(o.slug)}
                  aria-pressed={on}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition ${
                    on
                      ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-300"
                      : "border-[var(--c-hairline)] text-[var(--c-ink-2)] hover:bg-[var(--c-surface-2)]"
                  }`}
                >
                  {on && <Check size={11} strokeWidth={3} />}
                  {o.label}
                  {o.slug === ownSlug && <span className="aura-mono text-[9px] text-[var(--c-ink-3)]">•</span>}
                </button>
              );
            })}
          </div>

          <div className="mt-3.5 flex items-center gap-3">
            <button type="button" onClick={save} disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/90 px-3.5 py-1.5 text-xs font-semibold text-[#062a20] hover:bg-emerald-400 disabled:opacity-60">
              {saving && <Loader2 size={12} className="animate-spin" />} Kaydet
            </button>
            {msg && <span className="text-[11px] text-[var(--c-ink-2)]">{msg}</span>}
            <span className="ml-auto text-[10px] text-[var(--c-ink-3)]">• kendi branşınız</span>
          </div>
        </div>
      )}
    </div>
  );
}
