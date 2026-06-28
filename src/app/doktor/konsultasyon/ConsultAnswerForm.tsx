"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, FlaskConical, Scan, Pill, Plus, X } from "lucide-react";

export interface CatalogProps {
  labs: { loinc: string; name: string }[];
  imaging: { code: string; system: string; name: string }[];
  meds: { atc: string; name: string }[];
}

interface MedRec { atc: string; name: string; dose?: string; route?: string; freq?: string }

// M5 — Anonim konsültasyon talebine görüş + yapılandırılmış kodlu öneriler (lab/görüntüleme/ilaç) formu.
// Öneriler FHIR'e bağlanır (lab/görüntüleme=ServiceRequest, ilaç=MedicationRequest ATC); görüş hasta diline çevrilir.
export function ConsultAnswerForm({ id, catalog }: { id: string; catalog: CatalogProps }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");

  const [labs, setLabs] = useState<string[]>([]); // seçili LOINC kodları
  const [imaging, setImaging] = useState<string[]>([]); // seçili görüntüleme kodları
  const [meds, setMeds] = useState<MedRec[]>([]);
  const [medAtc, setMedAtc] = useState<string>(catalog.meds[0]?.atc ?? "");
  const [dose, setDose] = useState("");
  const [route, setRoute] = useState("");
  const [freq, setFreq] = useState("");

  function toggle(arr: string[], set: (v: string[]) => void, code: string) {
    set(arr.includes(code) ? arr.filter((x) => x !== code) : [...arr, code]);
  }

  function addMed() {
    const m = catalog.meds.find((x) => x.atc === medAtc);
    if (!m) return;
    if (meds.some((x) => x.atc === m.atc)) return;
    setMeds((p) => [...p, { atc: m.atc, name: m.name, dose: dose.trim() || undefined, route: route.trim() || undefined, freq: freq.trim() || undefined }]);
    setDose(""); setRoute(""); setFreq("");
  }

  async function submit() {
    if (!text.trim()) { setErr("Görüş metni boş olamaz."); return; }
    setSending(true);
    setErr("");
    try {
      const recommendedLabs = labs.map((loinc) => ({ loinc, name: catalog.labs.find((l) => l.loinc === loinc)?.name }));
      const recommendedImaging = imaging.map((code) => { const it = catalog.imaging.find((i) => i.code === code); return { code, system: it?.system, name: it?.name }; });
      const r = await fetch(`/api/consultation-requests/${id}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: text, recommendedLabs, recommendedImaging, medications: meds }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Gönderilemedi.");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Hata oluştu.");
      setSending(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#818cf8] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#6d75e0]">
        <Send size={14} /> Görüş ver
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div>
        <label className="text-xs font-semibold text-slate-500">Klinik görüş</label>
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setErr(""); }}
          rows={4}
          placeholder="Klinik görüşünüzü yazın (anonim dosya üzerinden; hasta diline otomatik çevrilir)…"
          className="mt-1 w-full resize-y rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-[#818cf8]"
        />
      </div>

      {/* Lab önerisi (LOINC → FHIR ServiceRequest) */}
      <div>
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500"><FlaskConical size={13} /> Lab tetkik önerisi</div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {catalog.labs.slice(0, 16).map((l) => (
            <Chip key={l.loinc} active={labs.includes(l.loinc)} onClick={() => toggle(labs, setLabs, l.loinc)}>{l.name}</Chip>
          ))}
        </div>
      </div>

      {/* Görüntüleme önerisi (LOINC/SNOMED → ServiceRequest) */}
      <div>
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Scan size={13} /> Görüntüleme önerisi</div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {catalog.imaging.slice(0, 12).map((it) => (
            <Chip key={it.code} active={imaging.includes(it.code)} onClick={() => toggle(imaging, setImaging, it.code)}>{it.name}</Chip>
          ))}
        </div>
      </div>

      {/* İlaç önerisi (ATC zorunlu → MedicationRequest) */}
      <div>
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Pill size={13} /> İlaç önerisi <span className="font-normal text-slate-400">(ATC kodlu)</span></div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <select value={medAtc} onChange={(e) => setMedAtc(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-[#818cf8]">
            {catalog.meds.map((m) => <option key={m.atc} value={m.atc}>{m.name} ({m.atc})</option>)}
          </select>
          <input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="doz (ör. 500mg)" className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-[#818cf8]" />
          <input value={route} onChange={(e) => setRoute(e.target.value)} placeholder="yol (oral)" className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-[#818cf8]" />
          <input value={freq} onChange={(e) => setFreq(e.target.value)} placeholder="sıklık (2x1)" className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-[#818cf8]" />
          <button type="button" onClick={addMed} className="inline-flex items-center gap-1 rounded-lg bg-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-300"><Plus size={13} /> Ekle</button>
        </div>
        {meds.length > 0 && (
          <ul className="mt-2 space-y-1">
            {meds.map((m, i) => (
              <li key={m.atc} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs">
                <span className="text-slate-700">{m.name} <span className="font-mono text-[9px] text-slate-400">{m.atc}</span>{m.dose ? ` · ${m.dose}` : ""}{m.route ? ` · ${m.route}` : ""}{m.freq ? ` · ${m.freq}` : ""}</span>
                <button type="button" onClick={() => setMeds((p) => p.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500"><X size={13} /></button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="flex items-center gap-2">
        <button onClick={submit} disabled={sending} className="inline-flex items-center gap-1.5 rounded-lg bg-[#818cf8] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#6d75e0] disabled:opacity-60">
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {sending ? "Gönderiliyor — görüş çevriliyor…" : "Gönder"}
        </button>
        <button onClick={() => { setOpen(false); setErr(""); }} disabled={sending} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-700">İptal</button>
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-full border px-2.5 py-1 text-xs transition ${active ? "border-[#818cf8] bg-[#818cf8] text-white" : "border-slate-300 bg-white text-slate-600 hover:border-[#818cf8]/50"}`}>
      {children}
    </button>
  );
}
