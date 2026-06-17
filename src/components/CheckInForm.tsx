"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { severityMeta, postopChecklist, type Severity } from "@/lib/postop";
import { Thermometer, Activity, Pill, Camera, Loader2, Send, AlertTriangle, CheckCircle2, X, ListChecks } from "lucide-react";

// İyileşme fotoğrafını tarayıcıda küçültüp JPEG data-URL'e çevirir (S3 yok; AI vision'a + DB'ye uygun, hafif boyut).
// max kenar 720px · q0.75 ≈ 60-120KB. Başarısızlıkta akışı bozma (fotoğraf atlanır).
async function downscaleImage(file: File, max = 720, quality = 0.75): Promise<string> {
  const src = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(new Error("read"));
    fr.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("decode"));
    im.src = src;
  });
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const cx = canvas.getContext("2d");
  if (!cx) return src;
  cx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

export function CheckInForm({ caseId, branch }: { caseId: string; branch: string }) {
  const router = useRouter();
  const items = postopChecklist(branch);
  const [pain, setPain] = useState(2);
  const [feverC, setFeverC] = useState(36.6);
  const [meds, setMeds] = useState(true);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<string>("");
  const [preparing, setPreparing] = useState(false);
  const [checklist, setChecklist] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ severity: Severity; reasons: string[] } | null>(null);

  async function onPickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ""; // aynı dosya tekrar seçilebilsin
    if (!f) return;
    setPreparing(true);
    try {
      setPhoto(await downscaleImage(f));
    } catch {
      // küçültme başarısız → fotoğrafı atla; check-in fotoğrafsız devam eder
    } finally {
      setPreparing(false);
    }
  }

  async function submit() {
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/checkin`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pain, feverC, meds, note, photo, checklist }),
      });
      const data = await res.json();
      setResult({ severity: data.severity, reasons: data.reasons });
      setNote(""); setPhoto(""); setChecklist({});
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  const m = result ? severityMeta(result.severity) : null;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="font-bold text-slate-800">Bugünkü kontrol</h2>
      <p className="text-sm text-slate-500">Durumunuzu paylaşın; ekibiniz uzaktan izliyor.</p>

      {/* Ağrı */}
      <div className="mt-5">
        <div className="flex items-center justify-between text-sm">
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700"><Activity size={15} /> Ağrı düzeyi</span>
          <span className="font-semibold text-[#101010]">{pain}/10</span>
        </div>
        <input type="range" min={0} max={10} value={pain} onChange={(e) => setPain(Number(e.target.value))} className="mt-2 w-full accent-[#14C3D0]" />
      </div>

      {/* Ateş */}
      <div className="mt-4">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700"><Thermometer size={15} /> Ateş (°C)</span>
        <input
          type="number" step="0.1" min={34} max={43} value={feverC}
          onChange={(e) => setFeverC(Number(e.target.value))}
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#14C3D0]"
        />
      </div>

      {/* İlaç */}
      <button onClick={() => setMeds((v) => !v)} className="mt-4 flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 text-left hover:border-slate-300">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-700"><Pill size={16} className="text-slate-500" /> İlaçlarımı aldım</span>
        <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${meds ? "bg-emerald-500" : "bg-slate-300"}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${meds ? "left-[22px]" : "left-0.5"}`} />
        </span>
      </button>

      {/* Branşa özel günlük kontrol */}
      {items.length > 0 && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <ListChecks size={14} /> {branch} · günlük kontrol
          </div>
          <div className="mt-2.5 space-y-2.5">
            {items.map((it) => (
              <div key={it.id}>
                <div className="text-sm text-slate-700">{it.label}</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {it.options.map((o) => {
                    const active = checklist[it.id] === o.v;
                    return (
                      <button
                        key={o.v}
                        type="button"
                        onClick={() => setChecklist((p) => ({ ...p, [it.id]: active ? "" : o.v }))}
                        className={`rounded-full border px-2.5 py-1 text-xs transition ${active ? "border-[#14C3D0] bg-[#14C3D0] text-[#101010]" : "border-slate-300 bg-white text-slate-600 hover:border-[#14C3D0]/40"}`}
                      >
                        {o.v}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Not */}
      <div className="mt-4">
        <span className="text-sm font-medium text-slate-700">Belirti / not</span>
        <textarea
          value={note} onChange={(e) => setNote(e.target.value)} rows={3}
          placeholder="Örn. Yara bölgesinde hafif kızarıklık var…"
          className="mt-1.5 w-full resize-none rounded-lg border border-slate-300 p-2.5 text-sm outline-none focus:border-[#14C3D0]"
        />
      </div>

      {/* Foto — küçültülüp AI görsel ön-değerlendirmesine gönderilir */}
      {photo ? (
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="İyileşme fotoğrafı" className="h-16 w-16 shrink-0 rounded-md object-cover ring-1 ring-slate-200" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-slate-700">Fotoğraf eklendi</div>
            <div className="text-xs text-slate-400">Gönderince AI görsel ön-değerlendirme yapar.</div>
          </div>
          <button type="button" onClick={() => setPhoto("")} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>
      ) : (
        <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-600 hover:border-teal-400">
          {preparing ? <Loader2 size={16} className="animate-spin text-slate-400" /> : <Camera size={16} className="text-slate-400" />}
          {preparing ? "Fotoğraf hazırlanıyor…" : "İyileşme fotoğrafı ekle (opsiyonel)"}
          <input type="file" accept="image/*" className="hidden" disabled={preparing} onChange={onPickPhoto} />
        </label>
      )}

      <button onClick={submit} disabled={submitting} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#14C3D0] px-4 py-3 text-sm font-semibold text-[#101010] hover:bg-[#0EA5B2] disabled:opacity-60">
        {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Kontrolü gönder
      </button>

      {/* Sonuç */}
      {result && m && (
        <div className={`mt-4 rounded-2xl p-4 ring-1 ${m.badge}`}>
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
