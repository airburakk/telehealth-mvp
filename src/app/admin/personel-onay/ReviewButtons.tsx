"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, X } from "lucide-react";

// Personel-onay karar butonları (2026-08-12): Onayla tek tık; Reddet kısa gerekçe ister
// (gerekçe başvurana /kayit/durum'da gösterilir — kişisel veri yazılmaz).
export function ReviewButtons({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "reject">("idle");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState("");

  async function decide(action: "approve" | "reject") {
    setError("");
    setBusy(action);
    try {
      const res = await fetch(`/api/staff-applications/${applicationId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "İşlem tamamlanamadı.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "İşlem tamamlanamadı.");
      setBusy(null);
    }
  }

  return (
    <div className="w-full">
      {mode === "idle" ? (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setMode("reject")}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/20 disabled:opacity-60"
          >
            <X size={13} /> Reddet
          </button>
          <button
            type="button"
            onClick={() => decide("approve")}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--c-accent)] px-3 py-1.5 text-xs font-semibold text-[var(--c-bg)] transition hover:bg-[var(--c-accent-strong)] disabled:opacity-60"
          >
            {busy === "approve" ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Onayla
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Ret gerekçesi (başvurana gösterilir) — ör. TÜRSAB belge numarası doğrulanamadı"
            className="w-full rounded-lg border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3 py-2 text-xs text-[var(--c-ink)] outline-none placeholder:text-[var(--c-ink-3)] focus:border-[var(--c-accent)]"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => { setMode("idle"); setNote(""); setError(""); }}
              disabled={busy !== null}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--c-ink-2)] hover:text-[var(--c-ink)]"
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={() => decide("reject")}
              disabled={busy !== null || note.trim().length < 3}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/80 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-500 disabled:opacity-60"
            >
              {busy === "reject" ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />} Ret kararını gönder
            </button>
          </div>
        </div>
      )}
      {error && <div className="mt-2 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs text-red-300 ring-1 ring-red-400/25">{error}</div>}
    </div>
  );
}
