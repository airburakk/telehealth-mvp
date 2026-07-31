"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { urgencyStyle, CASE_STATUS, countryFlag, countryName, formatDateTime } from "@/lib/constants";
import { BranchAvatar } from "@/components/BranchAvatar";
import { Search, ArrowRight, Inbox, ChevronDown } from "lucide-react";

// 5 kulvar (2026-07-31 birleşik liste): Case satırları (telehealth/tourism/free) + İkinci Görüş +
// Konsültasyon Talebi. Renkler tema-duyarlı --lane-* token'larından (v6.22 renk disiplini:
// kulvar rengi yüzey boyamaz — 3px kenar şeridi + mono etiket; hasta kartıyla aynı dil).
export type QueueLane = "telehealth" | "tourism" | "so" | "free" | "consult";

const LANES: Record<QueueLane, { name: string; accent: string }> = {
  telehealth: { name: "Uzaktan Sağlık", accent: "var(--lane-telehealth)" },
  tourism: { name: "Sağlık Turizmi", accent: "var(--lane-tourism)" },
  so: { name: "İkinci Görüş", accent: "var(--lane-so)" },
  free: { name: "Ücretsiz Sağlık Hizmeti", accent: "var(--lane-free)" },
  consult: { name: "Konsültasyon Talebi", accent: "var(--lane-consult)" },
};
const LANE_ORDER: QueueLane[] = ["telehealth", "tourism", "so", "free", "consult"];

export interface CaseRow {
  id: string;
  lane: QueueLane;
  href: string; // satır hedefi kulvara göre değişir (vaka / ikinci görüş / konsültasyon havuzu)
  patientName: string; // SO claim-öncesi "Anonim hasta", konsültasyonda "Anonim talep"
  country: string | null;
  branch: string; // LABEL (SO'da server'da KEY→label çevrilir)
  urgency: number | null; // İkinci Görüş dosyasında aciliyet kavramı yok
  status: string; // ham durum anahtarı (durum filtresi CASE_STATUS anahtarlarıyla eşleşir)
  statusLabel: string; // gösterim etiketi (server'da hazır — SO/consult kendi sözlüğünden)
  statusDot: string; // tema-duyarlı durum noktası rengi (var(--c-*))
  createdAt: string;
  doctorName: string | null;
  hasFiles: boolean;
}

// Üst istatistikler: sayfalı (personel) görünümde rows yalnız görünür dilim olduğundan
// server'da count ile hesaplanıp `stats` prop'uyla geçilir; verilmezse rows'tan türetilir (doktor dalı).
export interface CaseQueueStats {
  total: number;
  waiting: number;
  urgent: number;
}

// Sunucu-taraflı filtre modu (personel/sayfalı görünüm): rows yalnız görünür dilim olduğundan
// branş/durum filtresi URL parametresiyle sunucuya taşınır; branş seçenekleri tam listeden gelir.
// Prop verilmezse mevcut istemci-taraflı filtre davranışı birebir korunur (doktor dalı).
export interface CaseQueueServerFilters {
  branch: string; // "all" veya seçili branş
  status: string; // "all" veya seçili durum
  branches: string[]; // tam branş listesi (sunucudan, distinct)
}

type StatKey = "total" | "waiting" | "urgent";

