"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Lock, Plus, Trash2 } from "lucide-react";

// Anket admin formu + listesi (v6.69 Faz 2) — SponsorForm deseni. Şıklar satır-satır girilir
// (2-6). Honorarium alanı SPONSORED'da açılır; >0 girilirse kart "kilitli" rozeti taşır ve
// ACTIVE denemesi API'den 400 döner (ödeme kurgusu 👤 parkı) — kilit mesajı aynen gösterilir.

interface Row {
  id: string;
  kind: string;
  sponsor: string | null;
  question: string;
  honorarium: number | null;
  status: string;
  responses: number;
  startsAt: string;
  endsAt: string;
  targeted: boolean;
}

interface Props {
  branchOptions: { slug: string; label: string }[];
  kindLabel: Record<string, string>;
  rows: Row[];
}

const inputCls =
  "w-full rounded-lg border border-[var(--c-hairline)] bg-[var(--c-surface-2)] px-3 py-1.5 text-sm text-[var(--c-ink)] placeholder:text-[var(--c-ink-3)]";
const labelCls = "text-[11px] font-semibold text-[var(--c-ink-2)]";

export function SurveyAdmin(p: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowErr, setRowErr] = useState<string | null>(null);

  const [kind, setKind] = useState("COMMUNITY");
  const [sponsor, setSponsor] = useState("");
  const [question, setQuestion] = useState("");
  const [optionsText, setOptionsText] = useState("");
  const [honorariumTl, setHonorariumTl] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [branches, setBranches] = useState<Set<string>>(new Set());

  async function create() {
    setSaving(true);
    setMsg(null);
    try {
      const tl = parseFloat(honorariumTl.replace(",", "."));
      const res = await fetch("/api/admin/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          sponsor: sponsor || null,
          question,
          options: optionsText.split("\n").map((s) => s.trim()).filter(Boolean),
          honorarium: kind === "SPONSORED" && Number.isFinite(tl) && tl > 0 ? Math.round(tl * 100) : 0,
          targetBranches: [...branches],
          startsAt, endsAt,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Kaydedilemedi.");
      setMsg("Taslak oluşturuldu — listeden AKTİF edin.");
      setSponsor(""); setQuestion(""); setOptionsText(""); setHonorariumTl("");
      setStartsAt(""); setEndsAt(""); setBranches(new Set());
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id: string, status: string) {
    setBusyId(id);
    setRowErr(null);
    try {
      const res = await fetch("/api/admin/survey", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
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

  async function removeDraft(id: string) {
    setBusyId(id);
    setRowErr(null);
    try {
      const res = await fetch(`/api/admin/survey?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setRowErr("Silinemedi (yalnız DRAFT silinebilir).");
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
        <Plus size={14} /> Yeni anket
      </button>

      {open && (
        <div className="mt-3 grid gap-3 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="sv-kind">Tür</label>
              <select id="sv-kind" className={inputCls} value={kind} onChange={(e) => setKind(e.target.value)}>
                {Object.entries(p.kindLabel).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            {kind === "SPONSORED" && (
              <div>
                <label className={labelCls} htmlFor="sv-sponsor">Reklamveren (kartta görünür)</label>
                <input id="sv-sponsor" className={inputCls} value={sponsor} onChange={(e) => setSponsor(e.target.value)} />
              </div>
            )}
          </div>
          <div>
            <label className={labelCls} htmlFor="sv-question">Soru</label>
            <input id="sv-question" className={inputCls} value={question} onChange={(e) => setQuestion(e.target.value)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="sv-options">Şıklar (her satır bir şık; 2-6)</label>
            <textarea id="sv-options" rows={4} className={inputCls} value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)} placeholder={"Evet\nHayır\nKararsızım"} />
          </div>
          {kind === "SPONSORED" && (
            <div>
              <label className={labelCls} htmlFor="sv-honorarium">
                Katılım bedeli (₺, opsiyonel) — ⚠️ girilirse anket yayına ALINAMAZ (ödeme kurgusu bekliyor)
              </label>
              <input id="sv-honorarium" className={inputCls} value={honorariumTl}
                onChange={(e) => setHonorariumTl(e.target.value)} placeholder="0" inputMode="decimal" />
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="sv-start">Başlangıç</label>
              <input id="sv-start" type="date" className={inputCls} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="sv-end">Bitiş</label>
              <input id="sv-end" type="date" className={inputCls} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>
          <div>
            <span className={labelCls}>
              Hedef branşlar (boş = herkese; {kind === "SPONSORED" ? "hedefli sponsorlu anket YALNIZ açık-rızalı hekime gider" : "topluluk anketi akış branşına göre süzülür"})
            </span>
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
                        ? "border-sky-400/40 bg-sky-500/15 text-sky-300"
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
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={create}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500/90 px-3.5 py-1.5 text-xs font-semibold text-[#04222e] hover:bg-sky-400 disabled:opacity-60"
            >
              {saving && <Loader2 size={12} className="animate-spin" />} Taslak oluştur
            </button>
            {msg && <span className="text-[11px] text-[var(--c-ink-2)]">{msg}</span>}
          </div>
        </div>
      )}

      {rowErr && <p className="mt-3 text-[11px] text-red-300">{rowErr}</p>}

      <ul className="mt-5 grid gap-2.5">
        {p.rows.length === 0 && (
          <li className="rounded-xl border border-dashed border-[var(--c-hairline)] px-4 py-6 text-center text-xs text-[var(--c-ink-3)]">
            Henüz anket yok.
          </li>
        )}
        {p.rows.map((r) => (
          <li key={r.id} className="rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_TONE[r.status] ?? STATUS_TONE.DRAFT}`}>
                {r.status}
              </span>
              <span className="aura-mono text-[10px] text-[var(--c-ink-3)]">{p.kindLabel[r.kind] ?? r.kind}</span>
              {r.honorarium != null && r.honorarium > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                  <Lock size={10} /> ₺{(r.honorarium / 100).toLocaleString("tr-TR")} — yayın kilitli
                </span>
              )}
              <span className="text-[11px] text-[var(--c-ink-3)]">
                {r.startsAt} → {r.endsAt} · {r.targeted ? "hedefli" : "herkese"}
              </span>
              <span className="aura-mono ml-auto text-[10px] text-[var(--c-ink-3)]">{r.responses} yanıt</span>
            </div>
            <p className="mt-1 text-sm font-semibold text-[var(--c-ink)]">{r.question}</p>
            {r.sponsor && <p className="text-[11px] text-[var(--c-ink-2)]">{r.sponsor}</p>}
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
