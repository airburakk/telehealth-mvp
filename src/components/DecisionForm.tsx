"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { VERDICTS, ACTIONS, BOARD } from "@/lib/ethics";
import { formatUSD } from "@/lib/pricing";
import { Gavel, Loader2, PenLine } from "lucide-react";

export function DecisionForm({ complaintId, bookingTotal }: { complaintId: string; bookingTotal: number | null }) {
  const router = useRouter();
  const [verdict, setVerdict] = useState("FAVOR");
  const [action, setAction] = useState(bookingTotal ? "REFUND_FULL" : "ACCREDITATION_WARN");
  const [refundAmount, setRefundAmount] = useState(bookingTotal ? Math.round(bookingTotal / 2) : 0);
  const [rationale, setRationale] = useState("");
  const [decidedBy, setDecidedBy] = useState(BOARD[0].name);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      await fetch(`/api/complaints/${complaintId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verdict, action, refundAmount, rationale, decidedBy }),
      });
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <Gavel size={18} className="text-[var(--c-ink)]" />
        <h2 className="font-bold text-[var(--c-ink)]">Kurul Kararı</h2>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <span className="mb-1.5 block text-sm font-medium text-[var(--c-ink)]">Karar</span>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(VERDICTS).map(([k, v]) => (
              <button key={k} onClick={() => setVerdict(k)} className={`rounded-lg border px-2 py-2 text-sm font-medium transition ${verdict === k ? "border-[var(--c-accent)] bg-[var(--c-accent)] text-[var(--c-bg)]" : "border-[var(--c-hairline)] text-[var(--c-ink-2)] hover:border-[var(--c-hairline)]"}`}>
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--c-ink)]">Yaptırım</span>
          <select value={action} onChange={(e) => setAction(e.target.value)} className="w-full rounded-lg border border-[var(--c-hairline)] px-3 py-2 text-sm outline-none focus:border-[var(--c-accent)]">
            {Object.entries(ACTIONS).map(([k, v]) => <option key={k} value={k} disabled={(k === "REFUND_FULL" || k === "REFUND_PARTIAL") && !bookingTotal}>{v}</option>)}
          </select>
        </label>

        {action === "REFUND_PARTIAL" && bookingTotal && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--c-ink)]">İade tutarı (max {formatUSD(bookingTotal)})</span>
            <input type="number" value={refundAmount} min={0} max={bookingTotal} onChange={(e) => setRefundAmount(Number(e.target.value))} className="w-full rounded-lg border border-[var(--c-hairline)] px-3 py-2 text-sm outline-none focus:border-[var(--c-accent)]" />
          </label>
        )}

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--c-ink)]">Gerekçe</span>
          <textarea value={rationale} onChange={(e) => setRationale(e.target.value)} rows={3} placeholder="Kurul kararının gerekçesi…" className="w-full resize-none rounded-lg border border-[var(--c-hairline)] p-2.5 text-sm outline-none focus:border-[var(--c-accent)]" />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[var(--c-ink)]">İmzalayan kurul üyesi</span>
          <select value={decidedBy} onChange={(e) => setDecidedBy(e.target.value)} className="w-full rounded-lg border border-[var(--c-hairline)] px-3 py-2 text-sm outline-none focus:border-[var(--c-accent)]">
            {BOARD.map((m) => <option key={m.name} value={m.name}>{m.name} · {m.role}</option>)}
          </select>
        </label>

        <button onClick={submit} disabled={submitting} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--c-accent)] px-4 py-3 text-sm font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)] disabled:opacity-60">
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <PenLine size={16} />} Kararı dijital imzayla onayla
        </button>
      </div>
    </div>
  );
}