export function CaseQueue({ rows, stats, serverFilters }: { rows: CaseRow[]; stats?: CaseQueueStats; serverFilters?: CaseQueueServerFilters }) {
  const router = useRouter();
  const pathname = usePathname();
  const [branch, setBranch] = useState("all");
  const [status, setStatus] = useState("all");
  const [lane, setLane] = useState<"all" | QueueLane>("all");
  const [sortMode, setSortMode] = useState<"urgency" | "newest">("urgency");
  const [q, setQ] = useState("");
  // Doktor dalı (2026-07-31): liste varsayılan KAPALI — stat kartına tıklayınca açılır ve o stat'a
  // göre filtreler (Toplam=tümü · Bekleyen=NEW · Acil=4-5). Personel dalında liste hep açık.
  const [openStat, setOpenStat] = useState<StatKey | null>(null);
  const listOpen = serverFilters ? true : openStat !== null;

  // Sunucu modunda seçim değeri URL'den (props) gelir; istemci modunda local state.
  const branchValue = serverFilters ? serverFilters.branch : branch;
  const statusValue = serverFilters ? serverFilters.status : status;

  const localBranches = useMemo(() => Array.from(new Set(rows.map((r) => r.branch))).sort(), [rows]);
  const branches = serverFilters ? serverFilters.branches : localBranches;

  // Sunucu modunda filtre değişimi → URL parametresi (page=1'e dönerek); liste sunucudan yenilenir.
  const pushServerFilters = (nextBranch: string, nextStatus: string) => {
    const p = new URLSearchParams();
    p.set("page", "1");
    if (nextBranch !== "all") p.set("branch", nextBranch);
    if (nextStatus !== "all") p.set("status", nextStatus);
    router.push(`${pathname}?${p.toString()}`);
  };
  const onBranchChange = (v: string) => (serverFilters ? pushServerFilters(v, statusValue) : setBranch(v));
  const onStatusChange = (v: string) => (serverFilters ? pushServerFilters(branchValue, v) : setStatus(v));

  const filtered = useMemo(() => {
    const base = rows.filter(
      (r) =>
        // Sunucu modunda branş/durum zaten sunucuda uygulandı → yalnız metin araması (bu sayfada).
        (!!serverFilters || branch === "all" || r.branch === branch) &&
        (!!serverFilters || status === "all" || r.status === status) &&
        (!!serverFilters || lane === "all" || r.lane === lane) &&
        // Stat filtresi (doktor dalı): Bekleyen=NEW (yalnız case satırlarında bulunur) · Acil=4-5.
        (!!serverFilters || openStat !== "waiting" || r.status === "NEW") &&
        (!!serverFilters || openStat !== "urgent" || (r.urgency ?? 0) >= 4) &&
        (q === "" || r.patientName.toLocaleLowerCase("tr").includes(q.toLocaleLowerCase("tr")))
    );
    // Doktor dalında sıralama seçici; personel dalı server sırasını korur (sayfalı dilim).
    if (!serverFilters) {
      base.sort((a, b) =>
        sortMode === "newest"
          ? b.createdAt.localeCompare(a.createdAt)
          : (b.urgency ?? -1) - (a.urgency ?? -1) || b.createdAt.localeCompare(a.createdAt)
      );
    }
    return base;
  }, [rows, branch, status, lane, sortMode, q, serverFilters, openStat]);

  const total = stats?.total ?? rows.length;
  const urgent = stats?.urgent ?? rows.filter((r) => (r.urgency ?? 0) >= 4).length;
  const waiting = stats?.waiting ?? rows.filter((r) => r.status === "NEW").length;

  const toggleStat = (key: StatKey) => setOpenStat((cur) => (cur === key ? null : key));

  return (
    <div>
      {/* Stats — doktor dalında tıklanabilir: listeyi açar + stat'a göre filtreler */}
      <div className="grid grid-cols-3 gap-3 sm:max-w-md">
        <Stat label="Toplam vaka" value={total} interactive={!serverFilters} active={openStat === "total"} onClick={() => toggleStat("total")} />
        <Stat label="Bekleyen" value={waiting} tone="text-blue-300" interactive={!serverFilters} active={openStat === "waiting"} onClick={() => toggleStat("waiting")} />
        <Stat label="Acil (4-5)" value={urgent} tone="text-red-300" interactive={!serverFilters} active={openStat === "urgent"} onClick={() => toggleStat("urgent")} />
      </div>
      {!serverFilters && !listOpen && (
        <p className="mt-3 text-xs text-[var(--c-ink-3)]">Listeyi görmek için yukarıdaki sayaçlardan birine tıklayın.</p>
      )}

      {listOpen && (
        <>
          {/* Filters */}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--c-ink-3)]" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={serverFilters ? "Bu sayfada ara…" : "Hasta ara…"}
                className="rounded-lg border border-[var(--c-hairline)] bg-[var(--c-panel)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--c-accent)]"
              />
            </div>
            <select value={branchValue} onChange={(e) => onBranchChange(e.target.value)} aria-label="Branşa göre filtrele" className="rounded-lg border border-[var(--c-hairline)] bg-[var(--c-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--c-accent)]">
              <option value="all">Tüm branşlar</option>
              {branches.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <select value={statusValue} onChange={(e) => onStatusChange(e.target.value)} aria-label="Duruma göre filtrele" className="rounded-lg border border-[var(--c-hairline)] bg-[var(--c-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--c-accent)]">
              <option value="all">Tüm durumlar</option>
              {Object.entries(CASE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            {/* Sıralama (yalnız doktor dalı) — aciliyet varsayılan, "en yeni" sisteme düşme zamanı */}
            {!serverFilters && (
              <select value={sortMode} onChange={(e) => setSortMode(e.target.value as "urgency" | "newest")} aria-label="Sıralama" className="rounded-lg border border-[var(--c-hairline)] bg-[var(--c-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--c-accent)]">
                <option value="urgency">Sırala: Aciliyet</option>
                <option value="newest">Sırala: En yeni</option>
              </select>
            )}
          </div>

          {/* Kulvar çipleri (yalnız doktor dalı) — 5'li yol filtresi */}
          {!serverFilters && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Kulvara göre filtrele">
              <button
                onClick={() => setLane("all")}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${lane === "all" ? "border-[var(--c-accent)] bg-[var(--c-accent)]/[0.08] text-[var(--c-ink)]" : "border-[var(--c-hairline)] text-[var(--c-ink-2)] hover:bg-[var(--c-surface)]"}`}
              >
                Tümü
              </button>
              {LANE_ORDER.map((k) => {
                const L = LANES[k];
                const active = lane === k;
                return (
                  <button
                    key={k}
                    onClick={() => setLane(active ? "all" : k)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${active ? "bg-[var(--c-surface)] text-[var(--c-ink)]" : "border-[var(--c-hairline)] text-[var(--c-ink-2)] hover:bg-[var(--c-surface)]"}`}
                    style={active ? { borderColor: L.accent } : undefined}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: L.accent }} /> {L.name}
                  </button>
                );
              })}
            </div>
          )}

          {/* List — sakin kulvar kartı (hasta /vakalarim GlassCase deseni; doktor bilgileri korunur) */}
          <div className="mt-4 space-y-2.5">
            {filtered.length === 0 && (
              <div className="rounded-2xl border border-dashed border-[var(--c-hairline)] bg-[var(--c-panel)] py-12 text-center text-[var(--c-ink-3)]">
                <Inbox className="mx-auto mb-2" /> Eşleşen vaka yok.
              </div>
            )}
            {filtered.map((r) => {
              const L = LANES[r.lane];
              const u = r.urgency != null ? urgencyStyle(r.urgency) : null;
              return (
                <Link
                  key={`${r.lane}-${r.id}`}
                  href={r.href}
                  className="group block rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-4 transition hover:border-[var(--c-accent)]/30 hover:shadow-sm"
                  style={{ borderInlineStart: `3px solid ${L.accent}` }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <BranchAvatar branchKey={r.branch} size={24} />
                      <span className="aura-display min-w-0 truncate text-[16px] font-medium tracking-tight text-[var(--c-ink)]">{r.branch}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {u && (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${u.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${u.dot}`} /> {r.urgency}/5
                        </span>
                      )}
                      <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-[var(--c-hairline)] bg-[var(--c-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--c-ink-2)]">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: r.statusDot }} /> {r.statusLabel}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--c-ink-3)]">
                    <span className="font-medium text-[var(--c-ink-2)]">{r.patientName}</span>
                    {r.country && <span>{countryFlag(r.country)} {countryName(r.country)}</span>}
                    <span>{formatDateTime(r.createdAt)}</span>
                    {r.hasFiles && <span className="rounded bg-[var(--c-ink)]/10 px-1.5 py-0.5 text-[10px] text-[var(--c-ink-2)]">📎 dosya</span>}
                    {r.doctorName && <span>· {r.doctorName}</span>}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--c-hairline)] pt-2.5">
                    <span className="aura-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: L.accent }}>{L.name}</span>
                    <ArrowRight size={15} className="shrink-0 text-[var(--c-ink-3)] transition group-hover:translate-x-0.5 group-hover:text-[var(--c-accent-strong)]" />
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  interactive,
  active,
  onClick,
}: {
  label: string;
  value: number;
  tone?: string;
  interactive?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <div className={`text-2xl font-bold ${tone ?? "text-[var(--c-ink)]"}`}>{value}</div>
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs text-[var(--c-ink-2)]">{label}</span>
        {interactive && (
          <ChevronDown size={13} className={`shrink-0 text-[var(--c-ink-3)] transition-transform ${active ? "rotate-180" : ""}`} />
        )}
      </div>
    </>
  );
  if (!interactive) {
    return <div className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-3.5">{inner}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={!!active}
      className={`rounded-2xl border p-3.5 text-left transition ${active ? "border-[var(--c-accent)] bg-[var(--c-accent)]/[0.06]" : "border-[var(--c-hairline)] bg-[var(--c-panel)] hover:border-[var(--c-accent)]/40"}`}
    >
      {inner}
    </button>
  );
}
