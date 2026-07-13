"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2, Check, FlaskConical, Plus, Trash2, Sparkles, AlertTriangle } from "lucide-react";

type Lab = { loinc: string; name: string; value: string; unit: string; abnormal?: string; aiSuggested?: boolean };
type LoincOption = { code: string; label: string };

const norm = (s?: string) => (s || "").trim().toLowerCase();
// Aynı analiti ikilemeden eşlemek için: LOINC varsa kod, yoksa normalize ad.
const labKey = (r: Partial<Lab>) => (r.loinc ? `c:${r.loinc}` : `n:${norm(r.name)}`);

// FHIR Faz 2 — vakanın laboratuvar sonuçları (LOINC kodlu) → /api/cases/:id/labs → Case.labResults → FHIR Observation.
export function LabResultsForm({
  caseId,
  initial,
  loincOptions,
}: {
  caseId: string;
  initial: Partial<Lab>[];
  loincOptions: LoincOption[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Lab[]>(
    initial.map((r) => ({
      loinc: r.loinc ?? "", name: r.name ?? "", value: r.value ?? "", unit: r.unit ?? "",
      abnormal: r.abnormal, aiSuggested: r.aiSuggested,
    }))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  // Belge analizi Case.labResults'a yeni AI satırları yazıp sayfayı tazeleyince (router.refresh),
  // bunları mevcut düzenlemeleri KORUYARAK forma ekle (var olanı ezme; aynı analiti çift ekleme).
  const initialKey = JSON.stringify(initial.map((r) => [r.loinc ?? "", r.name ?? "", r.value ?? "", r.aiSuggested ? 1 : 0]));
  useEffect(() => {
    setRows((prev) => {
      const have = new Set(prev.map(labKey));
      const additions = initial
        .filter((r) => (r.loinc || r.name) && r.value && !have.has(labKey(r)))
        .map((r) => ({
          loinc: r.loinc ?? "", name: r.name ?? "", value: r.value ?? "", unit: r.unit ?? "",
          abnormal: r.abnormal, aiSuggested: r.aiSuggested,
        }));
      return additions.length ? [...prev, ...additions] : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKey]);

  function update(i: number, patch: Partial<Lab>) {
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
    setSaved(false);
  }
  function pickLoinc(i: number, code: string) {
    const opt = loincOptions.find((o) => o.code === code);
    update(i, { loinc: code, name: opt && !rows[i].name ? opt.label : rows[i].name });
  }
  function addRow() {
    setRows([...rows, { loinc: "", name: "", value: "", unit: "" }]);
    setSaved(false);
  }
  function removeRow(i: number) {
    setRows(rows.filter((_, idx) => idx !== i));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setErr("");
    setSaved(false);
    try {
      const clean = rows.filter((r) => (r.loinc || r.name) && r.value.trim());
      const res = await fetch(`/api/cases/${caseId}/labs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labs: clean }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Kaydedilemedi.");
      // Kaydedildi → satırlar artık doktor onaylı (AI önerisi değil) → rozetleri kaldır, FHIR'a girer.
      setRows((rs) => rs.map((r) => ({ ...r, aiSuggested: false })));
      setSaved(true);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Hata oluştu.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-6 shadow-sm">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--c-ink-2)]">
        <FlaskConical size={15} /> Laboratuvar Sonuçları (FHIR Observation)
      </div>
      <p className="mt-1 text-xs text-[var(--c-ink-3)]">LOINC kodlu lab sonuçları → FHIR Observation (kategori: laboratory).</p>

      {rows.length === 0 && <p className="mt-3 text-sm text-[var(--c-ink-3)]">Henüz lab sonucu eklenmedi.</p>}

      {rows.some((r) => r.aiSuggested) && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-[var(--c-accent)]/10 px-3 py-2 text-[12px] leading-relaxed text-[var(--c-accent)] ring-1 ring-[var(--c-accent)]/25">
          <Sparkles size={13} className="mt-0.5 shrink-0" />
          <span>
            Belgelerden AI ile çıkarılan değerler <strong>öneri</strong> olarak eklendi. Gözden geçirip{" "}
            <strong>Kaydet</strong>’e basın — onaylanana dek FHIR Observation’a dahil edilmez.
          </span>
        </div>
      )}

      <div className="mt-3 space-y-2">
        {rows.map((r, i) => (
          <div key={i}>
            <div className="grid grid-cols-[minmax(0,1fr)_84px_64px_30px] items-center gap-2">
              <div className="flex gap-1">
                {loincOptions.length > 0 && (
                  <select
                    value={r.loinc}
                    onChange={(e) => pickLoinc(i, e.target.value)}
                    title="Branşa özel LOINC"
                    className="w-[88px] shrink-0 rounded-lg border border-[var(--c-hairline)] bg-[var(--c-surface)] px-2 py-2 text-xs text-[var(--c-ink-2)] outline-none focus:border-[var(--c-accent)]"
                  >
                    <option value="">LOINC…</option>
                    {loincOptions.map((o) => (
                      <option key={o.code} value={o.code}>{o.code}</option>
                    ))}
                  </select>
                )}
                <input
                  value={r.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  placeholder="test adı"
                  className={`w-full min-w-0 rounded-lg border px-2 py-2 text-sm outline-none focus:border-[var(--c-accent)] ${r.aiSuggested ? "border-[var(--c-accent)]/30 bg-[var(--c-accent)]/10" : "border-[var(--c-hairline)]"}`}
                />
              </div>
              <input
                value={r.value}
                onChange={(e) => update(i, { value: e.target.value })}
                placeholder="değer"
                className={`rounded-lg border px-2 py-2 text-sm outline-none focus:border-[var(--c-accent)] ${r.aiSuggested ? "border-[var(--c-accent)]/30 bg-[var(--c-accent)]/10" : "border-[var(--c-hairline)]"}`}
              />
              <input
                value={r.unit}
                onChange={(e) => update(i, { unit: e.target.value })}
                placeholder="birim"
                className={`rounded-lg border px-2 py-2 text-sm outline-none focus:border-[var(--c-accent)] ${r.aiSuggested ? "border-[var(--c-accent)]/30 bg-[var(--c-accent)]/10" : "border-[var(--c-hairline)]"}`}
              />
              <button
                onClick={() => removeRow(i)}
                aria-label="Sil"
                className="grid h-8 w-7 place-items-center rounded-lg text-[var(--c-ink-3)] hover:bg-red-500/10 hover:text-red-500"
              >
                <Trash2 size={14} />
              </button>
            </div>
            {(r.aiSuggested || r.abnormal) && (
              <div className="mt-1 flex flex-wrap items-center gap-2 ps-0.5 text-[11px]">
                {r.aiSuggested && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--c-accent)]/15 px-1.5 py-0.5 font-semibold text-[var(--c-accent)]">
                    <Sparkles size={10} /> AI · belgeden
                  </span>
                )}
                {r.abnormal && (
                  <span className="inline-flex items-center gap-1 font-medium text-amber-300">
                    <AlertTriangle size={10} /> {r.abnormal}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={addRow}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[var(--c-hairline)] px-3 py-2 text-sm font-medium text-[var(--c-ink-2)] hover:bg-[var(--c-surface)]"
      >
        <Plus size={14} /> Sonuç ekle
      </button>

      {err && <p className="mt-3 text-sm text-red-300">{err}</p>}

      <div className="mt-4">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--c-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)] disabled:opacity-60"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : <Save size={16} />}
          {saved ? "Kaydedildi" : "Lab sonuçlarını kaydet"}
        </button>
      </div>
    </div>
  );
}
