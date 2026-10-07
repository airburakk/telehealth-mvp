"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, Loader2 } from "lucide-react";

/** EDU follow controls reminder eligibility; approved deadline dates remain in
 * the student calendar independently. Waits for acknowledgement, then refreshes. */
export default function EduFollowButton({ opportunityId, following }: { opportunityId: string; following: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pending = useRef(false);
  async function toggle() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true); setErr(null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch("/api/doctor/edu-follow", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ opportunityId, follow: !following }), signal: controller.signal });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "İşlem yapılamadı.");
      router.refresh();
    } catch (e) {
      setErr(controller.signal.aborted ? "Takip sonucu doğrulanamadı. Sayfayı yenileyin veya yeniden deneyin." : e instanceof Error ? e.message : "İşlem yapılamadı.");
    } finally {
      clearTimeout(timer);
      pending.current = false;
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
        title={following ? "Takibi bırak: yeni hatırlatmalar kapanır; son başvuru tarihi takvimde kalır." : "Hatırlatmalar için takip et: son başvuru tarihi zaten takvimde görünür; günlük kontrol 7/3/1 gün eşiklerini kullanır."}
      >
        {busy ? <Loader2 size={13} className="animate-spin" aria-hidden /> : following ? <Bell size={13} aria-hidden /> : <BellOff size={13} aria-hidden />}
        {following ? "Takip ediliyor" : "Takip et"}
      </button>
      {err && <span role="alert" className="text-[11px] text-[var(--c-danger,#f87171)]">{err}</span>}
    </span>
  );
}
