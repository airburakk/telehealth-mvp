"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, BellOff, ChevronDown, Loader2, Star } from "lucide-react";

const OPTIONS = [
  { days: 1, label: "1 gün önce" },
  { days: 3, label: "3 gün önce" },
  { days: 7, label: "1 hafta önce" },
  { days: 14, label: "2 hafta önce" },
  { days: 30, label: "1 ay önce" },
];

// Kongre alarm ayarları (v6.49) — İKİ ayrı eşik: kongre başlangıcı ve son tarihler
// (bildiri teslim / erken kayıt). Hatırlatma günlük bakım cron'unda gönderilir.
export function CongressAlertSettings({ startDays, deadlineDays }: { startDays: number | null; deadlineDays: number | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState<number | null>(startDays);
  const [deadline, setDeadline] = useState<number | null>(deadlineDays);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const anyOn = start != null || deadline != null;

  async function save(next: { alertDays: number | null; deadlineAlertDays: number | null }) {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/doctor/congress-follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error();
      setMsg("Kaydedildi");
      router.refresh();
    } catch {
      setMsg("Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  function pick(kind: "start" | "deadline", days: number | null) {
    const next = kind === "start"
      ? { alertDays: days, deadlineAlertDays: deadline }
      : { alertDays: start, deadlineAlertDays: days };
    if (kind === "start") setStart(days);
    else setDeadline(days);
    void save(next);
  }

  const row = (kind: "start" | "deadline", current: number | null, title: string, hint: string) => (
    <div>
      <div className="flex items-baseline gap-2">
        <h3 className="text-xs font-semibold text-[var(--c-ink)]">{title}</h3>
        <span className="text-[10px] text-[var(--c-ink-3)]">{hint}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <button type="button" onClick={() => pick(kind, null)} aria-pressed={current == null}
          className={`rounded-full border px-2.5 py-1 text-[11px] ${current == null ? "border-[var(--c-hairline)] bg-[var(--c-surface-2)] text-[var(--c-ink-2)]" : "border-[var(--c-hairline)] text-[var(--c-ink-3)] hover:bg-[var(--c-surface-2)]"}`}>
          Kapalı
        </button>
        {OPTIONS.map((o) => (
          <button key={o.days} type="button" onClick={() => pick(kind, o.days)} aria-pressed={current === o.days}
            className={`rounded-full border px-2.5 py-1 text-[11px] ${current === o.days ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-300" : "border-[var(--c-hairline)] text-[var(--c-ink-2)] hover:bg-[var(--c-surface-2)]"}`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="mt-4">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--c-hairline)] px-3 py-1.5 text-xs font-semibold text-[var(--c-ink-2)] hover:bg-[var(--c-surface)]">
        {anyOn ? <BellRing size={13} className="text-emerald-300" /> : <BellOff size={13} />}
        Alarm ayarları
        <span className="aura-mono text-[10px] text-[var(--c-ink-3)]">
          {anyOn ? [start && `başlangıç ${start}g`, deadline && `son tarih ${deadline}g`].filter(Boolean).join(" · ") : "kapalı"}
        </span>
        <ChevronDown size={13} className={open ? "rotate-180 transition" : "transition"} />
      </button>

      {open && (
        <div className="mt-2 grid gap-4 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] p-4">
          {row("start", start, "Kongre başlangıcı", "takip ettiğiniz kongreler için")}
          {row("deadline", deadline, "Bildiri / erken kayıt son tarihi", "hangisi önce geliyorsa")}
          <p className="flex items-center gap-2 border-t border-[var(--c-hairline)] pt-3 text-[11px] text-[var(--c-ink-3)]">
            {saving && <Loader2 size={12} className="animate-spin" />}
            {msg ?? "Alarmlar yalnız ⭐ ile takip ettiğiniz kongreler için gönderilir."}
          </p>
        </div>
      )}
    </div>
  );
}

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
