"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";

// Sponsorlu kampanya admin formu + listesi (v6.68 Faz 1) — CongressForm deseni.
// Kategori/branş seçenekleri ve etiketler PROPS ile gelir (lib/sponsor.ts db import'lu server
// modülü — client'a import edilmez). Durum akışı: DRAFT → ACTIVE ↔ PAUSED → ENDED; içerik
// düzeltmesi = ENDED + yeni kampanya (yayınlanmış kreatif sessizce değişmez, sayaç bütünlüğü).

interface Row {
  id: string;
  sponsor: string;
  category: string;
  title: string;
  status: string;
  impressions: number;
  clicks: number;
  startsAt: string;
  endsAt: string;
  targeted: boolean;
}

interface Props {
  branchOptions: { slug: string; label: string }[];
  categoryLabel: Record<string, string>;
  rows: Row[];
}

const inputCls =
  "w-full rounded-lg border border-[var(--c-hairline)] bg-[var(--c-surface-2)] px-3 py-1.5 text-sm text-[var(--c-ink)] placeholder:text-[var(--c-ink-3)]";
const labelCls = "text-[11px] font-semibold text-[var(--c-ink-2)]";

export function SponsorAdmin(p: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [sponsor, setSponsor] = useState("");
  const [category, setCategory] = useState(Object.keys(p.categoryLabel)[0] ?? "DIGER");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [branches, setBranches] = useState<Set<string>>(new Set());
  const [cities, setCities] = useState("");

  async function create() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/sponsor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sponsor, category, title, body,
          linkUrl: linkUrl || null,
          linkLabel: linkLabel || null,
          startsAt, endsAt,
          targetBranches: [...branches],
          targetCities: cities.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Kaydedilemedi.");
      setMsg("Taslak oluşturuldu — listeden AKTİF edin.");
      setSponsor(""); setTitle(""); setBody(""); setLinkUrl(""); setLinkLabel("");
      setStartsAt(""); setEndsAt(""); setBranches(new Set()); setCities("");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id: string, status: string) {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/sponsor", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      /* durum değişmedi */
    } finally {
      setBusyId(null);
    }
  }

  async function removeDraft(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/sponsor?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      /* silinemedi (yalnız DRAFT silinebilir) */
    } finally {
      setBusyId(null);
    }
  }

  const STATUS_TONE: Record<string, string> = {
    DRAFT: "bg-[var(--c-surface-2)] text-[var(--c-ink-2)]",
    ACTIVE: "bg-emerald-500/15 text-emerald-300",
    PAUSED: "bg-amber-500/15 text-amber-300",
    ENDED: "bg-[var(--c-surface-2)] text-[var(--c-ink-3)]",
  };

  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--c-hairline)] px-3.5 py-2 text-xs font-semibold text-[var(--c-ink-2)] hover:bg-[var(--c-surface)]"
      >
        <Plus size={14} /> Yeni kampanya
      </button>

      {open && (
        <div className="mt-3 grid gap-3 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="sp-sponsor">Reklamveren (tüzel kişi)</label>
              <input id="sp-sponsor" className={inputCls} value={sponsor} onChange={(e) => setSponsor(e.target.value)} placeholder="Örn. X Kongre Organizasyon A.Ş." />
            </div>
            <div>
              <label className={labelCls} htmlFor="sp-category">Kategori (ilaç YOK — Modül D parkı)</label>
              <select id="sp-category" className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
                {Object.entries(p.categoryLabel).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="sp-title">Başlık</label>
            <input id="sp-title" className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="sp-body">Metin (kartta görünen gövde)</label>
            <textarea id="sp-body" rows={3} className={inputCls} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="sp-link">Bağlantı (http/https, opsiyonel)</label>
              <input id="sp-link" className={inputCls} value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" />
            </div>
            <div>
              <label className={labelCls} htmlFor="sp-linklabel">Düğme metni (boş = &quot;Ayrıntılar&quot;)</label>
              <input id="sp-linklabel" className={inputCls} value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="sp-start">Başlangıç</label>
              <input id="sp-start" type="date" className={inputCls} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="sp-end">Bitiş</label>
              <input id="sp-end" type="date" className={inputCls} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>
          <div>
            <span className={labelCls}>Hedef branşlar (boş = herkese/bağlamsal; hedef YALNIZ açık-rızalı hekime uygulanır)</span>
            <div className="mt-1.5 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
              {p.branchOptions.map((o) => {
                const on = branches.has(o.slug);
                return (
                  <button
                    key={o.slug}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setBranches((prev) => {
                        const n = new Set(prev);
                        if (n.has(o.slug)) n.delete(o.slug);
                        else n.add(o.slug);
                        return n;
                      })
                    }
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition ${
                      on
                        ? "border-amber-400/40 bg-amber-500/15 text-amber-300"
                        : "border-[var(--c-hairline)] text-[var(--c-ink-2)] hover:bg-[var(--c-surface-2)]"
                    }`}
                  >
                    {on && <Check size={11} strokeWidth={3} />}
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="sp-cities">Hedef şehirler (virgülle; boş = tüm şehirler)</label>
            <input id="sp-cities" className={inputCls} value={cities} onChange={(e) => setCities(e.target.value)} placeholder="İstanbul, Ankara" />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={create}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/90 px-3.5 py-1.5 text-xs font-semibold text-[#2a1a02] hover:bg-amber-400 disabled:opacity-60"
            >
              {saving && <Loader2 size={12} className="animate-spin" />} Taslak oluştur
            </button>
            {msg && <span className="text-[11px] text-[var(--c-ink-2)]">{msg}</span>}
          </div>
        </div>
      )}

      <ul className="mt-5 grid gap-2.5">
        {p.rows.length === 0 && (
          <li className="rounded-xl border border-dashed border-[var(--c-hairline)] px-4 py-6 text-center text-xs text-[var(--c-ink-3)]">
            Henüz kampanya yok.
          </li>
        )}
        {p.rows.map((r) => (
          <li key={r.id} className="rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_TONE[r.status] ?? STATUS_TONE.DRAFT}`}>
                {r.status}
              </span>
              <span className="aura-mono text-[10px] text-[var(--c-ink-3)]">{p.categoryLabel[r.category] ?? r.category}</span>
              <span className="text-[11px] text-[var(--c-ink-3)]">
                {r.startsAt} → {r.endsAt} · {r.targeted ? "hedefli" : "bağlamsal"}
              </span>
              <span className="aura-mono ml-auto text-[10px] text-[var(--c-ink-3)]">
                {r.impressions} gösterim · {r.clicks} tık
              </span>
            </div>
            <p className="mt-1 text-sm font-semibold text-[var(--c-ink)]">{r.title}</p>
            <p className="text-[11px] text-[var(--c-ink-2)]">{r.sponsor}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {busyId === r.id && <Loader2 size={12} className="animate-spin text-[var(--c-ink-3)]" />}
              {r.status !== "ACTIVE" && r.status !== "ENDED" && (
                <button type="button" onClick={() => setStatus(r.id, "ACTIVE")} disabled={busyId === r.id}
                  className="rounded-full border border-emerald-400/40 px-2.5 py-1 text-[11px] text-emerald-300 hover:bg-emerald-500/10">
                  Aktif et
                </button>
              )}
              {r.status === "ACTIVE" && (
                <button type="button" onClick={() => setStatus(r.id, "PAUSED")} disabled={busyId === r.id}
                  className="rounded-full border border-amber-400/40 px-2.5 py-1 text-[11px] text-amber-300 hover:bg-amber-500/10">
                  Duraklat
                </button>
              )}
              {(r.status === "ACTIVE" || r.status === "PAUSED") && (
                <button type="button" onClick={() => setStatus(r.id, "ENDED")} disabled={busyId === r.id}
                  className="rounded-full border border-[var(--c-hairline)] px-2.5 py-1 text-[11px] text-[var(--c-ink-2)] hover:bg-[var(--c-surface-2)]">
                  Bitir
                </button>
              )}
              {r.status === "DRAFT" && (
                <button type="button" onClick={() => removeDraft(r.id)} disabled={busyId === r.id}
                  className="inline-flex items-center gap-1 rounded-full border border-red-400/30 px-2.5 py-1 text-[11px] text-red-300 hover:bg-red-500/10">
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
