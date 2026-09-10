"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";

// KVKK başvurusu yanıtlama (2026-09-09) — admin/personel-onay ReviewButtons.tsx fetch+state deseni,
// sadeleştirilmiş (onay/red ayrımı yok — KVKK başvurusu zaten tek bir yanıt/açıklama ister).
export function KvkkDecisionForm({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [decision, setDecision] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/kvkk-basvurulari/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "İşlem tamamlanamadı.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "İşlem tamamlanamadı.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <textarea
        value={decision}
        onChange={(e) => setDecision(e.target.value)}
        disabled={busy}
        rows={2}
        placeholder="Yanıt (başvurana gösterilir)"
        className="w-full rounded-lg border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3 py-2 text-xs text-[var(--c-ink)] outline-none placeholder:text-[var(--c-ink-3)] focus:border-[var(--c-accent)]"
      />
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy || decision.trim().length < 3}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--c-accent)] px-3 py-1.5 text-xs font-semibold text-[var(--c-bg)] transition hover:bg-[var(--c-accent-strong)] disabled:opacity-60"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Yanıtla
        </button>
      </div>
      {error && <div className="mt-2 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs text-red-300 ring-1 ring-red-400/25">{error}</div>}
    </div>
  );
}
