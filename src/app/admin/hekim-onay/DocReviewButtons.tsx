"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2 } from "lucide-react";

// Belge inceleme kararı (Faz 2): Uygun (ACCEPTED) / Yetersiz (REJECTED + zorunlu gerekçe).
// Yetersiz kararı doktora gerekçeli bildirim düşürür; aktivasyona dokunmaz (tasarım kararı).
export function DocReviewButtons({ doctorId, docId, status }: { doctorId: string; docId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false); // Yetersiz seçildi → gerekçe kutusu açık
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  async function send(decision: "ACCEPTED" | "REJECTED") {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch(`/api/admin/doctors/${doctorId}/documents/${docId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: decision, note: decision === "REJECTED" ? note : undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Karar kaydedilemedi.");
      setAsking(false);
      setNote("");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Hata oluştu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <span className="inline-flex items-center gap-1.5">
        {status !== "ACCEPTED" && (
          <button
            onClick={() => send("ACCEPTED")}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-400/25 hover:bg-emerald-500/20 disabled:opacity-60"
          >
            {busy && !asking ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Uygun
          </button>
        )}
        {status !== "REJECTED" && (
          <button
            onClick={() => setAsking((v) => !v)}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-1 text-[11px] font-semibold text-red-300 ring-1 ring-red-400/25 hover:bg-red-500/20 disabled:opacity-60"
          >
            <X size={11} /> Yetersiz
          </button>
        )}
      </span>
      {asking && (
        <span className="flex items-center gap-1.5">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="Gerekçe (doktora bildirimle gider)"
            className="w-56 rounded-md border border-[var(--c-hairline)] bg-[var(--c-surface)] px-2 py-1 text-xs text-[var(--c-ink)] placeholder:text-[var(--c-ink-3)]"
          />
          <button
            onClick={() => send("REJECTED")}
            disabled={busy || !note.trim()}
            className="rounded-md bg-red-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? <Loader2 size={11} className="animate-spin" /> : "Gönder"}
          </button>
        </span>
      )}
      {err && <span className="text-[11px] text-red-300">{err}</span>}
    </span>
  );
}
