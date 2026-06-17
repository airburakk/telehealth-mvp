"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2, Check, FlaskConical, Plus, Trash2 } from "lucide-react";

type Lab = { loinc: string; name: string; value: string; unit: string };
type LoincOption = { code: string; label: string };

// FHIR Faz 2 — vakanın laboratuvar sonuçları (LOINC kodlu) → /api/cases/:id/labs → Case.labResults → FHIR Observation.
export function LabResultsForm({
  caseId,
  initial,
  loincOptions,
}: {
  caseId: string;
  initial: Partial<Lab>[];
  loincOptions: LoincOption[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Lab[]>(
    initial.map((r) => ({ loinc: r.loinc ?? "", name: r.name ?? "", value: r.value ?? "", unit: r.unit ?? "" }))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  function update(i: number, patch: Partial<Lab>) {
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
    setSaved(false);
  }
  function pickLoinc(i: number, code: string) {
    const opt = loincOptions.find((o) => o.code === code);
    update(i, { loinc: code, name: opt && !rows[i].name ? opt.label : rows[i].name });
  }
  function addRow() {
    setRows([...rows, { loinc: "", name: "", value: "", unit: "" }]);
    setSaved(false);
  }
  function removeRow(i: number) {
    setRows(rows.filter((_, idx) => idx !== i));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setErr("");
    setSaved(false);
    try {
      const clean = rows.filter((r) => (r.loinc || r.name) && r.value.trim());
      const res = await fetch(`/api/cases/${caseId}/labs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labs: clean }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Kaydedilemedi.");
      setSaved(true);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <FlaskConical size={15} /> Laboratuvar Sonuçları (FHIR Observation)
      </div>
      <p className="mt-1 text-xs text-slate-400">LOINC kodlu lab sonuçları → FHIR Observation (kategori: laboratory).</p>

      {rows.length === 0 && <p className="mt-3 text-sm text-slate-400">Henüz lab sonucu eklenmedi.</p>}

      <div className="mt-3 space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_84px_64px_30px] items-center gap-2">
            <div className="flex gap-1">
              {loincOptions.length > 0 && (
                <select
                  value={r.loinc}
                  onChange={(e) => pickLoinc(i, e.target.value)}
                  title="Branşa özel LOINC"
                  className="w-[88px] shrink-0 rounded-lg border border-slate-300 bg-slate-50 px-2 py-2 text-xs text-slate-600 outline-none focus:border-[#0E9E97]"
                >
                  <option value="">LOINC…</option>
                  {loincOptions.map((o) => (
                    <option key={o.code} value={o.code}>{o.code}</option>
                  ))}
                </select>
              )}
              <input
                value={r.name}
                onChange={(e) => update(i, { name: e.target.value })}
                placeholder="test adı"
                className="w-full min-w-0 rounded-lg border border-slate-300 px-2 py-2 text-sm outline-none focus:border-[#0E9E97]"
              />
            </div>
            <input
              value={r.value}
              onChange={(e) => update(i, { value: e.target.value })}
              placeholder="değer"
              className="rounded-lg border border-slate-300 px-2 py-2 text-sm outline-none focus:border-[#0E9E97]"
            />
            <input
              value={r.unit}
              onChange={(e) => update(i, { unit: e.target.value })}
              placeholder="birim"
              className="rounded-lg border border-slate-300 px-2 py-2 text-sm outline-none focus:border-[#0E9E97]"
            />
            <button
              onClick={() => removeRow(i)}
              aria-label="Sil"
              className="grid h-8 w-7 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addRow}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
      >
        <Plus size={14} /> Sonuç ekle
      </button>

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

      <div className="mt-4">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-[#0E9E97] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0A7D77] disabled:opacity-60"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : <Save size={16} />}
          {saved ? "Kaydedildi" : "Lab sonuçlarını kaydet"}
        </button>
      </div>
    </div>
  );
}
