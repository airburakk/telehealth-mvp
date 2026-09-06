"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, Loader2 } from "lucide-react";

/** Kariyer EDU "Takip et" (E2): takip → son başvuru Takvim'de + 7/3/1 gün kala bildirim ve e-posta. İyimser değil: yanıt bekler, sonra refresh. */
export default function EduFollowButton({ opportunityId, following }: { opportunityId: string; following: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function toggle() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/doctor/edu-follow", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ opportunityId, follow: !following }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "İşlem yapılamadı.");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "İşlem yapılamadı.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button" onClick={toggle} disabled={busy} aria-pressed={following}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] font-semibold transition-colors disabled:opacity-60 ${following
          ? "border-[var(--c-accent)]/50 bg-[var(--c-accent)]/12 text-[var(--c-accent)] hover:bg-[var(--c-accent)]/20"
          : "border-[var(--c-hairline)] bg-[var(--c-surface)] text-[var(--c-ink-2)] hover:border-[var(--c-accent)]/50 hover:text-[var(--c-accent)]"}`}
        title={following ? "Takibi bırak — hatırlatma ve takvim kaydı kalkar" : "Takip et — son başvuru Takvim'e düşer, 7/3/1 gün kala hatırlatılır"}
      >
        {busy ? <Loader2 size={13} className="animate-spin" aria-hidden /> : following ? <Bell size={13} aria-hidden /> : <BellOff size={13} aria-hidden />}
        {following ? "Takip ediliyor" : "Takip et"}
      </button>
      {err && <span className="text-[11px] text-[var(--c-danger,#f87171)]">{err}</span>}
    </span>
  );
}
