"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { severityMeta, type Severity } from "@/lib/postop";
import { Thermometer, Activity, Pill, Camera, Loader2, Send, AlertTriangle, CheckCircle2, X } from "lucide-react";

export function CheckInForm({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [pain, setPain] = useState(2);
  const [feverC, setFeverC] = useState(36.6);
  const [meds, setMeds] = useState(true);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ severity: Severity; reasons: string[] } | null>(null);

  async function submit() {
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/checkin`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pain, feverC, meds, note, photo }),
      });
      const data = await res.json();
      setResult({ severity: data.severity, reasons: data.reasons });
      setNote(""); setPhoto("");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  const m = result ? severityMeta(result.severity) : null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="font-bold text-slate-800">Bugünkü kontrol</h2>
      <p className="text-sm text-slate-500">Durumunuzu paylaşın; ekibiniz uzaktan izliyor.</p>

      {/* Ağrı */}
      <div className="mt-5">
        <div className="flex items-center justify-between text-sm">
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700"><Activity size={15} /> Ağrı düzeyi</span>
          <span className="font-semibold text-[#0f2a4a]">{pain}/10</span>
        </div>
        <input type="range" min={0} max={10} value={pain} onChange={(e) => setPain(Number(e.target.value))} className="mt-2 w-full accent-[#0f2a4a]" />
      </div>

      {/* Ateş */}
      <div className="mt-4">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700"><Thermometer size={15} /> Ateş (°C)</span>
        <input
          type="number" step="0.1" min={34} max={43} value={feverC}
          onChange={(e) => setFeverC(Number(e.target.value))}
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0f2a4a]"
        />
      </div>

      {/* İlaç */}
      <button onClick={() => setMeds((v) => !v)} className="mt-4 flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 text-left hover:border-slate-300">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-700"><Pill size={16} className="text-slate-500" /> İlaçlarımı aldım</span>
        <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${meds ? "bg-emerald-500" : "bg-slate-300"}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${meds ? "left-[22px]" : "left-0.5"}`} />
        </span>
      </button>

      {/* Not */}
      <div className="mt-4">
        <span className="text-sm font-medium text-slate-700">Belirti / not</span>
        <textarea
          value={note} onChange={(e) => setNote(e.target.value)} rows={3}
          placeholder="Örn. Yara bölgesinde hafif kızarıklık var…"
          className="mt-1.5 w-full resize-none rounded-lg border border-slate-300 p-2.5 text-sm outline-none focus:border-[#0f2a4a]"
        />
      </div>

      {/* Foto */}
      <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-600 hover:border-sky-400">
        <Camera size={16} className="text-slate-400" />
        {photo ? photo : "İyileşme fotoğrafı ekle (opsiyonel)"}
        <input type="file" accept="image/*" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0]?.name ?? "")} />
        {photo && <X size={15} className="ml-auto text-slate-400" onClick={(e) => { e.preventDefault(); setPhoto(""); }} />}
      </label>

      <button onClick={submit} disabled={submitting} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0f2a4a] px-4 py-3 text-sm font-semibold text-white hover:bg-[#143a63] disabled:opacity-60">
        {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Kontrolü gönder
      </button>

      {/* Sonuç */}
      {result && m && (
        <div className={`mt-4 rounded-xl p-4 ring-1 ${m.badge}`}>
          <div className="flex items-center gap-2 font-semibold">
            {result.severity === "RED" ? <AlertTriangle size={18} /> : result.severity === "WATCH" ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            {result.severity === "NONE" ? "İyileşme normal" : result.severity === "WATCH" ? "İzleme alındı" : "Acil: ekip bilgilendirildi"}
          </div>
          <ul className="mt-1.5 list-disc pl-5 text-sm">
            {result.reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
          {result.severity === "RED" && (
            <p className="mt-2 text-sm font-medium">Doktorunuz ve vaka koordinatörünüze acil bildirim gönderildi. Lütfen telefonunuzu açık tutun.</p>
          )}
        </div>
      )}
    </div>
  );
}
