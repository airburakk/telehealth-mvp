"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, Loader2, ShieldCheck } from "lucide-react";

// M5 Faz 3 — Partner konsültasyon talebi formu. Partner kendi yönlendirdiği hastanın klinik bilgisini girer;
// sunucu tarafında anonimleştirme (scrub) uygulanır → havuza yazılır.
export function PartnerRequestForm({
  branches,
  countries,
  languages,
  defaultCountry,
  defaultBranch,
}: {
  branches: string[];
  countries: { code: string; name: string; flag: string }[];
  languages: string[];
  defaultCountry: string;
  defaultBranch: string | null;
}) {
  const router = useRouter();
  const [branchLimited, setBranchLimited] = useState<boolean>(!!defaultBranch);
  const [branch, setBranch] = useState<string>(defaultBranch ?? branches[0] ?? "");
  const [region, setRegion] = useState<string>(defaultCountry);
  const [language, setLanguage] = useState<string>(languages[0] ?? "Türkçe");
  const [urgency, setUrgency] = useState<number>(3);
  const [icd10Code, setIcd10] = useState<string>("");
  const [clinicalSummary, setSummary] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    if (clinicalSummary.trim().length < 10) { setErr("Klinik özet en az 10 karakter olmalı."); return; }
    setSaving(true);
    setErr("");
    try {
      const r = await fetch("/api/partner/consultation-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchLimited, branch, region, language, urgency, icd10Code, clinicalSummary }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Gönderilemedi.");
      router.push("/partner");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Hata oluştu.");
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <button onClick={() => router.push("/partner")} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={15} /> Panel
      </button>
      <h1 className="mt-3 text-2xl font-bold text-[#101010]">Konsültasyon Talebi Oluştur</h1>

      <div className="mt-3 flex items-start gap-2 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-3 text-xs text-indigo-800">
        <ShieldCheck size={16} className="mt-0.5 shrink-0" />
        <span>Girdiğiniz bilgi <strong>anonimleştirme</strong> katmanından geçirilir — yanlışlıkla yazılan ad / kimlik no / iletişim bilgisi otomatik maskelenir. Lütfen yine de hasta kimliği yazmayın.</span>
      </div>

      <div className="mt-6 space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        {/* Branş sınırı */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={branchLimited} onChange={(e) => setBranchLimited(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            Talebi belirli bir branşla sınırla
          </label>
          {branchLimited && (
            <select value={branch} onChange={(e) => setBranch(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#818cf8]">
              {branches.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          )}
          {!branchLimited && <p className="mt-1 text-xs text-slate-400">Sınırsız → tüm uzman hekimler genel havuzda görür.</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-slate-700">Hasta bölgesi / ülkesi</label>
            <select value={region} onChange={(e) => setRegion(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#818cf8]">
              {countries.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Hasta dili</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#818cf8]">
              {languages.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Aciliyet (1-5)</label>
            <input type="number" min={1} max={5} value={urgency} onChange={(e) => setUrgency(Number(e.target.value))} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#818cf8]" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">ICD-10 kodu (opsiyonel)</label>
            <input type="text" value={icd10Code} onChange={(e) => setIcd10(e.target.value)} placeholder="ör. C61" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#818cf8]" />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Klinik özet</label>
          <textarea
            value={clinicalSummary}
            onChange={(e) => { setSummary(e.target.value); setErr(""); }}
            rows={6}
            placeholder="Tanı, şikâyetler, ilgili tetkik/lab bulguları… (hasta kimliği YAZMAYIN)"
            className="mt-1.5 w-full resize-y rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-[#818cf8]"
          />
        </div>

        {err && <p className="text-sm text-red-600">{err}</p>}

        <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#818cf8] px-5 py-3 text-sm font-semibold text-white hover:bg-[#6d75e0] disabled:opacity-60">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Talebi gönder
        </button>
      </div>
    </div>
  );
}
