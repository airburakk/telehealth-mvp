"use client";

// Post-Op İzleme — aktif takip listesi + TIKLANIR KPI filtreleri (v6.66, kullanıcı isteği).
// Desen: doktor ana sayfası "Eşleşen Vakalar" (CaseQueue) stat filtresiyle AYNI — sayıya
// tıklayınca altta o kümenin satırları listelenir, tekrar tıklayınca filtre kapanır.
// Veri server page.tsx'te hazırlanır (decryptField SUNUCUDA kalır — ad çözümü client'a inmez);
// burada yalnız sunum + filtre durumu yaşar.
import { useMemo, useState } from "react";
import Link from "next/link";
import { severityMeta, painSeverity, feverSeverity, type Severity } from "@/lib/postop";
import { countryFlag, countryName, formatDateTime } from "@/lib/constants";
import { BranchAvatar } from "@/components/BranchAvatar";
import { CompleteRecoveryButton } from "@/components/CompleteRecoveryButton";
import { HeartPulse, Activity, Thermometer, ArrowRight, AlertTriangle, Inbox, ChevronDown } from "lucide-react";

export interface ActiveRecoveryRow {
  id: string;
  caseId: string;
  branch: string;
  patientName: string; // sunucuda çözülmüş
  country: string;
  day: number;
  count: number;
  severity: Severity;
  last: { pain: number; feverC: number; createdAt: string } | null; // ISO
}

type FilterKey = "all" | "WATCH" | "RED";

export function RecoveryList({ rows }: { rows: ActiveRecoveryRow[] }) {
  // CaseQueue deseni: aynı sayıya ikinci tıklama filtreyi kapatır (null → tümü).
  const [filter, setFilter] = useState<FilterKey | null>(null);
  const toggle = (key: FilterKey) => setFilter((cur) => (cur === key ? null : key));

  const watchCount = rows.filter((r) => r.severity === "WATCH").length;
  const redCount = rows.filter((r) => r.severity === "RED").length;

  const filtered = useMemo(() => {
    if (!filter || filter === "all") return rows;
    return rows.filter((r) => r.severity === filter);
  }, [rows, filter]);

  return (
    <>
      {/* KPI'lar tıklanır (v6.66): sayıya basınca alttaki liste o kümeye süzülür. Tonlar
          tema-duyarlı token'lardan (v6.64). */}
      <div className="mt-6 grid grid-cols-3 gap-3 sm:max-w-md">
        <Stat label="Aktif takip" value={rows.length} active={filter === "all"} onClick={() => toggle("all")} />
        <Stat label="Yakın izlem" value={watchCount} tone="text-[var(--c-warning)]" active={filter === "WATCH"} onClick={() => toggle("WATCH")} />
        <Stat label="Alarm bulgusu" value={redCount} tone="text-[var(--c-danger)]" active={filter === "RED"} onClick={() => toggle("RED")} />
      </div>

      <div className="mt-6 space-y-2.5">
        {rows.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[var(--c-hairline)] bg-[var(--c-panel)] py-12 text-center text-[var(--c-ink-3)]">
            <Inbox className="mx-auto mb-2" /> Aktif takipte hasta yok.
          </div>
        )}
        {rows.length > 0 && filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[var(--c-hairline)] bg-[var(--c-panel)] py-10 text-center text-sm text-[var(--c-ink-3)]">
            Bu filtrede hasta yok — sayıya yeniden tıklayarak tüm listeye dönebilirsiniz.
          </div>
        )}
        {filtered.map((r) => {
          const m = severityMeta(r.severity);
          return (
            /* Kart anatomisi /vakalarim CaseCard ile birebir (v6.64); 45° durum alanı + vital
               kutucukları (v6.65). Detaylı gerekçeler changelog v6.64-65'te. */
            <article
              key={r.id}
              className={`group relative overflow-hidden rounded-2xl border bg-[var(--c-panel)] p-5 transition ${r.severity === "RED" ? "border-[var(--c-danger)]/25" : "border-[var(--c-hairline)] hover:border-[var(--c-accent)]/30"}`}
              style={{ borderInlineStart: "3px solid var(--lane-tourism)" }}
            >
              {/* 45° durum alanı: üst kenarda sağdan %15'te başlar (30→25→20→15; kullanıcı ayarı),
                  kesik tam 45° (globals .postop-slant, skewX); şiddete göre yeşil/sarı/kırmızı,
                  RED'de Doctorium temposuyla parlar. */}
              <span
                aria-hidden
                className={`postop-slant pointer-events-none absolute inset-y-0 ${r.severity === "RED" ? "postop-alert-aura" : "opacity-[0.15]"}`}
                style={{ insetInlineEnd: "-320px", width: "calc(15% + 320px)", background: m.tone }}
              />
              <div className="relative">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <BranchAvatar branchKey={r.branch} size={24} />
                    <span className="aura-display min-w-0 truncate text-[16px] font-medium tracking-tight text-[var(--c-ink)]">
                      {r.branch}
                    </span>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${m.badge}`}>
                    {r.severity === "RED" ? <AlertTriangle size={12} /> : <HeartPulse size={12} />}
                    {m.label}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--c-ink-3)]">
                  <span className="font-medium text-[var(--c-ink-2)]">{r.patientName}</span>
                  <span>{countryFlag(r.country)} {countryName(r.country)}</span>
                  <span>· {r.day}. gün</span>
                  <span>· {r.count} kontrol</span>
                </div>

                {/* Vital kutucukları ("pencere içinde pencere", v6.65): renk eşikleri alarm
                    hesabıyla TEK KAYNAK (painSeverity/feverSeverity). */}
                {r.last ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <VitalTile icon={<Activity size={13} />} label="Ağrı" value={`${r.last.pain}/10`} sev={painSeverity(r.last.pain)} />
                    <VitalTile icon={<Thermometer size={13} />} label="Ateş" value={`${r.last.feverC.toFixed(1)}°C`} sev={feverSeverity(r.last.feverC)} />
                    <span className="text-xs text-[var(--c-ink-3)]">son: {formatDateTime(r.last.createdAt)}</span>
                  </div>
                ) : (
                  <p className="mt-2 text-sm leading-relaxed text-[var(--c-ink-3)]">Henüz kontrol girilmedi.</p>
                )}

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--c-hairline)] pt-3">
                  <span className="aura-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "var(--lane-tourism)" }}>
                    Post-Op Takip
                  </span>
                  <div className="flex items-center gap-3">
                    <CompleteRecoveryButton caseId={r.caseId} />
                    <Link
                      href={`/takip/${r.caseId}`}
                      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--c-accent)] transition-colors duration-200 hover:text-[var(--c-accent-2)]"
                    >
                      Takibi aç <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              </div>
            </article>
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

/** Vital kutucuğu — mono etiket + Inter bold değer (kit stat deseni, DESIGN.md veri kuralı). */
function VitalTile({ icon, label, value, sev }: { icon: React.ReactNode; label: string; value: string; sev: Severity }) {
  const toneClass =
    sev === "RED" ? "text-[var(--c-danger)]" : sev === "WATCH" ? "text-[var(--c-warning)]" : "text-[var(--c-ink)]";
  return (
    <span className="inline-flex items-center gap-2 rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)]/60 px-3 py-1.5">
      <span className="inline-flex items-center gap-1 aura-mono text-[10px] uppercase tracking-[0.2em] text-[var(--c-ink-3)]">
        {icon} {label}
      </span>
      <span className={`text-sm font-bold tabular-nums ${toneClass}`}>{value}</span>
    </span>
  );
}
