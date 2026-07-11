"use client";

import { useState } from "react";
import { TranslateButton } from "@/components/TranslateButton";
import {
  FileText, Sparkles, Loader2, Copy, Check, RefreshCw, ShieldCheck,
  Stethoscope, ClipboardList, Syringe, HeartPulse, Pill, ListChecks,
} from "lucide-react";

export interface Structured {
  tani: string;
  anamnez: string;
  tedaviSureci: string;
  klinikSeyir: string;
  cikisIlaclari: string;
  oneriler: string;
}

const SECTIONS: { key: keyof Structured; label: string; icon: React.ReactNode }[] = [
  { key: "tani", label: "Tanı", icon: <Stethoscope size={14} /> },
  { key: "anamnez", label: "Öykü ve Başvuru", icon: <ClipboardList size={14} /> },
  { key: "tedaviSureci", label: "Uygulanan Tedavi ve İşlemler", icon: <Syringe size={14} /> },
  { key: "klinikSeyir", label: "Klinik Seyir ve İyileşme", icon: <HeartPulse size={14} /> },
  { key: "cikisIlaclari", label: "Çıkış İlaçları", icon: <Pill size={14} /> },
  { key: "oneriler", label: "Öneriler ve Kontrol Planı", icon: <ListChecks size={14} /> },
];

function formatSavedAt(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(new Date(iso));
}

// Doktor kokpiti — AI epikriz / taburcu raporu paneli.
// Hastanın tüm yolculuğunu (triyaj + SOAP + paket + post-op) tek tıkla epikrize sentezler;
// kaydedilir ve Güvenli Sağlık Paylaşımı'nda "Epikriz" kapsamında hastanın yurt dışı doktoruna iletilir.
export function DischargeReport({
  caseId, initialReport, initialStructured, initialSavedAt,
}: {
  caseId: string;
  initialReport: string | null;
  initialStructured: Structured | null;
  initialSavedAt: string | null;
}) {
  const [report, setReport] = useState(initialReport);
  const [structured, setStructured] = useState<Structured | null>(initialStructured);
  const [savedAt, setSavedAt] = useState(initialSavedAt);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  const has = !!report && !!structured;

  async function generate() {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/ai/discharge", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Epikriz oluşturulamadı.");
      setReport(d.report); setStructured(d.structured); setSavedAt(d.savedAt);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Hata.");
    } finally { setBusy(false); }
  }

  async function copy() {
    if (!report) return;
    try { await navigator.clipboard.writeText(report); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  }

  return (
    <div className="rounded-3xl border border-violet-400/25 bg-[#161719] p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-300">
          <FileText size={15} /> AI Epikriz / Taburcu Raporu
        </div>
        {has && savedAt && (
          <span className="shrink-0 text-[11px] text-white/40">oluşturuldu: {formatSavedAt(savedAt)}</span>
        )}
      </div>

      {!has && (
        <p className="mt-2 text-sm leading-relaxed text-white/50">
          Hastanın tüm yolculuğunu (triyaj, görüşme/SOAP notu, tedavi paketi ve post-op takip) tek tıkla
          profesyonel bir epikrize sentezler. Veride olmayan bulgu uydurulmaz.
        </p>
      )}

      <button
        onClick={generate}
        disabled={busy}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-sm font-semibold text-violet-300 hover:bg-violet-500/15 disabled:opacity-50"
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : has ? <RefreshCw size={15} /> : <Sparkles size={15} />}
        {busy ? "Sentezleniyor…" : has ? "Yeniden oluştur" : "AI · Epikriz Oluştur"}
      </button>
      {err && <div className="mt-1.5 text-[11px] text-red-300">{err}</div>}

      {has && structured && (
        <>
          <div className="mt-4 space-y-3">
            {SECTIONS.map((s) => (
              <div key={s.key} className="rounded-2xl border border-white/10 bg-[#1E1F22]/60 p-3.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/50">
                  {s.icon} {s.label}
                </div>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-white/75">{structured[s.key]}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
            <button
              onClick={copy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#161719] px-2.5 py-1.5 text-[12px] font-medium text-white/65 hover:bg-[#1E1F22]"
            >
              {copied ? <Check size={13} className="text-emerald-300" /> : <Copy size={13} />} {copied ? "Kopyalandı" : "Raporu kopyala"}
            </button>
            {report && <TranslateButton text={report} defaultTarget="İngilizce" compact />}
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-lg bg-violet-500/10 p-2.5 text-[11px] leading-relaxed text-violet-300 ring-1 ring-violet-400/20">
            <ShieldCheck size={14} className="mt-0.5 shrink-0" />
            <span>Bu rapor kaydedildi ve Güvenli Sağlık Paylaşımı&apos;nda <strong>&quot;Epikriz / Özet Rapor&quot;</strong> kapsamında hastanın yurt dışı doktoruna iletilir.</span>
          </div>
        </>
      )}
    </div>
  );
}
