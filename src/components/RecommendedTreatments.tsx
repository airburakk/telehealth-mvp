"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatTRY, tryToUsd } from "@/lib/pricing";
import { Search, Plus, X, Save, Luggage, Loader2, Check, ClipboardList } from "lucide-react";

interface Proc { code: string; name: string; price: number | null; branch: string; group: string }
interface Sel { name: string; priceTRY: number; floor: number }
const CEIL_MULT = 3;

function hueFor(price: number, floor: number, ceil: number): string {
  const r = ceil > floor ? Math.min(1, Math.max(0, (price - floor) / (ceil - floor))) : 0;
  return `hsl(${Math.round(120 * (1 - r))} 75% 42%)`;
}

export default function RecommendedTreatments({
  caseId, branchLabel, branchProcedures, doctorPrices, initial,
}: {
  caseId: string;
  branchLabel: string;
  branchProcedures: Proc[];
  doctorPrices: Record<string, number>; // M5: code -> doktorun ₺ fiyatı
  initial: { code: string; name: string; priceTRY: number }[];
}) {
  const router = useRouter();

  const [sel, setSel] = useState<Record<string, Sel>>(() => {
    const m: Record<string, Sel> = {};
    for (const it of initial) {
      const bp = branchProcedures.find((p) => p.code === it.code);
      m[it.code] = { name: it.name, priceTRY: it.priceTRY, floor: bp?.price && bp.price > 0 ? bp.price : it.priceTRY };
    }
    return m;
  });
  const initialKey = useRef(JSON.stringify(initial.map((i) => [i.code, i.priceTRY])));
  const [savedKey, setSavedKey] = useState(initialKey.current);

  const [query, setQuery] = useState("");
  const [catMode, setCatMode] = useState(false);
  const [catRes, setCatRes] = useState<Proc[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const branchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return branchProcedures
      .filter((p) => !(p.code in sel) && (p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)))
      .slice(0, 30);
  }, [query, branchProcedures, sel]);

  function add(p: Proc) {
    const floor = p.price && p.price > 0 ? p.price : 0;
    const price = doctorPrices[p.code] ?? floor;
    setSel((s) => ({ ...s, [p.code]: { name: p.name, priceTRY: price, floor } }));
  }
  function remove(code: string) {
    setSel((s) => { const n = { ...s }; delete n[code]; return n; });
  }
  function setPrice(code: string, v: number) {
    setSel((s) => ({ ...s, [code]: { ...s[code], priceTRY: v } }));
  }

  function catSearch(q: string) {
    setQuery(q);
    if (!catMode) return;
    if (debounce.current) clearTimeout(debounce.current);
    if (q.trim().length < 2) { setCatRes([]); return; }
    setCatLoading(true);
    debounce.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/doctor/procedures?q=${encodeURIComponent(q)}`);
        const d = await r.json();
        setCatRes((d.items ?? []) as Proc[]);
      } catch { setCatRes([]); }
      setCatLoading(false);
    }, 280);
  }

  const entries = Object.entries(sel);
  const totalTRY = entries.reduce((a, [, v]) => a + (v.priceTRY || 0), 0);
  const curKey = JSON.stringify(entries.map(([c, v]) => [c, v.priceTRY]).sort());
  const dirty = curKey !== JSON.stringify(JSON.parse(savedKey).slice().sort());

  async function save(): Promise<boolean> {
    setSaving(true); setMsg("");
    try {
      const r = await fetch(`/api/cases/${caseId}/recommendations`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ treatments: entries.map(([code, v]) => ({ code, priceTRY: v.priceTRY })) }),
      });
      const d = await r.json();
      if (r.ok) { setSavedKey(JSON.stringify(entries.map(([c, v]) => [c, v.priceTRY]))); setMsg(`✓ ${d.count} tedavi kaydedildi`); setTimeout(() => setMsg(""), 4000); return true; }
      setMsg(d.error || "Kaydedilemedi"); return false;
    } catch { setMsg("Bağlantı hatası"); return false; }
    finally { setSaving(false); }
  }
  async function saveAndPackage() {
    const ok = await save();
    if (ok) router.push(`/paket/${caseId}`);
  }

  const results = catMode ? catRes.filter((p) => !(p.code in sel)) : branchResults;

  return (
    <div className="mt-3 rounded-xl border border-emerald-200 bg-white p-3.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700">
        <ClipboardList size={13} /> Tavsiye Edilen Tedaviler
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        SOAP sonrası önerdiğiniz tedavileri <b>{branchLabel}</b> listesinden ekleyin; fiyat sizin belirlediğiniz değerdir (pakete bu fiyatlarla yansır).
      </p>

      {/* Arama */}
      <div className="mt-2.5 flex items-center gap-1.5">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => catSearch(e.target.value)}
            placeholder={catMode ? "Tüm katalogda ara…" : `${branchLabel} tedavisi ara…`}
            className="w-full rounded-lg border border-slate-300 py-1.5 pl-8 pr-2 text-sm outline-none focus:border-emerald-500"
          />
        </div>
        <button
          onClick={() => { setCatMode((v) => !v); setCatRes([]); }}
          title="Branş dışı / sınıflandırılmamış işlemleri de ara"
          className={`shrink-0 rounded-lg border px-2 py-1.5 text-[11px] font-medium ${catMode ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-300 text-slate-500 hover:bg-slate-50"}`}
        >
          Tüm katalog
        </button>
      </div>

      {/* Sonuçlar */}
      {query.trim().length >= (catMode ? 2 : 1) && (
        <div className="mt-1.5 max-h-44 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
          {catLoading && <div className="px-3 py-2 text-xs text-slate-400">Aranıyor…</div>}
          {!catLoading && results.length === 0 && <div className="px-3 py-2 text-xs text-slate-400">Sonuç yok.</div>}
          {results.map((p) => (
            <button key={p.code} onClick={() => add(p)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-emerald-50/60">
              <span className="min-w-0">
                <span className="block truncate text-slate-700">{p.name}</span>
                <span className="text-[11px] text-slate-400">{p.code} · {p.price ? formatTRY(doctorPrices[p.code] ?? p.price) : "fiyat yok"}{doctorPrices[p.code] ? " · sizin fiyatınız" : ""}</span>
              </span>
              <Plus size={15} className="shrink-0 text-emerald-600" />
            </button>
          ))}
        </div>
      )}

      {/* Seçilenler */}
      <div className="mt-3">
        {entries.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-center text-xs text-slate-400">Henüz tedavi eklenmedi. Yukarıdan arayıp ekleyin.</p>
        ) : (
          <ul className="space-y-2">
            {entries.map(([code, v]) => {
              const floor = v.floor > 0 ? v.floor : 0;
              const ceil = floor * CEIL_MULT;
              const color = floor > 0 ? hueFor(v.priceTRY, floor, ceil) : "#0E9E97";
              const step = floor > 0 ? Math.max(1, Math.round((ceil - floor) / 100)) : 1;
              return (
                <li key={code} className="rounded-lg border border-slate-200 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm text-slate-700">{v.name}</div>
                      <div className="text-[11px] text-slate-400">{code}{floor > 0 ? ` · taban ${formatTRY(floor)} · tavan ${formatTRY(ceil)}` : ""}</div>
                    </div>
                    <button onClick={() => remove(code)} className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"><X size={15} /></button>
                  </div>
                  {floor > 0 ? (
                    <div className="mt-1.5 flex items-center gap-2">
                      <input type="range" min={floor} max={ceil} step={step} value={v.priceTRY} onChange={(e) => setPrice(code, Number(e.target.value))} className="h-2 flex-1 cursor-pointer" style={{ accentColor: color }} />
                      <span className="w-24 shrink-0 text-right text-sm font-bold tabular-nums" style={{ color }}>{formatTRY(v.priceTRY)}</span>
                    </div>
                  ) : (
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">Fiyat (₺):</span>
                      <input type="number" min={0} value={v.priceTRY || ""} onChange={(e) => setPrice(code, Math.max(0, Number(e.target.value)))} className="w-28 rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:border-emerald-500" />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Özet + aksiyonlar */}
      {entries.length > 0 && (
        <div className="mt-2.5 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <span className="text-slate-500">{entries.length} tedavi · toplam</span>
          <span className="font-bold text-[#0A3F39]">{formatTRY(totalTRY)} <span className="text-xs font-normal text-slate-400">≈ ${tryToUsd(totalTRY).toLocaleString("en-US")}</span></span>
        </div>
      )}
      {msg && <div className="mt-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">{msg}</div>}
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <button onClick={save} disabled={!dirty || saving} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Kaydet
        </button>
        <button onClick={saveAndPackage} disabled={saving || entries.length === 0} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40">
          <Luggage size={15} /> Paketi oluştur
        </button>
      </div>
    </div>
  );
}
