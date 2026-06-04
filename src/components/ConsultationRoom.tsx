"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { urgencyStyle, countryFlag, countryName } from "@/lib/constants";
import {
  Video, VideoOff, Mic, MicOff, PhoneOff, Camera, Sparkles, FileText,
  Save, Check, Pill, FlaskConical, Stethoscope, AlertTriangle, Languages, Loader2, Luggage,
} from "lucide-react";

interface CaseData {
  id: string; patientName: string; country: string; language: string;
  branch: string; urgency: number; confidence: number; symptoms: string; reasoning: string; files: string[];
}
interface DoctorData { title: string; name: string; branch: string; color: string; }

export function ConsultationRoom({
  consultationId, status, initialNotes, doctor, caseData,
}: { consultationId: string; status: string; initialNotes: string; doctor: DoctorData; caseData: CaseData }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camOn, setCamOn] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camError, setCamError] = useState("");
  const [notes, setNotes] = useState(initialNotes);
  const [saved, setSaved] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ending, setEnding] = useState(false);
  const ended = status === "ENDED";

  const u = urgencyStyle(caseData.urgency);

  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  async function toggleCam() {
    setCamError("");
    if (camOn) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setCamOn(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
      setCamOn(true);
    } catch {
      setCamError("Kameraya erişilemedi. Tarayıcı izni gerekebilir (demo).");
    }
  }

  async function saveNotes() {
    setSaving(true);
    try {
      await fetch(`/api/consultations/${consultationId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      setSaved(true);
    } finally { setSaving(false); }
  }

  async function endCall() {
    setEnding(true);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    try {
      await fetch(`/api/consultations/${consultationId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes, status: "ENDED" }),
      });
      router.push(`/doktor/vaka/${caseData.id}`);
    } catch { setEnding(false); }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
          {ended ? "Görüşme sona erdi" : "Canlı görüşme"} · Doktor görünümü (kokpit)
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
          Hasta tarafında sade arayüz gösterilir
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* Video alanı */}
        <div className="space-y-3">
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-slate-900 shadow-lg">
            {/* Uzak taraf (hasta) yer tutucu */}
            <div className="absolute inset-0 grid place-items-center text-center">
              <div>
                <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-white/10 text-2xl font-bold text-white">
                  {caseData.patientName.slice(0, 1)}
                </div>
                <div className="mt-3 font-medium text-white/90">{caseData.patientName}</div>
                <div className="text-xs text-white/50">{countryFlag(caseData.country)} {countryName(caseData.country)} · bağlanıyor…</div>
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
                  <Languages size={13} /> Canlı çeviri: {caseData.language} ⇄ Türkçe (demo)
                </div>
              </div>
            </div>

            {/* Doktor self-view */}
            <div className="absolute bottom-3 right-3 h-28 w-44 overflow-hidden rounded-xl border border-white/20 bg-black/60 shadow-lg">
              <video ref={videoRef} muted playsInline className={`h-full w-full object-cover ${camOn ? "" : "hidden"}`} />
              {!camOn && (
                <div className="grid h-full place-items-center text-center text-[11px] text-white/50">
                  <div><Camera size={18} className="mx-auto mb-1" /> Kameranız kapalı</div>
                </div>
              )}
            </div>

            {/* Kontroller */}
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2">
              <button onClick={toggleCam} className={`grid h-11 w-11 place-items-center rounded-full ${camOn ? "bg-white text-slate-800" : "bg-white/15 text-white hover:bg-white/25"}`}>
                {camOn ? <Video size={18} /> : <VideoOff size={18} />}
              </button>
              <button onClick={() => setMicOn((m) => !m)} className={`grid h-11 w-11 place-items-center rounded-full ${micOn ? "bg-white/15 text-white hover:bg-white/25" : "bg-white text-slate-800"}`}>
                {micOn ? <Mic size={18} /> : <MicOff size={18} />}
              </button>
              <button onClick={endCall} disabled={ending} className="inline-flex h-11 items-center gap-2 rounded-full bg-red-600 px-5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                {ending ? <Loader2 size={17} className="animate-spin" /> : <PhoneOff size={17} />} Bitir
              </button>
            </div>
          </div>

          {camError && (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 ring-1 ring-amber-200">{camError}</div>
          )}

          {/* AI kritik not */}
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
            <div className="text-sm text-amber-800">
              <span className="font-semibold">AI Kritik Uyarı (demo):</span> Hasta dosyasında alerji/ilaç etkileşimi taranıyor. Yüksek aciliyetli vakalarda koordinatör onayı önerilir.
            </div>
          </div>
        </div>

        {/* Sağ panel: vaka + not */}
        <aside className="space-y-4">
          {/* Vaka özeti */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-800">{caseData.patientName}</h2>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${u.badge}`}>
                <span className={`h-2 w-2 rounded-full ${u.dot}`} /> {caseData.urgency}/5
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm">
              <Stethoscope size={14} className="text-[#16467a]" />
              <span className="font-medium text-[#16467a]">{caseData.branch}</span>
            </div>

            <div className="mt-3">
              <div className="text-xs uppercase tracking-wide text-slate-400">Şikayet</div>
              <p className="mt-1 text-sm text-slate-700">{caseData.symptoms}</p>
            </div>

            <div className="mt-3 rounded-lg bg-sky-50/70 p-3 ring-1 ring-sky-100">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-sky-700"><Sparkles size={13} /> AI özeti</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{caseData.reasoning}</p>
            </div>

            {caseData.files.length > 0 && (
              <div className="mt-3">
                <div className="text-xs uppercase tracking-wide text-slate-400">Belgeler</div>
                <ul className="mt-1.5 space-y-1">
                  {caseData.files.map((f) => (
                    <li key={f} className="flex items-center gap-1.5 text-xs text-slate-600"><FileText size={13} className="text-sky-600" /> {f}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Not paneli */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Görüşme Notları</div>
              {saved ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600"><Check size={13} /> kaydedildi</span>
              ) : (
                <span className="text-[11px] text-amber-600">kaydedilmedi</span>
              )}
            </div>
            <textarea
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setSaved(false); }}
              rows={6}
              placeholder="SOAP notu: Subjektif / Objektif / Değerlendirme / Plan…"
              disabled={ended}
              className="mt-2 w-full resize-none rounded-lg border border-slate-300 p-2.5 text-sm outline-none focus:border-[#0f2a4a]"
            />
            <button
              onClick={saveNotes}
              disabled={saving || saved || ended}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0f2a4a] px-3 py-2 text-sm font-semibold text-white hover:bg-[#143a63] disabled:opacity-50"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Notu kaydet
            </button>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <QuickAction icon={<Pill size={14} />}>Reçete</QuickAction>
              <QuickAction icon={<FlaskConical size={14} />}>Lab iste</QuickAction>
            </div>
          </div>

          {/* Tedavi kararı → Modül 3 */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Tedavi Kararı</div>
            <p className="mt-1 text-xs text-slate-600">Tedaviye karar verildiyse hastaya uçtan uca sağlık turizmi paketi sunun.</p>
            <button
              onClick={() => router.push(`/paket/${caseData.id}`)}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <Luggage size={16} /> Sağlık Turizmi Paketi
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function QuickAction({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-400" title="Yakında">
      {icon} {children}
    </button>
  );
}
