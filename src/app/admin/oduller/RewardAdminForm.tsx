"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Trash2, X } from "lucide-react";

// Ödül katalog formu + kalem listesi + talep kuyruğu (v6.88) — SurveyAdminForm deseni.
// Karar akışı: REQUESTED → Onayla/Reddet · APPROVED → Teslim edildi/Reddet (geçiş kuralları
// tek kaynak lib/rewards.ts canTransitionRedemption; API 409 döndürürse mesaj aynen gösterilir).

interface Item {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  pointsCost: number;
  active: boolean;
  redemptions: number;
}

interface QueueRow {
  id: string;
  status: string;
  pointsCost: number;
  note: string | null;
  adminNote: string | null;
  createdAt: string;
  itemTitle: string;
  itemKind: string;
  doctorLabel: string;
}

interface Props {
  kindLabel: Record<string, string>;
  statusLabel: Record<string, string>;
  items: Item[];
  queue: QueueRow[];
}

const inputCls =
  "w-full rounded-lg border border-[var(--c-hairline)] bg-[var(--c-surface-2)] px-3 py-1.5 text-sm text-[var(--c-ink)] placeholder:text-[var(--c-ink-3)]";
const labelCls = "text-[11px] font-semibold text-[var(--c-ink-2)]";

export function RewardAdmin(p: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowErr, setRowErr] = useState<string | null>(null);
  // Ret akışı: tek tık yerine not alanıyla iki adım (doktora gösterilecek gerekçe teşvik edilir).
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const [kind, setKind] = useState("KONGRE_TR");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pointsCost, setPointsCost] = useState("");

  async function createItem() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/rewards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind, title, description: description || null,
          pointsCost: parseInt(pointsCost, 10) || 0,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Kaydedilemedi.");
      setMsg("Kalem eklendi — katalogda AKTİF olarak yayında.");
      setTitle(""); setDescription(""); setPointsCost("");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  async function patchItem(id: string, data: { active?: boolean }) {
    setBusyId(id);
    setRowErr(null);
    try {
      const res = await fetch("/api/admin/rewards", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...data }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Değiştirilemedi.");
      router.refresh();
    } catch (e) {
      setRowErr(e instanceof Error ? e.message : "Değiştirilemedi.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeItem(id: string) {
    setBusyId(id);
    setRowErr(null);
    try {
      const res = await fetch(`/api/admin/rewards?id=${id}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Silinemedi.");
      router.refresh();
    } catch (e) {
      setRowErr(e instanceof Error ? e.message : "Silinemedi.");
    } finally {
      setBusyId(null);
    }
  }

  async function decide(redemptionId: string, status: string, adminNote?: string) {
    setBusyId(redemptionId);
    setRowErr(null);
    try {
      const res = await fetch("/api/admin/rewards/redemptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ redemptionId, status, adminNote: adminNote || null }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Karar kaydedilemedi.");
      setRejectId(null);
      setRejectNote("");
      router.refresh();
    } catch (e) {
      setRowErr(e instanceof Error ? e.message : "Karar kaydedilemedi.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-5">
      {/* ── Talep kuyruğu (en eski önce) ── */}
      <h2 className="text-sm font-semibold text-[var(--c-ink)]">Talep kuyruğu</h2>
      <ul className="mt-2 grid gap-2">
        {p.queue.length === 0 && (
          <li className="rounded-xl border border-dashed border-[var(--c-hairline)] px-4 py-5 text-center text-xs text-[var(--c-ink-3)]">
            Bekleyen talep yok.
          </li>
        )}
        {p.queue.map((r) => (
          <li key={r.id} className="rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                r.status === "REQUESTED" ? "bg-amber-500/15 text-amber-300" : "bg-sky-500/15 text-sky-300"
              }`}>
                {p.statusLabel[r.status] ?? r.status}
              </span>
              <span className="font-semibold text-[var(--c-ink)]">{r.itemTitle}</span>
              <span className="aura-mono text-[10px] text-[var(--c-ink-3)]">{p.kindLabel[r.itemKind] ?? r.itemKind}</span>
              <span className="aura-mono ml-auto text-[10px] tabular-nums text-[var(--c-ink-3)]">
                {r.pointsCost} puan · {r.createdAt}
              </span>
            </div>
            <p className="mt-1 text-xs text-[var(--c-ink-2)]">{r.doctorLabel}</p>
            {r.note && <p className="mt-0.5 text-[11px] text-[var(--c-ink-3)]">Hekim notu: {r.note}</p>}

            {rejectId === r.id ? (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <input
                  className={`${inputCls} max-w-xs`}
                  placeholder="Ret gerekçesi (hekime gösterilir)"
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => decide(r.id, "REJECTED", rejectNote)}
                  disabled={busyId === r.id}
                  className="rounded-full border border-red-400/40 px-2.5 py-1 text-[11px] text-red-300 hover:bg-red-500/10 disabled:opacity-60"
                >
                  Reddet (puan iade edilir)
                </button>
                <button
                  type="button"
                  onClick={() => { setRejectId(null); setRejectNote(""); }}
                  className="rounded-full border border-[var(--c-hairline)] px-2.5 py-1 text-[11px] text-[var(--c-ink-2)] hover:bg-[var(--c-surface-2)]"
                >
                  Vazgeç
                </button>
              </div>
            ) : (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {busyId === r.id && <Loader2 size={12} className="animate-spin text-[var(--c-ink-3)]" />}
                {r.status === "REQUESTED" && (
                  <button
                    type="button"
                    onClick={() => decide(r.id, "APPROVED")}
                    disabled={busyId === r.id}
                    className="rounded-full border border-sky-400/40 px-2.5 py-1 text-[11px] text-sky-300 hover:bg-sky-500/10"
                  >
                    Onayla
                  </button>
                )}
                {r.status === "APPROVED" && (
                  <button
                    type="button"
                    onClick={() => decide(r.id, "FULFILLED")}
                    disabled={busyId === r.id}
                    className="rounded-full border border-emerald-400/40 px-2.5 py-1 text-[11px] text-emerald-300 hover:bg-emerald-500/10"
                  >
                    Teslim edildi
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setRejectId(r.id)}
                  disabled={busyId === r.id}
                  className="rounded-full border border-[var(--c-hairline)] px-2.5 py-1 text-[11px] text-[var(--c-ink-2)] hover:bg-[var(--c-surface-2)]"
                >
                  Reddet…
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {rowErr && <p className="mt-3 text-[11px] text-red-300">{rowErr}</p>}

      {/* ── Katalog ── */}
      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--c-ink)]">Katalog kalemleri</h2>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--c-hairline)] px-3.5 py-2 text-xs font-semibold text-[var(--c-ink-2)] hover:bg-[var(--c-surface)]"
        >
          <Plus size={14} /> Yeni kalem
        </button>
      </div>

      {open && (
        <div className="mt-3 grid gap-3 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="rw-kind">Tür</label>
              <select id="rw-kind" className={inputCls} value={kind} onChange={(e) => setKind(e.target.value)}>
                {Object.entries(p.kindLabel).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="rw-cost">Puan bedeli</label>
              <input id="rw-cost" className={inputCls} value={pointsCost} inputMode="numeric"
                onChange={(e) => setPointsCost(e.target.value)} placeholder="500" />
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="rw-title">Başlık (hekim kartında görünür)</label>
            <input id="rw-title" className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn. TTB kredili yurt içi kongre katılım desteği" />
          </div>
          <div>
            <label className={labelCls} htmlFor="rw-desc">Açıklama (kapsam/sınırlar — opsiyonel)</label>
            <textarea id="rw-desc" rows={2} className={inputCls} value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Neyi kapsar (kayıt ücreti / ulaşım / konaklama), hangi koşullarda geçerli…" />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={createItem}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/90 px-3.5 py-1.5 text-xs font-semibold text-[#062a20] hover:bg-emerald-400 disabled:opacity-60"
            >
              {saving && <Loader2 size={12} className="animate-spin" />} Kalemi ekle
            </button>
            {msg && <span className="text-[11px] text-[var(--c-ink-2)]">{msg}</span>}
          </div>
        </div>
      )}

      <ul className="mt-4 grid gap-2.5">
        {p.items.length === 0 && (
          <li className="rounded-xl border border-dashed border-[var(--c-hairline)] px-4 py-6 text-center text-xs text-[var(--c-ink-3)]">
            Katalog boş — hekimler &quot;Ödül kataloğu yakında&quot; görür, puanlar birikmeye devam eder.
          </li>
        )}
        {p.items.map((it) => (
          <li key={it.id} className="rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                it.active ? "bg-emerald-500/15 text-emerald-300" : "bg-[var(--c-surface-2)] text-[var(--c-ink-3)]"
              }`}>
                {it.active ? "AKTİF" : "PASİF"}
              </span>
              <span className="aura-mono text-[10px] text-[var(--c-ink-3)]">{p.kindLabel[it.kind] ?? it.kind}</span>
              <span className="aura-mono ml-auto text-[10px] tabular-nums text-[var(--c-ink-3)]">
                {it.pointsCost} puan · {it.redemptions} talep
              </span>
            </div>
            <p className="mt-1 text-sm font-semibold text-[var(--c-ink)]">{it.title}</p>
            {it.description && <p className="text-[11px] text-[var(--c-ink-2)]">{it.description}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {busyId === it.id && <Loader2 size={12} className="animate-spin text-[var(--c-ink-3)]" />}
              <button
                type="button"
                onClick={() => patchItem(it.id, { active: !it.active })}
                disabled={busyId === it.id}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] ${
                  it.active
                    ? "border-amber-400/40 text-amber-300 hover:bg-amber-500/10"
                    : "border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/10"
                }`}
              >
                {it.active ? <><X size={11} /> Pasife al</> : <><Check size={11} /> Yayına al</>}
              </button>
              {it.redemptions === 0 && (
                <button
                  type="button"
                  onClick={() => removeItem(it.id)}
                  disabled={busyId === it.id}
                  className="inline-flex items-center gap-1 rounded-full border border-red-400/30 px-2.5 py-1 text-[11px] text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 size={11} /> Sil
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
