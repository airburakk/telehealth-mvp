"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";

// "Yuvayı aç" — yuva satırı yalnız bu düğmeyle oluşur (sayfa GET'te yazmaz). Başarıda ayrıntı sayfasına gider.
export function OpenSlotButton({ seriesKey, slotDay }: { seriesKey: string; slotDay: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function open() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/icerik-takvimi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open", seriesKey, slotDay }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Yuva açılamadı.");
      router.push(`/admin/icerik-takvimi/${data.item.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yuva açılamadı.");
      setBusy(false);
    }
  }

  return (
    <div className="shrink-0 text-right">
      <button
        type="button"
        onClick={open}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--c-hairline)] px-3 py-1.5 text-xs font-semibold text-[var(--c-ink-2)] transition hover:border-[var(--c-accent)] hover:text-[var(--c-accent)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Yuvayı aç
      </button>
      {error && <div className="mt-1 text-xs text-[var(--c-danger)]">{error}</div>}
    </div>
  );
}
