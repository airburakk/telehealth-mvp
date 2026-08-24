"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";

interface Row {
  id: string; title: string; organizer: string | null; city: string | null; country: string;
  startDate: string; endDate: string | null; url: string | null;
  eventType: string; ttbCode: string | null;
}

/** v6.120 — TTB taksonomisi. lib/doctorium EVENT_TYPES ile aynı sıra/etiket; client bileşen
 *  o server modülünü import edemez (db bağımlılığı) → burada elle eşlenir.
 *  ⚠️ EVENT_TYPES değişirse burayı da güncelle (tests/unit/doctorium.test.ts sözleşmeyi tutar). */
const EVENT_TYPE_OPTIONS = [
  ["kongre", "Kongre"], ["sempozyum", "Sempozyum"], ["kurs", "Kurs"], ["egitim", "Eğitim"],
  ["konferans", "Konferans"], ["calistay", "Çalıştay"], ["seminer", "Seminer"],
  ["atolye", "Atölye Çalışması"], ["diger", "Diğer"],
] as const;

export function CongressAdmin({ rows, branchOptions }: { rows: Row[]; branchOptions: { slug: string; label: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [branches, setBranches] = useState<Set<string>>(new Set());

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const f = new FormData(e.currentTarget);
    const body = {
      title: f.get("title"), organizer: f.get("organizer"), city: f.get("city"), country: f.get("country"),
      startDate: f.get("startDate"), endDate: f.get("endDate"),
      abstractDeadline: f.get("abstractDeadline"), earlyBirdDeadline: f.get("earlyBirdDeadline"),
      url: f.get("url"), branchSlugs: [...branches], eventType: f.get("eventType"),
    };
    try {
      const res = await fetch("/api/admin/congress", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Kaydedilemedi.");
      (e.target as HTMLFormElement).reset();
      setBranches(new Set());
      router.refresh();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    await fetch(`/api/admin/congress?id=${id}`, { method: "DELETE" });
    router.refresh();
    setBusy(false);
  }

  const input = "w-full rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3 py-2 text-sm text-[var(--c-ink)] outline-none focus:border-emerald-400/50";
  const label = "block text-[11px] font-semibold uppercase tracking-wide text-[var(--c-ink-3)]";

  return (
    <>
      <form onSubmit={submit} className="mt-6 grid gap-3 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] p-5">
        <div>
          <label className={label} htmlFor="title">Etkinlik adı *</label>
          <input id="title" name="title" required className={`${input} mt-1`} placeholder="27. Ulusal Kardiyoloji Kongresi" />
        </div>
        <div>
          <label className={label} htmlFor="eventType">Tür *</label>
          <select id="eventType" name="eventType" defaultValue="kongre" className={`${input} mt-1`}>
            {EVENT_TYPE_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="organizer">Düzenleyen</label>
            <input id="organizer" name="organizer" className={`${input} mt-1`} placeholder="Türk Kardiyoloji Derneği" />
          </div>
          <div>
            <label className={label} htmlFor="url">Etkinlik adresi</label>
            <input id="url" name="url" type="url" className={`${input} mt-1`} placeholder="https://…" />
          </div>
          <div>
            <label className={label} htmlFor="city">Şehir</label>
            <input id="city" name="city" className={`${input} mt-1`} placeholder="Antalya" />
          </div>
          <div>
            <label className={label} htmlFor="country">Ülke</label>
            <input id="country" name="country" defaultValue="TR" className={`${input} mt-1`} />
          </div>
          <div>
            <label className={label} htmlFor="startDate">Başlangıç *</label>
            <input id="startDate" name="startDate" type="date" required className={`${input} mt-1`} />
          </div>
          <div>
            <label className={label} htmlFor="endDate">Bitiş</label>
            <input id="endDate" name="endDate" type="date" className={`${input} mt-1`} />
          </div>
          <div>
            <label className={label} htmlFor="abstractDeadline">Bildiri son teslim</label>
            <input id="abstractDeadline" name="abstractDeadline" type="date" className={`${input} mt-1`} />
          </div>
          <div>
            <label className={label} htmlFor="earlyBirdDeadline">Erken kayıt son</label>
            <input id="earlyBirdDeadline" name="earlyBirdDeadline" type="date" className={`${input} mt-1`} />
          </div>
        </div>

        <fieldset>
          <legend className={label}>İlgili branşlar (boş = tüm branşlarda görünür)</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {branchOptions.map((b) => {
              const on = branches.has(b.slug);
              return (
                <button
                  key={b.slug}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setBranches((p) => { const n = new Set(p); n.has(b.slug) ? n.delete(b.slug) : n.add(b.slug); return n; })}
                  className={`rounded-full border px-2.5 py-1 text-[11px] ${on ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-300" : "border-[var(--c-hairline)] text-[var(--c-ink-2)]"}`}
                >
                  {b.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        {err && <p className="text-xs text-rose-300">{err}</p>}
        <div>
          <button type="submit" disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/90 px-4 py-2.5 text-sm font-semibold text-[#062a20] hover:bg-emerald-400 disabled:opacity-60">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Etkinlik ekle
          </button>
        </div>
      </form>

      <h2 className="mt-8 text-sm font-semibold text-[var(--c-ink)]">Kayıtlı etkinlikler ({rows.length})</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--c-ink-2)]">Henüz kayıt yok.</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {rows.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-3 rounded-xl border border-[var(--c-hairline)] px-3.5 py-2.5">
              <div className="min-w-0">
                <div className="text-sm font-medium text-[var(--c-ink)]">{c.title}</div>
                <div className="text-[11px] text-[var(--c-ink-3)]">
                  {EVENT_TYPE_OPTIONS.find(([k]) => k === c.eventType)?.[1] ?? c.eventType} ·{" "}
                  {c.startDate}{c.endDate ? ` – ${c.endDate}` : ""} · {[c.city, c.country].filter(Boolean).join(", ")}
                  {c.organizer ? ` · ${c.organizer}` : ""}
                  {/* TTB kaydı işaretlenir: bu satırları elle düzenlemek ingest'le çakışır. */}
                  {c.ttbCode ? ` · TTB ${c.ttbCode}` : ""}
                </div>
              </div>
              <button type="button" onClick={() => remove(c.id)} disabled={busy}
                aria-label={`${c.title} kaydını sil`}
                className="shrink-0 rounded-lg border border-[var(--c-hairline)] p-1.5 text-[var(--c-ink-3)] hover:border-rose-400/40 hover:text-rose-300">
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
