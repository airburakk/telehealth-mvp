"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, Loader2, ShieldCheck, Upload, FileText, X } from "lucide-react";
import type { FormStrings } from "./page";

interface DocItem { label: string; mime: string; dataUrl: string }

// Görüntü küçültme (CheckInForm deseni): max kenar 1280px · q0.8 (belge okunabilirliği için biraz büyük).
async function downscaleImage(file: File, max = 1280, quality = 0.8): Promise<string> {
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
  canvas.width = w; canvas.height = h;
  const cx = canvas.getContext("2d");
  if (!cx) return src;
  cx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(new Error("read"));
    fr.readAsDataURL(file);
  });
}

// M5 Faz 3+ — Partner konsültasyon talebi formu. Partner kendi yönlendirdiği hastanın klinik bilgisini +
// anonim tıbbi belge/sonuç/görüntüleme yükler; sunucuda scrub + AI değerlendirme (FHIR/çeviri) uygulanır.
export function PartnerRequestForm({
  branches,
  countries,
  languages,
  defaultCountry,
  defaultBranch,
  t,
  dir,
}: {
  branches: string[];
  countries: { code: string; name: string; flag: string }[];
  languages: string[];
  defaultCountry: string;
  defaultBranch: string | null;
  t: FormStrings;
  dir: "rtl" | "ltr";
}) {
  const router = useRouter();
  const [branchLimited, setBranchLimited] = useState<boolean>(!!defaultBranch);
  const [branch, setBranch] = useState<string>(defaultBranch ?? branches[0] ?? "");
  const [region, setRegion] = useState<string>(defaultCountry);
  const [language, setLanguage] = useState<string>(languages[0] ?? "Türkçe");
  const [urgency, setUrgency] = useState<number>(3);
  const [icd10Code, setIcd10] = useState<string>("");
  const [clinicalSummary, setSummary] = useState<string>("");
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function onFiles(files: FileList | null) {
    if (!files) return;
    setErr("");
    const next: DocItem[] = [];
    for (const f of Array.from(files).slice(0, 8)) {
      try {
        if (f.type === "application/pdf") {
          if (f.size > 8_000_000) { setErr(`${f.name}: ${t.errPdfBig}`); continue; }
          next.push({ label: f.name, mime: "application/pdf", dataUrl: await readAsDataUrl(f) });
        } else if (/^image\/(jpeg|png|webp|gif)$/.test(f.type)) {
          next.push({ label: f.name, mime: "image/jpeg", dataUrl: await downscaleImage(f) });
        } else {
          setErr(`${f.name}: ${t.errOnlyPdfImg}`);
        }
      } catch {
        setErr(`${f.name}: ${t.errUnreadable}`);
      }
    }
    setDocs((prev) => [...prev, ...next].slice(0, 8));
  }

  async function submit() {
    if (clinicalSummary.trim().length < 10) { setErr(t.errMinSummary); return; }
    setSaving(true);
    setErr("");
    try {
      const r = await fetch("/api/partner/consultation-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchLimited, branch, region, language, urgency, icd10Code, clinicalSummary, documents: docs }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || t.errSendFail);
      router.push("/partner");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.errGeneric);
      setSaving(false);
    }
  }

  return (
    <div dir={dir} className="mx-auto max-w-2xl px-5 py-8">
      <button onClick={() => router.push("/partner")} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={15} /> {t.back}
      </button>
      <h1 className="mt-3 text-2xl font-bold text-[#101010]">{t.title}</h1>

      <div className="mt-3 flex items-start gap-2 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-3 text-xs text-indigo-800">
        <ShieldCheck size={16} className="mt-0.5 shrink-0" />
        <span>{t.warning}</span>
      </div>

      <div className="mt-6 space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        {/* Branş sınırı */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={branchLimited} onChange={(e) => setBranchLimited(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            {t.branchLimit}
          </label>
          {branchLimited && (
            <select value={branch} onChange={(e) => setBranch(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#818cf8]">
              {branches.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          )}
          {!branchLimited && <p className="mt-1 text-xs text-slate-400">{t.branchUnlimited}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-700">{t.region}</label>
            <select value={region} onChange={(e) => setRegion(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#818cf8]">
              {countries.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">{t.patientLang}</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#818cf8]">
              {languages.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">{t.urgency}</label>
            <input type="number" min={1} max={5} value={urgency} onChange={(e) => setUrgency(Number(e.target.value))} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#818cf8]" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">{t.icd}</label>
            <input type="text" value={icd10Code} onChange={(e) => setIcd10(e.target.value)} placeholder="ör. C61" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#818cf8]" />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">{t.summary}</label>
          <textarea
            value={clinicalSummary}
            onChange={(e) => { setSummary(e.target.value); setErr(""); }}
            rows={6}
            placeholder={t.summaryPlaceholder}
            className="mt-1.5 w-full resize-y rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-[#818cf8]"
          />
        </div>

        {/* Tıbbi belge / sonuç / görüntüleme yükleme (anonim; AI ile değerlendirilir + TR çeviri + FHIR) */}
        <div>
          <label className="text-sm font-medium text-slate-700">{t.docsLabel} <span className="font-normal text-slate-400">{t.docsOptional}</span></label>
          <p className="mt-0.5 text-xs text-slate-400">{t.docsHelp}</p>
          <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:border-[#818cf8] hover:bg-slate-50">
            <Upload size={15} /> {t.addDoc}
            <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
          </label>
          {docs.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {docs.map((d, i) => (
                <li key={i} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <span className="inline-flex min-w-0 items-center gap-1.5 text-slate-700"><FileText size={14} className="shrink-0 text-slate-400" /> <span className="truncate">{d.label}</span></span>
                  <button type="button" onClick={() => setDocs((p) => p.filter((_, j) => j !== i))} className="shrink-0 text-slate-400 hover:text-red-500"><X size={15} /></button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {err && <p className="text-sm text-red-600">{err}</p>}

        <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#818cf8] px-5 py-3 text-sm font-semibold text-white hover:bg-[#6d75e0] disabled:opacity-60">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} {saving ? t.submitting : t.submit}
        </button>
      </div>
    </div>
  );
}
