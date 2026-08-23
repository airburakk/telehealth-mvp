"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2, Star } from "lucide-react";

// v6.52: alarm ayarları TEK filtre penceresine taşınmıştı; v6.142'de o pencere de (DoctoriumFilters)
// silindi — tümü artık /doktor/doctorium/tercihler'de. Burada yalnız kongre kartındaki takip
// düğmesi kaldı.

// Aynı takip durumunun İKİ görünümü (kart köşesindeki küçük "chip" + detay sayfasının Eylemler
// satırındaki "action" düğmesi, v6.143): ikisi de CongressFollow'u aç/kapar — kopya state YOK,
// AURA'nın kendi takvimi (/doktor/doctorium/takvim) zaten takipten TÜRETİLİYOR (lib/calendar.ts).
// Ayrı bir .ics indirmesi bu yüzden gereksizdi (kullanıcı bildirimi 2026-08-23): iki farklı "takvime
// ekle" deneyimi (dosya indir vs uygulama-içi takip) kafa karıştırıyordu.
// 🪤 Aynı sayfada iki örnek varsa (header chip + action) `key={String(following)}` ŞART: ikisi de
// kendi `useState(following)`'ini yalnız MOUNT'ta okur; router.refresh() sonrası yeni `following`
// prop'u gelir ama state kendiliğinden yenilenmez — tıklanmayan örnek eski durumda takılı kalır.
// key değişince React'i remount'a zorlamak state'i taze prop'tan yeniden başlatır.
export function FollowButton({
  congressId, following, variant = "chip",
}: { congressId: string; following: boolean; variant?: "chip" | "action" }) {
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

  if (variant === "action") {
    return (
      <button type="button" onClick={toggle} disabled={busy} aria-pressed={on}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition ${
          on ? "border-amber-400/40 bg-amber-500/15 text-amber-300" : "border-[var(--c-hairline)] text-[var(--c-ink-2)] hover:bg-[var(--c-surface-2)]"
        }`}>
        {busy ? <Loader2 size={13} className="animate-spin" /> : <CalendarClock size={13} />}
        {on ? "Takvimde" : "Takvime ekle"}
      </button>
    );
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
