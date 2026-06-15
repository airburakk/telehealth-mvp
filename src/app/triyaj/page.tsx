"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { COUNTRIES, LANGUAGES, urgencyStyle } from "@/lib/constants";
import { PreConsultGate } from "@/components/PreConsultGate";
import { BRANCHES } from "@/lib/triage";
import { DynamicTriageQuestions } from "@/components/DynamicTriageQuestions";
import { questionTexts } from "@/lib/triage-questions";
import { requiredDocs } from "@/lib/required-docs";
import { useT } from "@/components/useT";
import type { Billing } from "@/lib/billing";
import {
  UserRound, MessageSquareText, Paperclip, ClipboardCheck, ListChecks, Stethoscope,
  Sparkles, Upload, X, ShieldCheck, Loader2, ArrowRight, ArrowLeft, FileText, Globe, AlertTriangle,
} from "lucide-react";

// Hasta arayüzü çok dilli: sihirbazın tüm statik metinleri (çeviri /api/i18n cache'inden gelir)
const STATIC_UI = [
  "Triyaj · Ön Değerlendirme", "Görüşmeye başlamadan önce ücret bilgisi ve sigorta/ödeme adımı.",
  "Birkaç adımda şikayetinizi anlatın; sistem sizi doğru uzmana yönlendirsin.",
  "Arayüz dili", "Hasta", "Şikayet", "Branş Soruları", "Belgeler", "Özet",
  "Hasta Adı (veya yakını)", "Örn. Karim B.", "Ülke", "Dil",
  "Şikayetiniz / Semptomlar", "Örn. Babamda akciğer kanseri şüphesi var, biyopsi sonucu çıktı, ikinci görüş istiyoruz.",
  "Şikayet süresi (opsiyonel)", "Örn. 2 ay", "AI ön analizi yap",
  "AI sizi doğru branşa yönlendiriyor…", "Yönlendirilen branş", "elle seçildi", "AI önerisi · doğru değilse değiştirin",
  "Önce şikayet adımında AI ön analizini çalıştırın; sorular branşa göre belirir.",
  "Tıbbi belge yükleyin", "PDF, JPG, DICOM · Tahlil, radyoloji, epikriz",
  "Yüklenen dosyalar KVKK/GDPR uyumlu şifreli olarak saklanır.", "Belge yüklemek opsiyoneldir; bu adımı atlayabilirsiniz.",
  "Ülke / Dil", "Süre", "dosya", "Analiz ediliyor…", "Analizi çalıştır", "AI Ön Analizi", "Aciliyet", "Güven",
  "Geri", "Devam", "Vakayı oluştur",
  "Lütfen hasta adını girin.", "Lütfen şikayetinizi biraz daha ayrıntılı yazın.",
  "Görüşme ücreti alındı:", "Görüşme sigortanız tarafından karşılanıyor", "Poliçe",
  "Acil / Hayati", "Yüksek", "Orta", "Düşük", "Rutin / Elektif",
  "Bu branş için gerekli belgeler", "opsiyonel",
  "Zorunlu (*) belgeler işaretlenmedi — yükleyip işaretleyin veya Özet adımında eksik göndereceğinizi onaylayın.",
  "Eksik zorunlu belge", "Bu belgeleri görüşmeden önce ileteceğimi onaylıyorum.",
];

interface Analysis {
  branchKey: string;
  branch: string;
  urgency: number;
  confidence: number;
  reasoning: string;
  engine?: "llm" | "rules";
}

