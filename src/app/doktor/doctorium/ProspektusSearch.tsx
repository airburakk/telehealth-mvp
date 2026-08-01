"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Pill, Search } from "lucide-react";

interface Result {
  id: string | null;
  brand: string | null;
  generic: string | null;
  manufacturer: string | null;
  effectiveTime: string | null;
  indications: string | null;
  dosage: string | null;
  warnings: string | null;
  contraindications: string | null;
  adverse: string | null;
}

// Dijital prospektüs arama (v6.50). Kaynak openFDA = ABD ürün bilgisi; TİTCK'nın makine-okunur
// kaynağı YOK → "FDA (ABD)" uyarısı kaldırılamaz biçimde her sonuçta durur ve metin ÇEVRİLMEZ.
export function ProspektusSearch() {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<Result[] | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/doctorium/prospektus?q=${encodeURIComponent(q.trim())}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Arama başarısız.");
      setRows(j.results ?? []);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Arama başarısız.");
      setRows(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--c-ink)]">
        <Pill size={16} className="text-emerald-300" /> Dijital prospektüs araması
      </h2>

      {/* Bu uyarı KALDIRILAMAZ: veri ABD ruhsatına ait; Türkiye KÜB/KT farklı olabilir. */}
      <p className="mt-2 flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-200">
        <AlertTriangle size={14} className="mt-px shrink-0" />
        Sonuçlar <strong>FDA (ABD) onaylı ürün bilgisidir</strong>. Türkiye ruhsatındaki Kısa Ürün
        Bilgisi (KÜB) / Kullanma Talimatı (KT) endikasyon, doz ve uyarılar açısından FARKLI olabilir —
        reçeteleme kararında <strong>TİTCK onaylı KÜB'ü esas alın</strong>. Metinler özgün dilinde
        (İngilizce) gösterilir; çeviri yapılmaz.
      </p>

      <form onSubmit={search} className="mt-3 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Etken madde veya marka adı (ör. metformin)"
          aria-label="İlaç adı"
          className="min-w-0 flex-1 rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface-2)] px-3 py-2 text-sm text-[var(--c-ink)] outline-none focus:border-emerald-400/50"
        />
        <button type="submit" disabled={busy || q.trim().length < 2}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-500/90 px-3.5 py-2 text-sm font-semibold text-[#062a20] hover:bg-emerald-400 disabled:opacity-60">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Ara
        </button>
      </form>

      {err && <p className="mt-2 text-xs text-rose-300">{err}</p>}
      {rows?.length === 0 && <p className="mt-3 text-xs text-[var(--c-ink-2)]">Bu ada ait FDA etiketi bulunamadı.</p>}

      {rows && rows.length > 0 && (
        <ul className="mt-3 grid gap-3">
          {rows.map((r, i) => (
            <li key={r.id ?? i} className="rounded-xl border border-[var(--c-hairline)] p-3.5">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-semibold text-[var(--c-ink)]">{r.brand ?? r.generic ?? "—"}</span>
                {r.generic && r.brand && <span className="text-[11px] text-[var(--c-ink-3)]">({r.generic})</span>}
                <span className="aura-mono ml-auto rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                  FDA · ABD
                </span>
              </div>
              {r.manufacturer && <p className="mt-0.5 text-[11px] text-[var(--c-ink-3)]">{r.manufacturer}</p>}
              <dl className="mt-2 grid gap-2">
                {([
                  ["Endikasyon (indications)", r.indications],
                  ["Doz (dosage)", r.dosage],
                  ["Kontrendikasyon", r.contraindications],
                  ["Uyarılar", r.warnings],
                  ["Yan etkiler", r.adverse],
                ] as [string, string | null][])
                  .filter(([, v]) => !!v)
                  .map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--c-ink-3)]">{k}</dt>
                      <dd className="mt-0.5 text-xs leading-relaxed text-[var(--c-ink-2)]">{v}</dd>
                    </div>
                  ))}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
