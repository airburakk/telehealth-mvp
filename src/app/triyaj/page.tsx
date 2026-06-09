"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COUNTRIES, urgencyStyle } from "@/lib/constants";
import { PreConsultGate } from "@/components/PreConsultGate";
import type { Billing } from "@/lib/billing";
import {
  UserRound, MessageSquareText, Paperclip, ClipboardCheck,
  Sparkles, Upload, X, ShieldCheck, Loader2, ArrowRight, ArrowLeft, FileText,
} from "lucide-react";

interface Analysis {
  branch: string;
  urgency: number;
  confidence: number;
  reasoning: string;
  engine?: "llm" | "rules";
}

const STEPS = [
  { t: "Hasta", icon: UserRound },
  { t: "Şikayet", icon: MessageSquareText },
  { t: "Belgeler", icon: Paperclip },
  { t: "Özet", icon: ClipboardCheck },
];

export default function TriyajPage() {
  const router = useRouter();
  const [billing, setBilling] = useState<Billing | null>(null);
  const [step, setStep] = useState(0);
  const [patientName, setPatientName] = useState("");
  const [country, setCountry] = useState("DZ");
  const [language, setLanguage] = useState("Arapça");
  const [symptoms, setSymptoms] = useState("");
  const [durationText, setDurationText] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const selectedCountry = COUNTRIES.find((c) => c.code === country);

  async function runAnalyze() {
    if (!symptoms.trim()) return;
    setAnalyzing(true);
    try {
      const res = await fetch("/api/triage/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symptoms, durationText }),
      });
      setAnalysis(await res.json());
    } catch {
      setError("Analiz sırasında hata oluştu.");
    } finally {
      setAnalyzing(false);
    }
  }

  function next() {
    setError("");
    if (step === 0 && !patientName.trim()) return setError("Lütfen hasta adını girin.");
    if (step === 1 && symptoms.trim().length < 8) return setError("Lütfen şikayetinizi biraz daha ayrıntılı yazın.");
    if (step === 2 && !analysis) runAnalyze();
    setStep((s) => Math.min(3, s + 1));
  }
  function back() {
    setError("");
    setStep((s) => Math.max(0, s - 1));
  }

  function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const names = Array.from(e.target.files ?? []).map((f) => f.name);
    setFiles((prev) => [...prev, ...names]);
    e.target.value = "";
  }

  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName, country, language, symptoms, durationText, attachments: files,
          consultFee: billing?.fee, payStatus: billing?.status, payMethod: billing?.method,
          policyNo: billing?.policyNo, payRef: billing?.payRef,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Hata");
      const created = await res.json();
      router.push(`/triyaj/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Vaka oluşturulamadı.");
      setSubmitting(false);
    }
  }

  const u = analysis ? urgencyStyle(analysis.urgency) : null;

  // Ön-konsültasyon kapısı: ücret bilgisi + sigorta/ödeme geçilmeden triyaj başlamaz
  if (!billing) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-10">
        <h1 className="text-2xl font-bold text-[#0f2a4a]">Triyaj · Ön Değerlendirme</h1>
        <p className="mt-1 text-sm text-slate-500">Görüşmeye başlamadan önce ücret bilgisi ve sigorta/ödeme adımı.</p>
        <div className="mt-7">
          <PreConsultGate onCleared={setBilling} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="text-2xl font-bold text-[#0f2a4a]">Triyaj · Ön Değerlendirme</h1>
      <p className="mt-1 text-sm text-slate-500">
        Birkaç adımda şikayetinizi anlatın; sistem sizi doğru uzmana yönlendirsin.
      </p>
      <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-200">
        <ShieldCheck size={15} />
        {billing.status === "INSURED"
          ? `Görüşme ${billing.insurer ?? "sigortanız"} tarafından karşılanıyor · Poliçe ${billing.policyNo}`
          : `Görüşme ücreti alındı: $${billing.fee} · Ref ${billing.payRef}`}
      </div>

      {/* Stepper */}
      <div className="mt-6 flex items-center">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = i < step;
          const active = i === step;
          return (
            <div key={s.t} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center">
                <span
                  className={`grid h-9 w-9 place-items-center rounded-full text-sm font-semibold ${
                    active ? "bg-[#0f2a4a] text-white" : done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"
                  }`}
                >
                  <Icon size={17} />
                </span>
                <span className={`mt-1 text-[11px] ${active ? "text-[#0f2a4a] font-semibold" : "text-slate-400"}`}>{s.t}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`mx-2 h-0.5 flex-1 rounded ${done ? "bg-emerald-500" : "bg-slate-200"}`} />}
            </div>
          );
        })}
      </div>

      <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {/* Step 0 */}
        {step === 0 && (
          <div className="space-y-4">
            <Field label="Hasta Adı (veya yakını)">
              <input
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Örn. Karim B."
                className="inp"
                autoFocus
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Ülke">
                <select
                  value={country}
                  onChange={(e) => {
                    setCountry(e.target.value);
                    const c = COUNTRIES.find((x) => x.code === e.target.value);
                    if (c) setLanguage(c.langs[0]);
                  }}
                  className="inp"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Dil">
                <select value={language} onChange={(e) => setLanguage(e.target.value)} className="inp">
                  {(selectedCountry?.langs ?? ["Türkçe"]).map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        )}

        {/* Step 1 */}
        {step === 1 && (
          <div className="space-y-4">
            <Field label="Şikayetiniz / Semptomlar">
              <textarea
                value={symptoms}
                onChange={(e) => { setSymptoms(e.target.value); setAnalysis(null); }}
                rows={5}
                placeholder="Örn. Babamda akciğer kanseri şüphesi var, biyopsi sonucu çıktı, ikinci görüş istiyoruz."
                className="inp resize-none"
                autoFocus
              />
            </Field>
            <Field label="Şikayet süresi (opsiyonel)">
              <input value={durationText} onChange={(e) => setDurationText(e.target.value)} placeholder="Örn. 2 ay" className="inp" />
            </Field>
            <button
              onClick={runAnalyze}
              disabled={analyzing || symptoms.trim().length < 8}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-50 px-3.5 py-2 text-sm font-medium text-sky-700 ring-1 ring-sky-200 hover:bg-sky-100 disabled:opacity-50"
            >
              {analyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              AI ön analizi yap
            </button>
            {analysis && u && (
              <AnalysisCard analysis={analysis} badge={u.badge} dot={u.dot} label={u.label} />
            )}
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="space-y-4">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center hover:border-sky-400 hover:bg-sky-50/40">
              <Upload size={26} className="text-slate-400" />
              <span className="text-sm font-medium text-slate-600">Tıbbi belge yükleyin</span>
              <span className="text-xs text-slate-400">PDF, JPG, DICOM · Tahlil, radyoloji, epikriz</span>
              <input type="file" multiple className="hidden" onChange={onFiles} accept=".pdf,.jpg,.jpeg,.png,.dcm" />
            </label>

            {files.length > 0 && (
              <ul className="space-y-2">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                    <span className="flex items-center gap-2 text-slate-700"><FileText size={16} className="text-sky-600" /> {f}</span>
                    <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500"><X size={16} /></button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 ring-1 ring-emerald-200">
              <ShieldCheck size={15} /> Yüklenen dosyalar KVKK/GDPR uyumlu şifreli olarak saklanır.
            </div>
            <p className="text-xs text-slate-400">Belge yüklemek opsiyoneldir; bu adımı atlayabilirsiniz.</p>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Summary k="Hasta" v={patientName} />
              <Summary k="Ülke / Dil" v={`${selectedCountry?.flag} ${selectedCountry?.name} · ${language}`} />
              <Summary k="Süre" v={durationText || "—"} />
              <Summary k="Belgeler" v={files.length ? `${files.length} dosya` : "—"} />
            </div>
            <Summary k="Şikayet" v={symptoms} block />

            {analyzing && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Analiz ediliyor…</div>}
            {analysis && u && <AnalysisCard analysis={analysis} badge={u.badge} dot={u.dot} label={u.label} />}
            {!analysis && !analyzing && (
              <button onClick={runAnalyze} className="inline-flex items-center gap-2 rounded-lg bg-sky-50 px-3.5 py-2 text-sm font-medium text-sky-700 ring-1 ring-sky-200 hover:bg-sky-100">
                <Sparkles size={16} /> Analizi çalıştır
              </button>
            )}
          </div>
        )}

        {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</div>}

        {/* Nav */}
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={back}
            disabled={step === 0}
            className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-0"
          >
            <ArrowLeft size={16} /> Geri
          </button>
          {step < 3 ? (
            <button onClick={next} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0f2a4a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#143a63]">
              Devam <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <ClipboardCheck size={16} />}
              Vakayı oluştur
            </button>
          )}
        </div>
      </div>

      <style>{`
        .inp { width:100%; border:1px solid #cbd5e1; border-radius:0.6rem; padding:0.55rem 0.75rem; font-size:0.9rem; outline:none; background:#fff; }
        .inp:focus { border-color:#0f2a4a; box-shadow:0 0 0 3px rgba(15,42,74,0.12); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function Summary({ k, v, block }: { k: string; v: string; block?: boolean }) {
  return (
    <div className={block ? "col-span-2" : ""}>
      <div className="text-xs uppercase tracking-wide text-slate-400">{k}</div>
      <div className="mt-0.5 text-slate-800">{v}</div>
    </div>
  );
}

function AnalysisCard({ analysis, badge, dot, label }: { analysis: Analysis; badge: string; dot: string; label: string }) {
  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sky-700">
        <Sparkles size={14} /> AI Ön Analizi
        {analysis.engine === "llm" && <span className="rounded-full bg-sky-600 px-1.5 py-0.5 text-[9px] tracking-normal text-white">Claude</span>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="rounded-lg bg-white px-2.5 py-1 text-sm font-semibold text-[#0f2a4a] ring-1 ring-slate-200">{analysis.branch}</span>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${badge}`}>
          <span className={`h-2 w-2 rounded-full ${dot}`} /> Aciliyet {analysis.urgency}/5 · {label}
        </span>
        <span className="text-xs text-slate-500">Güven %{analysis.confidence}</span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{analysis.reasoning}</p>
    </div>
  );
}
