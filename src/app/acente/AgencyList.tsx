"use client";

// Acente kuyruğu — dosya listesi + TIKLANIR stat filtreleri (2026-08-04, kullanıcı isteği).
// Desen: post-op RecoveryList / doktor CaseQueue stat filtresiyle AYNI — sayıya tıklayınca altta
// o kümenin satırları listelenir, tekrar tıklayınca filtre kapanır. Veri server page.tsx'te
// hazırlanır (decryptField SUNUCUDA kalır — ad çözümü client'a inmez); burada yalnız sunum + filtre.
import { useMemo, useState } from "react";
import Link from "next/link";
import { countryFlag, countryName, formatDateTime } from "@/lib/constants";
import { formatTRY } from "@/lib/procedures";
import { Luggage, ArrowRight, Inbox, Languages, CalendarRange, Building2, Send, CheckCircle2, Clock, ChevronDown } from "lucide-react";

export interface AgencyFileRow {
  id: string;
  patientName: string; // sunucuda çözülmüş düz metin
  country: string;
  language: string;
  branch: string;
  procCount: number;
  totalTRY: number;
  daysMin: number | null;
  daysMax: number | null;
  hospitalName: string | null;
  doctorName: string | null;
  sentAt: string | null; // ISO
  bookingStatus: string | null; // null = teklif bekliyor
}

type FilterKey = "all" | "waiting";

export function AgencyList({ rows }: { rows: AgencyFileRow[] }) {
  // CaseQueue deseni: aynı sayıya ikinci tıklama filtreyi kapatır (null → tümü).
  const [filter, setFilter] = useState<FilterKey | null>(null);
  const toggle = (key: FilterKey) => setFilter((cur) => (cur === key ? null : key));

  const waiting = rows.filter((r) => !r.bookingStatus).length;

  const filtered = useMemo(() => {
    if (filter !== "waiting") return rows;
    return rows.filter((r) => !r.bookingStatus);
  }, [rows, filter]);

  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:max-w-xs">
        <Stat label="Toplam dosya" value={rows.length} active={filter === "all"} onClick={() => toggle("all")} />
        <Stat label="Teklif bekleyen" value={waiting} tone="text-amber-300" active={filter === "waiting"} onClick={() => toggle("waiting")} />
      </div>

      <div className="mt-6 space-y-2.5">
        {rows.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[var(--c-hairline)] bg-[var(--c-panel)] py-12 text-center text-[var(--c-ink-3)]">
            <Inbox className="mx-auto mb-2" /> Henüz iletilmiş tedavi dosyası yok.
          </div>
        )}
        {rows.length > 0 && filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[var(--c-hairline)] bg-[var(--c-panel)] py-10 text-center text-sm text-[var(--c-ink-3)]">
            Bu filtrede dosya yok — sayıya yeniden tıklayarak tüm listeye dönebilirsiniz.
          </div>
        )}
        {filtered.map((r) => (
          <Link
            key={r.id}
            href={`/acente/dosya/${r.id}`}
            className="group flex items-center gap-4 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-4 transition hover:border-[var(--c-accent)]/40 hover:shadow-sm"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--c-accent)]/10 text-[var(--c-accent)] ring-1 ring-[var(--c-accent)]/20">
              <Luggage size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-[var(--c-ink)]">{r.patientName}</span>
                <span className="text-xs text-[var(--c-ink-3)]">{countryFlag(r.country)} {countryName(r.country)}</span>
                <span className="inline-flex items-center gap-1 text-xs text-[var(--c-ink-3)]"><Languages size={12} /> {r.language}</span>
                {r.bookingStatus ? (
                  r.bookingStatus === "DRAFT" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] font-semibold text-violet-300"><Send size={11} /> Teklif hastada</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300"><CheckCircle2 size={11} /> {r.bookingStatus === "CONFIRMED" ? "Onaylandı" : r.bookingStatus}</span>
                  )
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300"><Clock size={11} /> Teklif bekleniyor</span>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[var(--c-ink-2)]">
                <span className="font-medium text-[var(--c-accent-strong)]">{r.branch}</span>
                <span>· {r.procCount} işlem{r.totalTRY ? ` · ${formatTRY(r.totalTRY)}` : ""}</span>
                {r.daysMin != null && r.daysMax != null && (
                  <span className="inline-flex items-center gap-1"><CalendarRange size={12} /> {r.daysMin}–{r.daysMax} gün</span>
                )}
                {r.hospitalName && <span className="inline-flex items-center gap-1"><Building2 size={12} /> {r.hospitalName}</span>}
                {r.doctorName && <span>· {r.doctorName}</span>}
                {r.sentAt && <span className="text-[var(--c-ink-3)]">· iletildi: {formatDateTime(r.sentAt)}</span>}
              </div>
            </div>
            <ArrowRight size={18} className="hidden shrink-0 text-[var(--c-ink-3)] group-hover:text-[var(--c-accent)] sm:block" />
          </Link>
        ))}
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
