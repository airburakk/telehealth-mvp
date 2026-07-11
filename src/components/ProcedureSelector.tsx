"use client";

import { useMemo, useRef, useState } from "react";
import { Search, Check, Save, Plus, Stethoscope } from "lucide-react";

export interface Proc {
  code: string;
  name: string;
  price: number | null; // taban (₺)
  branch: string;
  group: string;
}

const CEIL_MULT = 3;

function fmtTRY(n: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);
}

export default function ProcedureSelector({
  branchLabel,
  branchItems,
  initial,
  extraItems,
}: {
  branchKey?: string; // geriye uyum: çağıranlar geçiyor; fiyat UI kalktığından artık kullanılmıyor
  branchLabel: string;
  branchItems: Proc[];
  initial: Record<string, number>;
  extraItems: Proc[]; // kayıtlı ama branş listesinde olmayan (Diğer'den eklenmiş) işlemler
}) {
  const [sel, setSel] = useState<Record<string, number>>(initial);
  const [savedSel, setSavedSel] = useState<Record<string, number>>(initial);
  const [query, setQuery] = useState("");
  const [extra, setExtra] = useState<Proc[]>(extraItems);
  const [open, setOpen] = useState<Set<string>>(() => {
    // başlangıçta seçili işlem içeren grupları aç
    const s = new Set<string>();
    for (const p of [...branchItems, ...extraItems]) if (initial[p.code] != null) s.add(p.group || "—");
    return s;
  });

  // "Diğer havuzundan ekle"
  const [otherQ, setOtherQ] = useState("");
  const [otherRes, setOtherRes] = useState<Proc[]>([]);
  const [otherLoading, setOtherLoading] = useState(false);
  const [showOther, setShowOther] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const allItems = useMemo(() => {
    // branş + ekstra; kod tekilleştir
    const map = new Map<string, Proc>();
    for (const p of branchItems) map.set(p.code, p);
    for (const p of extra) if (!map.has(p.code)) map.set(p.code, p);
    return [...map.values()];
  }, [branchItems, extra]);

  const codeMap = useMemo(() => {
    const m = new Map<string, Proc>();
    for (const p of allItems) m.set(p.code, p);
    return m;
  }, [allItems]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter((p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
  }, [allItems, query]);

  const groups = useMemo(() => {
    const m = new Map<string, Proc[]>();
    for (const p of filtered) {
      const g = p.group || "—";
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(p);
    }
    return [...m.entries()];
  }, [filtered]);

  const selectedCount = Object.keys(sel).length;
  const dirty = useMemo(() => JSON.stringify(sel) !== JSON.stringify(savedSel), [sel, savedSel]);

  // Seçim değeri = taban fiyat (₺). Ücret ARTIK burada belirlenmez — tedavi kararı ekranında
  // (RecommendedTreatments slider) seçilir ve doktorun fiyat hafızasına oradan yazılır.
  // Daha önce fiyat belirlemiş doktorun mevcut değeri, işlem yeniden seçilmedikçe korunur.
  function toggle(p: Proc) {
    setSel((prev) => {
      const next = { ...prev };
      if (next[p.code] != null) {
        delete next[p.code];
      } else {
        next[p.code] = p.price && p.price > 0 ? p.price : 0; // taban'dan başla
      }
      return next;
    });
  }
  function toggleGroup(g: string) {
    setOpen((prev) => {
      const s = new Set(prev);
      if (s.has(g)) s.delete(g); else s.add(g);
      return s;
    });
  }

  function searchOther(q: string) {
    setOtherQ(q);
    if (debounce.current) clearTimeout(debounce.current);
    if (q.trim().length < 2) { setOtherRes([]); return; }
    setOtherLoading(true);
    debounce.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/doctor/procedures?q=${encodeURIComponent(q)}`);
        const d = await r.json();
        setOtherRes((d.items ?? []) as Proc[]);
      } catch { setOtherRes([]); }
      setOtherLoading(false);
    }, 280);
  }
  function addFromOther(p: Proc) {
    if (!codeMap.has(p.code)) setExtra((prev) => [...prev, p]);
    setSel((prev) => ({ ...prev, [p.code]: p.price && p.price > 0 ? p.price : 0 }));
    setOpen((prev) => new Set(prev).add(p.group || "—"));
  }

  async function save() {
    setSaving(true); setMsg("");
    try {
      const r = await fetch("/api/doctor/procedures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selections: sel }),
      });
      const d = await r.json();
      if (r.ok) { setSavedSel(sel); setMsg(`✓ ${d.count} işlem kaydedildi`); }
      else setMsg(d.error || "Kaydedilemedi");
    } catch { setMsg("Bağlantı hatası"); }
    setSaving(false);
    setTimeout(() => setMsg(""), 4000);
  }

  const searching = query.trim().length > 0;

  return (
    <div className="rounded-3xl border border-white/10 bg-[#161719] p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/50">
            <Stethoscope size={15} /> Yaptığım İşlemler
          </div>
          <p className="mt-1 text-sm text-white/50">
            <span className="font-medium text-[#1FA9B8]">{branchLabel}</span> branşındaki işlemlerden yaptıklarınızı seçin.
            İşlem ücreti burada belirlenmez — hasta görüşmesi sonrası <span className="font-medium">tedavi kararında</span>,
            taban ile tavan (taban×{CEIL_MULT}) arası kaydırma çubuğuyla belirlersiniz.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#28C8D8]/10 px-3 py-1 text-xs font-semibold text-[#28C8D8]">{selectedCount} seçili</span>
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#28C8D8] px-3.5 py-2 text-sm font-semibold text-[#0D0E10] hover:bg-[#1FA9B8] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save size={15} /> {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </div>
      {msg && <div className="mt-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-300">{msg}</div>}

      {/* Arama + Diğer havuzu */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`${branchLabel} işlemlerinde ara…`}
            className="w-full rounded-lg border border-white/15 py-2 pl-9 pr-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-[#28C8D8]/20"
          />
        </div>
        <button
          onClick={() => setShowOther((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-white/65 hover:bg-[#1E1F22]"
        >
          <Plus size={15} /> Diğer havuzundan ekle
        </button>
      </div>

      {showOther && (
        <div className="mt-3 rounded-2xl border border-dashed border-[#28C8D8]/30 bg-teal-50/40 p-3">
          <div className="text-xs font-semibold text-[#28C8D8]">Tüm tarifede ara (branş dışı / sınıflandırılmamış işlemler dahil)</div>
          <div className="relative mt-2">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              value={otherQ}
              onChange={(e) => searchOther(e.target.value)}
              placeholder="örn. botoks, biyopsi, USG…"
              className="w-full rounded-lg border border-white/15 py-2 pl-9 pr-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-[#28C8D8]/20"
            />
          </div>
          {otherLoading && <div className="mt-2 text-xs text-white/40">Aranıyor…</div>}
          {!otherLoading && otherQ.trim().length >= 2 && otherRes.length === 0 && (
            <div className="mt-2 text-xs text-white/40">Sonuç yok.</div>
          )}
          {otherRes.length > 0 && (
            <ul className="mt-2 max-h-60 divide-y divide-white/10 overflow-y-auto rounded-lg border border-white/10 bg-[#161719]">
              {otherRes.map((p) => {
                const added = sel[p.code] != null;
                return (
                  <li key={p.code} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="truncate text-white/75">{p.name}</div>
                      <div className="text-[11px] text-white/40">{p.code} · {p.price ? fmtTRY(p.price) : "fiyat yok"} · {p.group}</div>
                    </div>
                    <button
                      onClick={() => addFromOther(p)}
                      disabled={added}
                      className="shrink-0 rounded-md border border-[#28C8D8]/30 px-2 py-1 text-xs font-medium text-[#28C8D8] hover:bg-[#28C8D8]/10 disabled:opacity-40"
                    >
                      {added ? "Eklendi" : "Ekle"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Liste */}
      {allItems.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-[#1E1F22] p-6 text-center text-sm text-white/50">
          Bu branş için tarifede tanımlı hazır işlem yok. Yukarıdaki <b>“Diğer havuzundan ekle”</b> ile yaptığınız işlemleri arayıp ekleyebilirsiniz.
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {groups.map(([g, items]) => {
            const isOpen = searching || open.has(g);
            const selInGroup = items.filter((p) => sel[p.code] != null).length;
            return (
              <div key={g} className="overflow-hidden rounded-2xl border border-white/10">
                <button
                  onClick={() => toggleGroup(g)}
                  className="flex w-full items-center justify-between gap-2 bg-[#1E1F22] px-4 py-2.5 text-left text-sm font-semibold text-white/75 hover:bg-white/10"
                >
                  <span className="truncate">{g}</span>
                  <span className="flex shrink-0 items-center gap-2 text-xs font-normal text-white/40">
                    {selInGroup > 0 && <span className="rounded-full bg-[#28C8D8]/15 px-2 py-0.5 font-semibold text-[#28C8D8]">{selInGroup}</span>}
                    {items.length} işlem {isOpen ? "▲" : "▼"}
                  </span>
                </button>
                {isOpen && (
                  <ul className="divide-y divide-white/10">
                    {items.map((p) => (
                      <ProcRow key={p.code} p={p} selected={sel[p.code] != null} onToggle={() => toggle(p)} />
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
          {groups.length === 0 && <div className="rounded-2xl border border-dashed border-white/15 p-4 text-center text-sm text-white/40">Aramayla eşleşen işlem yok.</div>}
        </div>
      )}
    </div>
  );
}

// Satır: yalnız işlem seçimi. Ücret burada belirlenmez (2026-07-10 akış değişikliği) —
// taban/tavan yalnız bilgi amaçlı gösterilir; fiyat, görüşme sonrası tedavi kararında seçilir.
function ProcRow({
  p, selected, onToggle,
}: {
  p: Proc; selected: boolean; onToggle: () => void;
}) {
  const floor = p.price && p.price > 0 ? p.price : 0;
  const ceil = floor * CEIL_MULT;

  return (
    <li className="px-4 py-3">
      <label className="flex cursor-pointer items-start gap-3">
        <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border ${selected ? "border-[#28C8D8] bg-[#28C8D8] text-[#0D0E10]" : "border-white/15 bg-[#161719]"}`}>
          {selected && <Check size={13} />}
        </span>
        <input type="checkbox" checked={selected} onChange={onToggle} className="sr-only" />
        <div className="min-w-0 flex-1">
          <div className="text-sm text-white/75">{p.name}</div>
          <div className="text-[11px] text-white/40">
            {p.code}
            {floor > 0 ? <> · taban {fmtTRY(floor)} · tavan {fmtTRY(ceil)} <span className="text-white/25">· ücret tedavi kararında belirlenir</span></> : <> · tarife fiyatı tanımsız</>}
          </div>
        </div>
      </label>
    </li>
  );
}
