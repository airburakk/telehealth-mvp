"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { JOURNEY_STAGES, JOURNEY_STATUS, type JourneyStage, type JourneyStatus } from "@/lib/journey";

const STATUS_OPTIONS: JourneyStatus[] = ["pending", "active", "done"];
// <input type="date"> (YYYY-MM-DD) ↔ ISO. Gün-ortası UTC → zaman dilimi kayması yok.
const toDateInput = (iso?: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");
const fromDateInput = (v: string) => (v ? new Date(v + "T12:00:00Z").toISOString() : null);

// Tek bir rezervasyonun lojistik aşamalarını düzenler → POST /api/bookings/[id]/journey.
export function LogisticsEditor({ bookingId, initialStages }: { bookingId: string; initialStages: JourneyStage[] }) {
  const router = useRouter();
  const [stages, setStages] = useState<JourneyStage[]>(initialStages);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(key: string, patch: Partial<JourneyStage>) {
    setStages((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/journey`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stages }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Kaydedilemedi.");
      }
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 space-y-2.5 border-t border-slate-100 pt-4">
      {stages.map((st) => {
        const meta = JOURNEY_STAGES.find((s) => s.key === st.key);
        return (
          <div key={st.key} className="grid grid-cols-1 gap-2 sm:grid-cols-[150px_120px_1fr] sm:items-center">
            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <span className={`h-2 w-2 shrink-0 rounded-full ${JOURNEY_STATUS[st.status].dot}`} />
              {meta?.label ?? st.key}
            </div>
            <select
              value={st.status}
              onChange={(e) => update(st.key, { status: e.target.value as JourneyStatus })}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              aria-label={`${meta?.label ?? st.key} durumu`}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o} value={o}>{JOURNEY_STATUS[o].label}</option>
              ))}
            </select>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1 text-xs text-slate-400">
                Plan
                <input
                  type="date"
                  value={toDateInput(st.plannedAt)}
                  onChange={(e) => update(st.key, { plannedAt: fromDateInput(e.target.value) })}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-700"
                />
              </label>
              <label className="flex items-center gap-1 text-xs text-slate-400">
                Tamam
                <input
                  type="date"
                  value={toDateInput(st.doneAt)}
                  onChange={(e) => update(st.key, { doneAt: fromDateInput(e.target.value) })}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-700"
                />
              </label>
              <input
                type="text"
                value={st.note ?? ""}
                onChange={(e) => update(st.key, { note: e.target.value })}
                placeholder="Lojistik not (uçuş, otel, transfer…)"
                maxLength={500}
                className="min-w-[160px] flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                aria-label={`${meta?.label ?? st.key} notu`}
              />
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#14C3D0] px-4 py-2 text-sm font-semibold text-[#101010] hover:bg-[#0EA5B2] disabled:opacity-60"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <Check size={15} /> : null}
          {saving ? "Kaydediliyor…" : saved ? "Kaydedildi" : "Kaydet"}
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}
