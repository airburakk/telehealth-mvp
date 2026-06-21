"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText, Sparkles, Loader2, RefreshCw, ExternalLink, AlertTriangle, Languages, ListChecks, FileSearch, FlaskConical,
} from "lucide-react";

export interface CaseDoc {
  id: string;
  label: string;
  mimeType: string;
  aiDocType: string | null;
  aiSummary: string | null;
  aiTranslation: string | null;
  aiFlags: string | null;
  assessedAt: string | null;
}

// "Belirgin anormallik saptanmadı." gibi nötr metinleri bayrak saymaz → yalnız gerçek bulgular vurgulanır.
function isFlagged(flags: string | null): boolean {
  const f = (flags ?? "").trim().toLowerCase();
  return !!f && !f.startsWith("belirgin anormallik saptanmad") && f !== "belirtilmedi";
}

// Doktor kokpiti — triyajda yüklenen tıbbi belgelerin AI ön-değerlendirmesi.
// Tek tıkla her belgeyi değerlendirir: tür + Türkçe çeviri + klinik özet + anormal bulgu.
// Sonuç DB'ye kaydedilir; orijinal belge "Orijinali aç" ile görüntülenebilir.
export function DocumentAnalysis({ caseId, initial }: { caseId: string; initial: CaseDoc[] }) {
  const router = useRouter();
  const [docs, setDocs] = useState<CaseDoc[]>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [labNote, setLabNote] = useState("");

  const pending = docs.filter((d) => !d.assessedAt).length;
  const anyAssessed = docs.some((d) => d.assessedAt);

  async function analyze(redo: boolean) {
    setBusy(true); setErr(""); setLabNote("");
    try {
      const r = await fetch(`/api/cases/${caseId}/analyze-docs`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ redo }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Belgeler değerlendirilemedi.");
      if (Array.isArray(d.documents)) setDocs(d.documents);
      if (d.failed) setErr(`${d.failed} belge değerlendirilemedi (atlandı).`);
      if (d.addedLabs > 0) {
        setLabNote(`${d.addedLabs} laboratuvar değeri aşağıdaki “Laboratuvar Sonuçları” formuna öneri olarak eklendi.`);
        router.refresh(); // Case.labResults değişti → lab formu yeni satırları alsın
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Hata.");
    } finally { setBusy(false); }
  }

  return (
    <div className="rounded-3xl border border-teal-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-teal-700">
          <FileSearch size={15} /> Ön Değerlendirme · Belge Analizi (AI)
        </div>
        <span className="shrink-0 text-[11px] text-slate-400">{docs.length} belge</span>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-slate-500">
        Hastanın triyajda yüklediği tıbbi belgeleri (tahlil, görüntüleme raporu, epikriz) AI ile değerlendirir:
        türünü belirler, içeriğini Türkçeye çevirir, önemli ve anormal bulguları çıkarır. Belgede olmayan bulgu uydurulmaz.
      </p>

      <button
        onClick={() => analyze(anyAssessed && pending === 0)}
        disabled={busy}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-teal-300 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-100 disabled:opacity-50"
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : anyAssessed && pending === 0 ? <RefreshCw size={15} /> : <Sparkles size={15} />}
        {busy
          ? "Değerlendiriliyor…"
          : pending > 0
            ? `AI · ${pending} belgeyi değerlendir & çevir`
            : "AI · Yeniden değerlendir"}
      </button>
      {err && <div className="mt-1.5 text-[11px] text-red-600">{err}</div>}
      {labNote && (
        <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-teal-700">
          <FlaskConical size={12} className="mt-0.5 shrink-0" /> <span>{labNote}</span>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {docs.map((d) => (
          <div key={d.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <FileText size={15} className="shrink-0 text-teal-600" />
                <span className="truncate text-sm font-medium text-slate-700">{d.label}</span>
              </div>
              <a
                href={`/api/cases/${caseId}/documents/${d.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-teal-700"
              >
                Orijinali aç <ExternalLink size={12} />
              </a>
            </div>

            {d.assessedAt ? (
              <div className="mt-2.5 space-y-2.5">
                {d.aiDocType && (
                  <span className="inline-block rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-semibold text-teal-700">
                    {d.aiDocType}
                  </span>
                )}
                {isFlagged(d.aiFlags) && (
                  <div className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-[12px] text-amber-800 ring-1 ring-amber-200">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                    <span className="whitespace-pre-line">{d.aiFlags}</span>
                  </div>
                )}
                <Field icon={<ListChecks size={12} />} label="Klinik Özet" value={d.aiSummary} />
                <Field icon={<Languages size={12} />} label="Türkçe Çeviri" value={d.aiTranslation} />
              </div>
            ) : (
              <p className="mt-1.5 text-[12px] text-slate-400">Henüz değerlendirilmedi.</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 text-[11px] leading-relaxed text-slate-400">
        AI ön-değerlendirmesidir; kesin tanı değildir. DICOM görüntüleri ayrı görüntüleyicide incelenir.
      </div>
    </div>
  );
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {icon} {label}
      </div>
      <p className="mt-0.5 whitespace-pre-line text-sm leading-relaxed text-slate-700">{value}</p>
    </div>
  );
}
