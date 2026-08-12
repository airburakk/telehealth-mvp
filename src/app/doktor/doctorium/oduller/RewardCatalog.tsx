"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Globe2, Loader2, MapPin, X } from "lucide-react";

// Ödül kataloğu + taleplerim (v6.88) — SurveyCard/SponsorForm client deseni.
// Talep: POST /api/rewards/redeem (puan talep ANINDA rezerve düşer; onay/ifa admin'de).
// İptal: PATCH — yalnız kendi REQUESTED talebi; puan iade satırıyla döner.

interface Item {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  pointsCost: number;
}

interface Redemption {
  id: string;
  status: string;
  pointsCost: number;
  note: string | null;
  adminNote: string | null;
  createdAt: string;
  itemTitle: string;
  itemKind: string;
}

interface Props {
  balance: number;
  kindLabel: Record<string, string>;
  statusLabel: Record<string, string>;
  items: Item[];
  redemptions: Redemption[];
}

const KIND_ICON: Record<string, typeof MapPin> = {
  KONGRE_TR: MapPin,
  KONGRE_INTL: Globe2,
  KITAP: BookOpen,
};

const STATUS_TONE: Record<string, string> = {
  REQUESTED: "bg-amber-500/15 text-amber-300",
  APPROVED: "bg-sky-500/15 text-sky-300",
  FULFILLED: "bg-emerald-500/15 text-emerald-300",
  REJECTED: "bg-red-500/15 text-red-300",
  CANCELLED: "bg-[var(--c-surface-2)] text-[var(--c-ink-3)]",
};

export function RewardCatalog(p: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Talep öncesi tek-adım onay: yanlış tıklamada puan düşmesin (geri dönüşü iptalle mümkün ama
  // gereksiz talep admin kuyruğunu kirletir). Seçilen kalem id'si tutulur, ikinci tık gönderir.
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function redeem(itemId: string) {
    setBusyId(itemId);
    setErr(null);
    try {
      const res = await fetch("/api/rewards/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Talep oluşturulamadı.");
      setConfirmId(null);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Talep oluşturulamadı.");
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(redemptionId: string) {
    setBusyId(redemptionId);
    setErr(null);
    try {
      const res = await fetch("/api/rewards/redeem", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ redemptionId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "İptal edilemedi.");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "İptal edilemedi.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h2 className="mt-8 text-sm font-semibold text-[var(--c-ink)]">Ödül kataloğu</h2>
      {p.items.length === 0 ? (
        <p className="mt-2 rounded-xl border border-dashed border-[var(--c-hairline)] px-4 py-6 text-center text-xs text-[var(--c-ink-3)]">
          Ödül kataloğu yakında — puanlarınız birikmeye devam eder, katalog açıldığında burada
          kullanabilirsiniz.
        </p>
      ) : (
        <ul className="mt-2 grid gap-2.5 sm:grid-cols-2">
          {p.items.map((it) => {
            const Icon = KIND_ICON[it.kind] ?? MapPin;
            const affordable = p.balance >= it.pointsCost;
            const confirming = confirmId === it.id;
            return (
              <li key={it.id} className="flex flex-col rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <Icon size={15} className="shrink-0 text-emerald-300" />
                  <span className="aura-mono text-[10px] font-semibold text-[var(--c-ink-3)]">
                    {p.kindLabel[it.kind] ?? it.kind}
                  </span>
                  <span className="aura-mono ml-auto shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-emerald-300">
                    {it.pointsCost} puan
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-semibold leading-snug text-[var(--c-ink)]">{it.title}</p>
                {it.description && <p className="mt-1 text-xs leading-relaxed text-[var(--c-ink-2)]">{it.description}</p>}
                <div className="mt-auto pt-2.5">
                  {confirming ? (
                    <span className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => redeem(it.id)}
                        disabled={busyId === it.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/90 px-3 py-1.5 text-xs font-semibold text-[#062a20] hover:bg-emerald-400 disabled:opacity-60"
                      >
                        {busyId === it.id && <Loader2 size={12} className="animate-spin" />}
                        {it.pointsCost} puanla talebi onayla
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="rounded-lg border border-[var(--c-hairline)] px-2.5 py-1.5 text-xs text-[var(--c-ink-2)] hover:bg-[var(--c-surface-2)]"
                      >
                        Vazgeç
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmId(it.id)}
                      disabled={!affordable}
                      title={affordable ? undefined : "Puanınız henüz yeterli değil"}
                      className="rounded-lg border border-emerald-400/40 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:border-[var(--c-hairline)] disabled:text-[var(--c-ink-3)]"
                    >
                      Talep et
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {err && <p className="mt-3 text-[11px] text-red-300">{err}</p>}

      {p.redemptions.length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-semibold text-[var(--c-ink)]">Taleplerim</h2>
          <ul className="mt-2 grid gap-2">
            {p.redemptions.map((r) => (
              <li key={r.id} className="rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3.5 py-2.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_TONE[r.status] ?? STATUS_TONE.CANCELLED}`}>
                    {p.statusLabel[r.status] ?? r.status}
                  </span>
                  <span className="font-semibold text-[var(--c-ink)]">{r.itemTitle}</span>
                  <span className="aura-mono ml-auto text-[10px] tabular-nums text-[var(--c-ink-3)]">
                    −{r.pointsCost} puan · {r.createdAt}
                  </span>
                </div>
                {r.adminNote && (
                  <p className="mt-1 text-[11px] text-[var(--c-ink-2)]">Yönetim notu: {r.adminNote}</p>
                )}
                {r.status === "REQUESTED" && (
                  <button
                    type="button"
                    onClick={() => cancel(r.id)}
                    disabled={busyId === r.id}
                    className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-[var(--c-hairline)] px-2.5 py-1 text-[11px] text-[var(--c-ink-2)] hover:bg-[var(--c-surface-2)] disabled:opacity-60"
                  >
                    {busyId === r.id ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
                    İptal et (puan iade edilir)
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