const STEPS = [
  { t: "Hasta", icon: UserRound },
  { t: "Şikayet", icon: MessageSquareText },
  { t: "Branş Soruları", icon: ListChecks },
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
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [branchOverride, setBranchOverride] = useState(""); // hasta branşı elle seçtiyse (branchKey)
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [providedDocs, setProvidedDocs] = useState<Record<string, boolean>>({}); // hasta beyanı: hangi gerekli belge sağlandı
  const [docAck, setDocAck] = useState(false); // eksik zorunlu belgeleri görüşmeden önce iletme onayı

  const selectedCountry = COUNTRIES.find((c) => c.code === country);

  async function runAnalyze() {
    if (!symptoms.trim()) return;
    setAnalyzing(true);
    try {
      const res = await fetch("/api/triage/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symptoms, durationText, answers, forceBranchKey: branchOverride || undefined }),
      });
      setAnalysis(await res.json());
    } catch {
      setError("Analiz sırasında hata oluştu.");
    } finally {
      setAnalyzing(false);
    }
  }

  // Soruların gösterileceği branş: hasta elle seçtiyse o, değilse AI'ın belirlediği.
  const effectiveBranch = branchOverride || analysis?.branchKey || "";
  // Branşa özel gerekli belgeler + işaretlenmemiş zorunlular (eksik belge botu)
  const branchDocs = effectiveBranch ? requiredDocs(effectiveBranch) : [];
  const missingRequired = branchDocs.filter((d) => d.required && !providedDocs[d.key]);

  // Arayüz dili — hasta dil seçince otomatik eşitlenir; üstteki seçiciden de değiştirilebilir.
  const [uiLang, setUiLang] = useState("Türkçe");
  const tTexts = useMemo(
    () => [...STATIC_UI, ...BRANCHES.map((b) => b.label), ...(effectiveBranch ? [...questionTexts(effectiveBranch), ...requiredDocs(effectiveBranch).map((d) => d.label)] : [])],
    [effectiveBranch]
  );
  const { t } = useT(uiLang, tTexts);

  function next() {
    setError("");
    if (step === 0 && !patientName.trim()) return setError("Lütfen hasta adını girin.");
    if (step === 1 && symptoms.trim().length < 8) return setError("Lütfen şikayetinizi biraz daha ayrıntılı yazın.");
    if (step === 1 && !analysis) runAnalyze(); // Branş Soruları'na geçerken branşı belirle
    if (step === 3) runAnalyze(); // Özet'e geçerken yanıt + branş seçimiyle yeniden değerlendir
    setStep((s) => Math.min(4, s + 1));
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
      // Gerekli belge durumu: kokpitte "Ön Değerlendirme"de görünür + eksikler koordinatöre bildirilir
      const providedLabels = branchDocs.filter((d) => providedDocs[d.key]).map((d) => d.label);
      const missingLabels = missingRequired.map((d) => d.label);
      const docSummary = branchDocs.length
        ? `${providedLabels.length ? "Sağlanan: " + providedLabels.join(", ") : "Sağlanan belge yok"}${missingLabels.length ? " · Eksik (zorunlu): " + missingLabels.join(", ") : ""}`
        : null;
      const outAnswers = docSummary ? { ...answers, "Gerekli Belgeler": docSummary } : answers;
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName, country, language, symptoms, durationText, attachments: files,
          answers: outAnswers, forceBranchKey: branchOverride || undefined,
          missingDocs: missingLabels,
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

  const langSelect = (
    <label className="inline-flex shrink-0 items-center gap-1.5 text-xs text-slate-500">
      <Globe size={14} />
      <span className="hidden sm:inline">{t("Arayüz dili")}</span>
      <select
        value={uiLang}
        onChange={(e) => setUiLang(e.target.value)}
        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-[#0E9E97]"
      >
        {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
      </select>
    </label>
  );

  // Ön-konsültasyon kapısı: ücret bilgisi + sigorta/ödeme geçilmeden triyaj başlamaz
  if (!billing) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#0A3F39]">{t("Triyaj · Ön Değerlendirme")}</h1>
            <p className="mt-1 text-sm text-slate-500">{t("Görüşmeye başlamadan önce ücret bilgisi ve sigorta/ödeme adımı.")}</p>
          </div>
          {langSelect}
        </div>
        <div className="mt-7">
          <PreConsultGate onCleared={setBilling} t={t} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0A3F39]">{t("Triyaj · Ön Değerlendirme")}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {t("Birkaç adımda şikayetinizi anlatın; sistem sizi doğru uzmana yönlendirsin.")}
          </p>
        </div>
        {langSelect}
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-200">
        <ShieldCheck size={15} />
        {billing.status === "INSURED"
          ? `${t("Görüşme sigortanız tarafından karşılanıyor")} (${billing.insurer ?? "—"}) · ${t("Poliçe")} ${billing.policyNo}`
          : `${t("Görüşme ücreti alındı:")} $${billing.fee} · Ref ${billing.payRef}`}
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
                    active ? "bg-[#0E9E97] text-white" : done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"
                  }`}
                >
                  <Icon size={17} />
                </span>
                <span className={`mt-1 text-[11px] ${active ? "text-[#0A3F39] font-semibold" : "text-slate-400"}`}>{t(s.t)}</span>
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
            <Field label={t("Hasta Adı (veya yakını)")}>
              <input
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder={t("Örn. Karim B.")}
                className="inp"
                autoFocus
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t("Ülke")}>
                <select
                  value={country}
                  onChange={(e) => {
                    setCountry(e.target.value);
                    const c = COUNTRIES.find((x) => x.code === e.target.value);
                    if (c) { setLanguage(c.langs[0]); setUiLang(c.langs[0]); }
                  }}
                  className="inp"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                  ))}
                </select>
              </Field>
              <Field label={t("Dil")}>
                {/* Hasta sistemdeki TÜM dilleri seçebilir (ülkeden bağımsız); ülke yalnız makul varsayılanı belirler */}
                <select value={language} onChange={(e) => { setLanguage(e.target.value); setUiLang(e.target.value); }} className="inp">
                  {LANGUAGES.map((l) => (
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
            <Field label={t("Şikayetiniz / Semptomlar")}>
              <textarea
                value={symptoms}
                onChange={(e) => { setSymptoms(e.target.value); setAnalysis(null); }}
                rows={5}
                placeholder={t("Örn. Babamda akciğer kanseri şüphesi var, biyopsi sonucu çıktı, ikinci görüş istiyoruz.")}
                className="inp resize-none"
                autoFocus
              />
            </Field>
            <Field label={t("Şikayet süresi (opsiyonel)")}>
              <input value={durationText} onChange={(e) => setDurationText(e.target.value)} placeholder={t("Örn. 2 ay")} className="inp" />
            </Field>
            <button
              onClick={runAnalyze}
              disabled={analyzing || symptoms.trim().length < 8}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-50 px-3.5 py-2 text-sm font-medium text-teal-700 ring-1 ring-teal-200 hover:bg-teal-100 disabled:opacity-50"
            >
              {analyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {t("AI ön analizi yap")}
            </button>
            {analysis && u && (
              <AnalysisCard analysis={analysis} badge={u.badge} dot={u.dot} label={u.label} t={t} />
            )}
          </div>
        )}

        {/* Step 2 — Branş Soruları */}
        {step === 2 && (
          <div className="space-y-4">
            {analyzing && !analysis && (
              <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> {t("AI sizi doğru branşa yönlendiriyor…")}</div>
            )}
            {effectiveBranch ? (
              <>
                <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-teal-700"><Stethoscope size={14} /> {t("Yönlendirilen branş")}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <select
                      value={effectiveBranch}
                      onChange={(e) => setBranchOverride(e.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-[#0A3F39] outline-none focus:border-[#0E9E97]"
                    >
                      {BRANCHES.map((b) => <option key={b.key} value={b.key}>{t(b.label)}</option>)}
                    </select>
                    {branchOverride
                      ? <span className="text-xs text-slate-500">{t("elle seçildi")}</span>
                      : analysis && <span className="text-xs text-slate-500">{t("AI önerisi · doğru değilse değiştirin")}</span>}
                  </div>
                </div>
                <DynamicTriageQuestions branchKey={effectiveBranch} value={answers} onChange={setAnswers} t={t} />
              </>
            ) : (
              !analyzing && (
                <div className="rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-400">
                  {t("Önce şikayet adımında AI ön analizini çalıştırın; sorular branşa göre belirir.")}
                </div>
              )
            )}
          </div>
        )}

        {/* Step 3 — Belgeler */}
        {step === 3 && (
          <div className="space-y-4">
            {branchDocs.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <ListChecks size={14} /> {t("Bu branş için gerekli belgeler")}
                </div>
                <ul className="mt-2.5 space-y-2">
                  {branchDocs.map((d) => (
                    <li key={d.key}>
                      <label className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={!!providedDocs[d.key]}
                          onChange={(e) => setProvidedDocs((p) => ({ ...p, [d.key]: e.target.checked }))}
                          className="mt-0.5 accent-[#0E9E97]"
                        />
                        <span className={d.required ? "text-slate-700" : "text-slate-500"}>
                          {t(d.label)}{" "}
                          {d.required
                            ? <span className="font-semibold text-red-500">*</span>
                            : <span className="text-[11px] text-slate-400">({t("opsiyonel")})</span>}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                {missingRequired.length > 0 && (
                  <p className="mt-2 flex items-start gap-1 text-[11px] text-amber-700">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    {t("Zorunlu (*) belgeler işaretlenmedi — yükleyip işaretleyin veya Özet adımında eksik göndereceğinizi onaylayın.")}
                  </p>
                )}
              </div>
            )}
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center hover:border-teal-400 hover:bg-teal-50/40">
              <Upload size={26} className="text-slate-400" />
              <span className="text-sm font-medium text-slate-600">{t("Tıbbi belge yükleyin")}</span>
              <span className="text-xs text-slate-400">{t("PDF, JPG, DICOM · Tahlil, radyoloji, epikriz")}</span>
              <input type="file" multiple className="hidden" onChange={onFiles} accept=".pdf,.jpg,.jpeg,.png,.dcm" />
            </label>

            {files.length > 0 && (
              <ul className="space-y-2">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                    <span className="flex items-center gap-2 text-slate-700"><FileText size={16} className="text-teal-600" /> {f}</span>
                    <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500"><X size={16} /></button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 ring-1 ring-emerald-200">
              <ShieldCheck size={15} /> {t("Yüklenen dosyalar KVKK/GDPR uyumlu şifreli olarak saklanır.")}
            </div>
            <p className="text-xs text-slate-400">{t("Belge yüklemek opsiyoneldir; bu adımı atlayabilirsiniz.")}</p>
          </div>
        )}

        {/* Step 4 — Özet */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Summary k={t("Hasta")} v={patientName} />
              <Summary k={t("Ülke / Dil")} v={`${selectedCountry?.flag} ${selectedCountry?.name} · ${language}`} />
              <Summary k={t("Süre")} v={durationText || "—"} />
              <Summary k={t("Belgeler")} v={files.length ? `${files.length} ${t("dosya")}` : "—"} />
            </div>
            <Summary k={t("Şikayet")} v={symptoms} block />

            {Object.keys(answers).length > 0 && (
              <div className="col-span-2">
                <div className="text-xs uppercase tracking-wide text-slate-400">
                  {t("Branş Soruları")}{effectiveBranch ? ` · ${t(BRANCHES.find((b) => b.key === effectiveBranch)?.label ?? "")}` : ""}
                </div>
                <ul className="mt-1 space-y-0.5 text-sm text-slate-700">
                  {Object.entries(answers).map(([k, v]) => (
                    <li key={k}><span className="text-slate-500">{t(k)}:</span> {v.split(",").map((s) => t(s.trim())).join(", ")}</li>
                  ))}
                </ul>
              </div>
            )}

            {missingRequired.length > 0 && (
              <div className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800 ring-1 ring-amber-200">
                <div className="flex items-center gap-1.5 font-semibold"><AlertTriangle size={15} /> {t("Eksik zorunlu belge")}</div>
                <ul className="mt-1 list-disc pl-5 text-[13px]">
                  {missingRequired.map((d) => <li key={d.key}>{t(d.label)}</li>)}
                </ul>
                <label className="mt-2 flex items-start gap-2 text-[13px] font-medium">
                  <input type="checkbox" checked={docAck} onChange={(e) => setDocAck(e.target.checked)} className="mt-0.5 accent-amber-600" />
                  <span>{t("Bu belgeleri görüşmeden önce ileteceğimi onaylıyorum.")}</span>
                </label>
              </div>
            )}
            {analyzing && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> {t("Analiz ediliyor…")}</div>}
            {analysis && u && <AnalysisCard analysis={analysis} badge={u.badge} dot={u.dot} label={u.label} t={t} />}
            {!analysis && !analyzing && (
              <button onClick={runAnalyze} className="inline-flex items-center gap-2 rounded-lg bg-teal-50 px-3.5 py-2 text-sm font-medium text-teal-700 ring-1 ring-teal-200 hover:bg-teal-100">
                <Sparkles size={16} /> {t("Analizi çalıştır")}
              </button>
            )}
          </div>
        )}

        {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{t(error)}</div>}

        {/* Nav */}
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={back}
            disabled={step === 0}
            className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-0"
          >
            <ArrowLeft size={16} /> {t("Geri")}
          </button>
          {step < 4 ? (
            <button onClick={next} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0E9E97] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0A7D77]">
              {t("Devam")} <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={submitting || (missingRequired.length > 0 && !docAck)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <ClipboardCheck size={16} />}
              {t("Vakayı oluştur")}
            </button>
          )}
        </div>
      </div>

      <style>{`
        .inp { width:100%; border:1px solid #cbd5e1; border-radius:0.6rem; padding:0.55rem 0.75rem; font-size:0.9rem; outline:none; background:#fff; }
        .inp:focus { border-color:#0E9E97; box-shadow:0 0 0 3px rgba(14,158,151,0.15); }
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

function AnalysisCard({ analysis, badge, dot, label, t = (s) => s }: { analysis: Analysis; badge: string; dot: string; label: string; t?: (s: string) => string }) {
  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-teal-700">
        <Sparkles size={14} /> {t("AI Ön Analizi")}
        {analysis.engine === "llm" && <span className="rounded-full bg-teal-600 px-1.5 py-0.5 text-[9px] tracking-normal text-white">Claude</span>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="rounded-lg bg-white px-2.5 py-1 text-sm font-semibold text-[#0A3F39] ring-1 ring-slate-200">{t(analysis.branch)}</span>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${badge}`}>
          <span className={`h-2 w-2 rounded-full ${dot}`} /> {t("Aciliyet")} {analysis.urgency}/5 · {t(label)}
        </span>
        <span className="text-xs text-slate-500">{t("Güven")} %{analysis.confidence}</span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{analysis.reasoning}</p>
    </div>
  );
}
