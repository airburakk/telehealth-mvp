"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Kurum tablosu süzgeçleri (K2) — seçimler URL sorgusuna yazılır, tablo SUNUCUDA yeniden çizilir (RSC; satır verisi client'a inmez).
 * 🪤 useSearchParams KULLANILMAZ (Suspense/CSR bailout tuzağı — [[nextjs-layout-usesearchparams-suspense]]): mevcut değerler sunucudan
 * prop olarak gelir, sorgu buradan kurulur. Arama kutusu 350 ms geciktirilir; kaydırma korunur (#kurumlar).
 */
export interface TusInstitutionFiltersProps {
  branches: { branch: string; label: string }[];
  periods: { key: string; label: string }[];
  types: { key: string; label: string }[];
  value: { brans: string; donem: string; tur: string; kt: string; q: string; sirala: string };
}

export default function TusInstitutionFilters({ branches, periods, types, value }: TusInstitutionFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(value.q);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = (patch: Partial<TusInstitutionFiltersProps["value"]>) => {
    const next = { ...value, q, ...patch };
    const sp = new URLSearchParams();
    if (next.brans) sp.set("brans", next.brans);
    if (next.donem) sp.set("donem", next.donem);
    if (next.tur && next.tur !== "ALL") sp.set("tur", next.tur);
    if (next.kt && next.kt !== "ALL") sp.set("kt", next.kt);
    if (next.q.trim()) sp.set("q", next.q.trim());
    if (next.sirala && next.sirala !== "min") sp.set("sirala", next.sirala);
    router.replace(`${pathname}?${sp.toString()}#kurumlar`, { scroll: false });
  };

  useEffect(() => {
    if (q === value.q) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => push({ q }), 350);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- yalnız q değişiminde; push/value her render'da yeni referans
  }, [q]);

  const selectCls = "rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3 py-2 text-sm normal-case tracking-normal text-[var(--c-ink)]";
  const labelCls = "flex flex-col gap-1 text-[11px] uppercase tracking-wider text-[var(--c-ink-3)]";

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className={labelCls}>Branş
        <select value={value.brans} onChange={(e) => push({ brans: e.target.value })} className={`${selectCls} max-w-[260px]`}>
          {branches.map((b) => <option key={b.branch} value={b.branch}>{b.label}</option>)}
        </select>
      </label>
      <label className={labelCls}>Dönem
        <select value={value.donem} onChange={(e) => push({ donem: e.target.value })} className={selectCls}>
          {periods.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
      </label>
      <label className={labelCls}>Kurum türü
        <select value={value.tur} onChange={(e) => push({ tur: e.target.value })} className={selectCls}>
          <option value="ALL">Hepsi</option>
          {types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </label>
      <label className={labelCls}>Kontenjan
        <select value={value.kt} onChange={(e) => push({ kt: e.target.value })} className={selectCls}>
          <option value="ALL">Hepsi</option>
          <option value="GENEL">GENEL</option>
          <option value="YABANCI">Yabancı uyruklu</option>
        </select>
      </label>
      <label className={labelCls}>Sırala
        <select value={value.sirala} onChange={(e) => push({ sirala: e.target.value })} className={selectCls}>
          <option value="min">En küçük puan</option>
          <option value="quota">Kontenjan</option>
          <option value="vacant">Boş kalan</option>
          <option value="name">Kurum adı</option>
        </select>
      </label>
      <label className={`${labelCls} grow`}>Kurum ara
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Üniversite ya da hastane adı" className={`${selectCls} w-full`} />
      </label>
    </div>
  );
}
