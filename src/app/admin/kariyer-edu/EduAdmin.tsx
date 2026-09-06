"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Trash2, X } from "lucide-react";
import type { EduOpportunityView } from "@/lib/edu-store";

// lib/edu-opportunities EDU_KIND_LABEL ile aynı sıra/etiket (client bileşen db'li modül import etmesin diye elle).
const KIND_OPTIONS = [["burs", "Burs / destek"], ["staj", "Staj / gözlemcilik"], ["degisim", "Değişim programı"]] as const;

export function EduAdmin({ rows }: { rows: EduOpportunityView[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function call(method: "POST" | "PATCH" | "DELETE", body: unknown, key: string) {
    setBusy(key); setErr(null);
    try {
      const res = await fetch("/api/admin/edu-opportunity", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "İşlem yapılamadı.");
      router.refresh();
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "İşlem yapılamadı.");
      return false;
    } finally {
      setBusy(null);
    }
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget; const f = new FormData(form);
    const ok = await call("POST", {
      kind: f.get("kind"), title: f.get("title"), organizer: f.get("organizer"), country: f.get("country"), deadline: f.get("deadline"),
      deadlineNote: f.get("deadlineNote"), startsAt: f.get("startsAt"), eligibility: f.get("eligibility"), sourceUrl: f.get("sourceUrl"),
      verifiedAt: f.get("verifiedAt"), approve: f.get("approve") === "on",
    }, "new");
    if (ok) form.reset();
  }

  const input = "w-full rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3 py-2 text-sm text-[var(--c-ink)]";
  const label = "block text-[11px] uppercase tracking-wider text-[var(--c-ink-3)]";
  return (
    <div className="mt-6 space-y-8">
      <form onSubmit={submit} className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-5">
        <h2 className="text-[15px] font-semibold text-[var(--c-ink)]">Yeni fırsat</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2"><span className={label}>Başlık</span><input name="title" required minLength={8} className={input} placeholder="TEV Üniversite Eğitim Bursu 2026-2027" /></label>
          <label><span className={label}>Tür</span>
            <select name="kind" className={input}>{KIND_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </label>
          <label><span className={label}>Kurum</span><input name="organizer" required className={input} placeholder="Türk Eğitim Vakfı" /></label>
          <label><span className={label}>Ülke (ISO, boş = çok ülkeli)</span><input name="country" maxLength={2} className={input} placeholder="TR" /></label>
          <label><span className={label}>Son başvuru (gün)</span><input name="deadline" type="date" className={input} /></label>
          <label className="sm:col-span-2"><span className={label}>Dönemsel not (tarih yoksa zorunlu)</span><input name="deadlineNote" className={input} placeholder="dönemsel — genelde Ekim–Kasım; 2026-27 takvimi duyurusuyla" /></label>
          <label><span className={label}>Başlangıç (serbest)</span><input name="startsAt" className={input} placeholder="Yaz 2027" /></label>
          <label><span className={label}>Doğrulama günü</span><input name="verifiedAt" type="date" className={input} /></label>
          <label className="sm:col-span-2"><span className={label}>Şart özeti (kısa)</span><textarea name="eligibility" required minLength={20} rows={3} className={input} placeholder="Tıp fakültesi öğrencisi; not ortalaması ≥ …; …" /></label>
          <label className="sm:col-span-2"><span className={label}>Kaynak (https, kurumun kendi sayfası)</span><input name="sourceUrl" type="url" required className={input} placeholder="https://…" /></label>
          <label className="flex items-center gap-2 text-sm text-[var(--c-ink-2)] sm:col-span-2"><input name="approve" type="checkbox" /> Kaydı hemen yayına al (👤 onay)</label>
        </div>
        {err && <p className="mt-3 text-sm text-[var(--c-danger,#f87171)]">{err}</p>}
        <button type="submit" disabled={busy === "new"} className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[var(--c-accent)] px-4 py-2 text-sm font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)] disabled:opacity-60">
          {busy === "new" ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Kaydet
        </button>
      </form>

      <section>
        <h2 className="text-[15px] font-semibold text-[var(--c-ink)]">Kayıtlar <span className="aura-mono text-[11px] text-[var(--c-ink-3)]">{rows.length} · onaylı {rows.filter((r) => r.approvedAt).length}</span></h2>
        <ul className="mt-3 divide-y divide-[var(--c-hairline)] rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-panel)]">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="aura-mono text-[10px] uppercase tracking-wider text-[var(--c-ink-3)]">
                  {KIND_OPTIONS.find(([k]) => k === r.kind)?.[1] ?? r.kind} · {r.country ?? "çok ülkeli"} · {r.deadline ? `son başvuru ${r.deadline}` : r.deadlineNote} · takip {r.followers ?? 0}
                </div>
                <div className="text-[14px] font-semibold text-[var(--c-ink)]">{r.title}</div>
                <div className="text-[12px] text-[var(--c-ink-2)]">{r.organizer} · doğrulama {r.verifiedAt} · {r.approvedAt ? `yayında (${r.approvedAt})` : "onay bekliyor (gizli)"}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" disabled={busy === r.id} onClick={() => call("PATCH", { id: r.id, approved: !r.approvedAt }, r.id)}
                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[12px] font-semibold ${r.approvedAt ? "border-[var(--c-hairline)] text-[var(--c-ink-2)]" : "border-[var(--c-accent)]/50 bg-[var(--c-accent)]/12 text-[var(--c-accent)]"}`}>
                  {busy === r.id ? <Loader2 size={13} className="animate-spin" /> : r.approvedAt ? <X size={13} /> : <Check size={13} />} {r.approvedAt ? "Yayından kaldır" : "Onayla"}
                </button>
                <button type="button" disabled={busy === r.id} onClick={() => { if (confirm(`"${r.title}" silinsin mi? Takipler de silinir.`)) void call("DELETE", { id: r.id }, r.id); }}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--c-hairline)] px-2.5 py-1 text-[12px] text-[var(--c-ink-3)] hover:text-[var(--c-danger,#f87171)]" title="Sil">
                  <Trash2 size={13} />
                </button>
              </div>
            </li>
          ))}
          {rows.length === 0 && <li className="px-4 py-6 text-center text-sm text-[var(--c-ink-3)]">Kayıt yok — E1 verisi için `npx tsx scripts/seed-edu-opportunities.ts`.</li>}
        </ul>
      </section>
    </div>
  );
}
