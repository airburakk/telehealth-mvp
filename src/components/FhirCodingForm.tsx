"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2, Check, Stethoscope } from "lucide-react";

// FHIR Faz 0 — vakanın klinik kodlama alanları (ICD-10 tanı + hasta kimliği).
// /api/cases/:id/coding'e kaydeder; alanlar FHIR dışa aktarımını besler (Condition.code + Patient.identifier).
export function FhirCodingForm({
  caseId,
  icd10Code,
  patientIdentifier,
  patientIdentifierType,
}: {
  caseId: string;
  icd10Code: string | null;
  patientIdentifier: string | null;
  patientIdentifierType: string | null;
}) {
  const router = useRouter();
  const [icd, setIcd] = useState(icd10Code ?? "");
  const [pid, setPid] = useState(patientIdentifier ?? "");
  const [ptype, setPtype] = useState(patientIdentifierType ?? "TC");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setSaving(true);
    setErr("");
    setSaved(false);
    try {
      const r = await fetch(`/api/cases/${caseId}/coding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icd10Code: icd, patientIdentifier: pid, patientIdentifierType: ptype }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Kaydedilemedi.");
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
        <Stethoscope size={15} /> Klinik Kodlama (FHIR)
      </div>
      <p className="mt-1 text-xs text-slate-400">
        FHIR dışa aktarımını besler: tanı → Condition (ICD-10), hasta kimliği → Patient.identifier.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-slate-700">Tanı ICD-10 kodu</label>
          <input
            value={icd}
            onChange={(e) => { setIcd(e.target.value); setSaved(false); }}
            placeholder="ör. I20.9"
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase outline-none focus:border-[#0E9E97]"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Hasta kimlik no</label>
          <div className="mt-1.5 flex gap-2">
            <select
              value={ptype}
              onChange={(e) => { setPtype(e.target.value); setSaved(false); }}
              className="rounded-lg border border-slate-300 px-2 py-2 text-sm outline-none focus:border-[#0E9E97]"
            >
              <option value="TC">TC</option>
              <option value="PASSPORT">Pasaport</option>
              <option value="OTHER">Diğer</option>
            </select>
            <input
              value={pid}
              onChange={(e) => { setPid(e.target.value); setSaved(false); }}
              placeholder="kimlik / pasaport no"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0E9E97]"
            />
          </div>
        </div>
      </div>

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

      <button
        onClick={save}
        disabled={saving}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#0E9E97] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0A7D77] disabled:opacity-60"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : <Save size={16} />}
        {saved ? "Kaydedildi" : "Kodlamayı kaydet"}
      </button>
    </div>
  );
}
