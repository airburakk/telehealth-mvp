"use client";

// Etik kurul kuyruğu — başvuru listesi + TIKLANIR stat filtreleri (2026-08-04, kullanıcı isteği).
// Desen: post-op RecoveryList / doktor CaseQueue stat filtresiyle AYNI — sayıya tıklayınca altta
// o kümenin satırları listelenir, tekrar tıklayınca filtre kapanır.
// Not: stat SAYILARI sunucu count'larıdır (tam küme); liste ise PENDING tümü + RESOLVED son 50
// taşır (arşiv büyüse de sayfa sabit) — "Karara bağlandı" filtresi bu son 50'yi gösterir.
import { useMemo, useState } from "react";
import Link from "next/link";
import { maskCaseId, REQUEST_TYPES, COMPLAINT_STATUS } from "@/lib/ethics";
import { formatDateTime } from "@/lib/constants";
import { Scale, ArrowRight, Inbox, ChevronDown } from "lucide-react";

export interface ComplaintListRow {
  id: string;
  caseId: string;
  status: string;
  subject: string;
  requestType: string;
  createdAt: string; // ISO
  branch: string;
}

type FilterKey = "all" | "PENDING" | "RESOLVED";

export function EthicsList({
  rows, total, pending, resolved,
}: {
  rows: ComplaintListRow[]; total: number; pending: number; resolved: number;
}) {
  // CaseQueue deseni: aynı sayıya ikinci tıklama filtreyi kapatır (null → tümü).
  const [filter, setFilter] = useState<FilterKey | null>(null);
  const toggle = (key: FilterKey) => setFilter((cur) => (cur === key ? null : key));

  const filtered = useMemo(() => {
    if (!filter || filter === "all") return rows;
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  return (
    <>
      <div className="mt-5 grid grid-cols-3 gap-3 sm:max-w-md">
        <Stat label="Toplam başvuru" value={total} active={filter === "all"} onClick={() => toggle("all")} />
        <Stat label="Beklemede" value={pending} tone="text-amber-300" active={filter === "PENDING"} onClick={() => toggle("PENDING")} />
        <Stat label="Karara bağlandı" value={resolved} tone="text-emerald-300" active={filter === "RESOLVED"} onClick={() => toggle("RESOLVED")} />
      </div>

      <div className="mt-6 space-y-2.5">
        {rows.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[var(--c-hairline)] bg-[var(--c-panel)] py-12 text-center text-[var(--c-ink-3)]">
            <Inbox className="mx-auto mb-2" /> Başvuru yok.
          </div>
        )}
        {rows.length > 0 && filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[var(--c-hairline)] bg-[var(--c-panel)] py-10 text-center text-sm text-[var(--c-ink-3)]">
            Bu filtrede başvuru yok — sayıya yeniden tıklayarak tüm listeye dönebilirsiniz.
          </div>
        )}
        {filtered.map((c) => {
          const st = COMPLAINT_STATUS[c.status] ?? COMPLAINT_STATUS.PENDING;
          return (
            <Link
              key={c.id}
              href={`/etik-kurul/${c.id}`}
              className={`group flex items-center gap-4 rounded-2xl border bg-[var(--c-panel)] p-4 transition hover:shadow-sm ${c.status === "PENDING" ? "border-amber-400/25" : "border-[var(--c-hairline)] hover:border-[var(--c-accent)]/30"}`}
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--c-ink)]/10 text-[var(--c-ink-2)]"><Scale size={20} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-[var(--c-ink)]">{maskCaseId(c.caseId)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.color}`}>{st.label}</span>
                </div>
                <div className="mt-0.5 truncate text-sm text-[var(--c-ink-2)]">{c.subject}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-[var(--c-ink-3)]">
                  <span className="font-medium text-[var(--c-accent-strong)]">{REQUEST_TYPES[c.requestType]}</span>
                  <span>· {c.branch}</span>
                  <span>· {formatDateTime(c.createdAt)}</span>
                </div>
              </div>
              <ArrowRight size={18} className="shrink-0 text-[var(--c-ink-3)] transition group-hover:translate-x-0.5 group-hover:text-[var(--c-accent-strong)]" />
            </Link>
          );
        })}
      </div>
    </>
  );
}

/** CaseQueue Stat deseni: tıklanır sayaç — aktifken accent çerçeve + dönen chevron. */
function Stat({
  label, value, tone, active, onClick,
}: {
  label: string; value: number; tone?: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      className={`rounded-2xl border p-3.5 text-left transition ${active ? "border-[var(--c-accent)] bg-[var(--c-accent)]/[0.06]" : "border-[var(--c-hairline)] bg-[var(--c-panel)] hover:border-[var(--c-accent)]/40"}`}
    >
      <div className={`text-2xl font-bold ${tone ?? "text-[var(--c-ink)]"}`}>{value}</div>
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs text-[var(--c-ink-2)]">{label}</span>
        <ChevronDown size={13} className={`shrink-0 text-[var(--c-ink-3)] transition-transform ${active ? "rotate-180" : ""}`} />
      </div>
    </button>
  );
}
