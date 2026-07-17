"use client";

import { useState } from "react";
import Link from "next/link";
import { REQUEST_TYPES } from "@/lib/ethics";
import { Scale, Upload, Loader2, Send, CheckCircle2, ArrowRight } from "lucide-react";

export function ComplaintForm({ caseId }: { caseId: string }) {
  const [subject, setSubject] = useState("");
  const [requestType, setRequestType] = useState("REFUND");
  const [description, setDescription] = useState("");
  const [evidence, setEvidence] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit() {
    setError("");
    if (subject.trim().length < 3 || description.trim().length < 10) {
      setError("Lütfen konu ve açıklamayı doldurun.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/complaint`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, requestType, description, evidence }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Hata");
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Başvuru gönderilemedi.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-3xl border border-emerald-400/25 bg-emerald-500/10 p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-300" />
          <div>
            <h2 className="font-bold text-emerald-200">Başvurunuz Etik Kurul&apos;a iletildi</h2>
            <p className="mt-1 text-sm text-emerald-200/90">
              Sağlık hukuku ve tıp uzmanlarından oluşan bağımsız kurul, kimliğiniz gizlenerek (anonim) başvurunuzu
              değerlendirecek. Ödemeniz karar verilene dek Escrow&apos;da güvence altındadır (escrow simülasyonu —
              MVP&apos;de gerçek para transferi yapılmaz).
            </p>
            <Link href="/etik-kurul" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-300 hover:underline">
              Kurul panelinde gör (demo) <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <Scale size={18} className="text-[var(--c-ink)]" />
        <h2 className="aura-display text-lg font-medium tracking-tight text-[var(--c-ink)]">Etik Kurul Başvurusu</h2>
      </div>
      <p className="mt-1 text-sm text-[var(--c-ink-2)]">Memnuniyetsizlik veya şikayetinizi bağımsız kurula iletin.</p>

      <div className="mt-5 space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--c-ink)]">Konu</span>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Örn. Operasyon sonrası komplikasyon" className="w-full rounded-lg border border-[var(--c-hairline)] px-3 py-2 text-sm outline-none focus:border-[var(--c-accent)]" />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--c-ink)]">Talep türü</span>
          <select value={requestType} onChange={(e) => setRequestType(e.target.value)} className="w-full rounded-lg border border-[var(--c-hairline)] px-3 py-2 text-sm outline-none focus:border-[var(--c-accent)]">
            {Object.entries(REQUEST_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--c-ink)]">Açıklama</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Yaşadığınız durumu ayrıntılı anlatın…" className="w-full resize-none rounded-lg border border-[var(--c-hairline)] p-2.5 text-sm outline-none focus:border-[var(--c-accent)]" />
        </label>

        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[var(--c-hairline)] bg-[var(--c-surface)] px-3 py-2.5 text-sm text-[var(--c-ink-2)] hover:border-teal-400">
          <Upload size={16} className="text-[var(--c-ink-3)]" />
          {evidence || "Kanıt ekle (foto/belge/video — opsiyonel)"}
          <input type="file" className="hidden" onChange={(e) => setEvidence(e.target.files?.[0]?.name ?? "")} />
        </label>

        {error && <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-400/25">{error}</div>}

        <button onClick={submit} disabled={submitting} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--c-accent)] px-4 py-3 text-sm font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)] disabled:opacity-60">
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Kurula gönder
        </button>
      </div>
    </div>
  );
}
