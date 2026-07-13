"use client";

// Doktor post-op takibini "tamamla" → klinik personel erişimi kapanır (E2EE Faz 2A). Geri-dönüşsüz (ileriye dönük):
// onaylandığında o vakanın klinik kayıtlarına personel erişimi kalkar, hasta-only'ye döner. İki adımlı onay.
// Panelde satır Link'i içinde durur → tıklamalar preventDefault+stopPropagation ile yutulur (navigasyon tetiklenmez).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, X } from "lucide-react";

export function CompleteRecoveryButton({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState(false);

  const stop = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); };

  async function complete(e: React.MouseEvent) {
    stop(e);
    setBusy(true);
    setErr(false);
    try {
      const r = await fetch(`/api/cases/${caseId}/recovery/complete`, { method: "POST" });
      if (r.ok) router.refresh();
      else setErr(true);
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  }

  if (!confirm) {
    return (
      <button
        onClick={(e) => { stop(e); setConfirm(true); }}
        className="shrink-0 rounded-lg border border-[var(--c-hairline)] px-2.5 py-1 text-xs font-medium text-[var(--c-ink-2)] transition hover:border-[var(--c-accent)] hover:text-[var(--c-accent-stronger)]"
        title="Post-op takibi tamamla — klinik erişim hastaya devredilir"
      >
        Takibi tamamla
      </button>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5" onClick={stop}>
      <span className="hidden text-[11px] text-[var(--c-ink-2)] sm:inline">Erişim hastaya devredilecek</span>
      <button
        onClick={complete}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-lg bg-[var(--c-accent)] px-2.5 py-1 text-xs font-semibold text-[var(--c-bg)] transition hover:bg-[var(--c-accent-strong)] disabled:opacity-50"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} {err ? "Tekrar dene" : "Onayla"}
      </button>
      <button onClick={(e) => { stop(e); setConfirm(false); }} className="rounded-lg border border-[var(--c-hairline)] px-2 py-1 text-xs text-[var(--c-ink-2)]" title="Vazgeç">
        <X size={13} />
      </button>
    </span>
  );
}
