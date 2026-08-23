"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Star } from "lucide-react";

// v6.52: alarm ayarları TEK filtre penceresine taşınmıştı; v6.142'de o pencere de (DoctoriumFilters)
// silindi — tümü artık /doktor/doctorium/tercihler'de. Burada yalnız kongre kartındaki takip
// düğmesi kaldı.

// Tek kongre için takip aç/kapat düğmesi.
export function FollowButton({ congressId, following }: { congressId: string; following: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(following);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const next = !on;
    try {
      const res = await fetch("/api/doctor/congress-follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ congressId, follow: next }),
      });
      if (!res.ok) throw new Error();
      setOn(next);
      router.refresh();
    } catch {
      /* durum değişmedi — düğme eski hâlinde kalır */
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={toggle} disabled={busy} aria-pressed={on}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
        on ? "border-amber-400/40 bg-amber-500/15 text-amber-300" : "border-[var(--c-hairline)] text-[var(--c-ink-2)] hover:bg-[var(--c-surface-2)]"
      }`}>
      {busy ? <Loader2 size={12} className="animate-spin" /> : <Star size={12} className={on ? "fill-amber-300" : ""} />}
      {on ? "Takipte" : "Takip et"}
    </button>
  );
}
