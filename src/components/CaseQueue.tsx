"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { urgencyStyle, CASE_STATUS, countryFlag, countryName, formatDateTime } from "@/lib/constants";
import { QUEUE_COUNTER_FILTERS, QUEUE_COUNTER_KEYS, type QueueCounterKey } from "@/lib/case-access";
import { QUEUE_COUNTERS } from "@/lib/doctor-home";
import { BranchAvatar } from "@/components/BranchAvatar";
import { Search, ArrowRight, Inbox, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from "lucide-react";

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

// Üst sayaçlar: HER dalda sunucuda count ile hesaplanır (kontrol raporu 2026-09-17 K09 — eskiden doktor
// dalında kesilmiş ilk 100 satırdan türetiliyordu; "Toplam" gerçek toplam değildi). Dört sayaç + kapsam alt
// yazısı (D02, v6.281): açık · işlem bekleyen · aktif acil (yalnız açık vakada) · arşiv — sözlük lib/doctor-home
// QUEUE_COUNTERS, filtre where'i lib/case-access QUEUE_COUNTER_FILTERS (tıklama aynı filtreyi URL'e yazar).
export type CaseQueueStats = Record<QueueCounterKey, number>;

// Sunucu-taraflı filtre/sıralama (İKİ dal, K09): rows yalnız görünür dilim olduğundan branş/durum/acil/sıralama
// URL parametresiyle sunucuya taşınır; branş seçenekleri kapsamın tam listesinden gelir. Metin araması ve kulvar
// çipleri sayfa içi (istemci) kalır — sunucu kapsamını GENİŞLETEMEZLER.
export interface CaseQueueServerFilters {
  branch: string; // "all" veya seçili branş
  status: string; // "all" veya seçili durum
  urgent: boolean; // "Acil (4-5)" stat filtresi — urgency>=4 SUNUCUDA uygulanır (2026-08-04)
  sort: "urgency" | "newest"; // aciliyet (varsayılan) · en yeni — sunucuda sıralanır
  branches: string[]; // tam branş listesi (sunucudan, distinct)
}

// Sayfalama gezintisi bileşenin içinde çizilir (liste kapalıyken görünmez — doktor dalı).
export interface CaseQueuePagination {
  page: number;
  totalPages: number;
  total: number;
  qs: string; // korunacak filtre parametreleri (&branch=…&status=…&urgent=1&sort=newest; URL-kodlu)
}

export function CaseQueue({
  rows,
  stats,
  serverFilters,
  startCollapsed = false,
  laneFilter = false,
  pagination,
}: {
  rows: CaseRow[];
  stats: CaseQueueStats;
  serverFilters: CaseQueueServerFilters;
  /** Doktor dalı (2026-07-31 kararı): liste varsayılan KAPALI — stat kartı / "göster" düğmesi açar. */
  startCollapsed?: boolean;
  /** 5'li kulvar çipleri (doktor dalı — SO/konsültasyon satırları kuyruğa katılır). */
  laneFilter?: boolean;
  pagination?: CaseQueuePagination;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [lane, setLane] = useState<"all" | QueueLane>("all");
  const [q, setQ] = useState("");
  // Kapalı başlangıçta liste; URL'de filtre/sıralama/2+. sayfa varsa (sunucu filtresi tıklandı) açık kalır.
  const [opened, setOpened] = useState(false);
  const hasUrlFilter =
    serverFilters.branch !== "all" || serverFilters.status !== "all" || serverFilters.urgent ||
    serverFilters.sort !== "urgency" || (pagination?.page ?? 1) > 1;
  const listOpen = !startCollapsed || opened || hasUrlFilter;

  // Filtre değişimi → URL parametresi (page=1'e dönerek); liste sunucudan yenilenir ve açılır.
  const pushServerFilters = (next: Partial<Pick<CaseQueueServerFilters, "branch" | "status" | "urgent" | "sort">>) => {
    const f = { ...serverFilters, ...next };
    const p = new URLSearchParams();
    p.set("page", "1");
    if (f.branch !== "all") p.set("branch", f.branch);
    if (f.status !== "all") p.set("status", f.status);
    if (f.urgent) p.set("urgent", "1");
    if (f.sort === "newest") p.set("sort", "newest");
    setOpened(true);
    router.push(`${pathname}?${p.toString()}`);
  };

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (lane === "all" || r.lane === lane) &&
          (q === "" || r.patientName.toLocaleLowerCase("tr").includes(q.toLocaleLowerCase("tr"))),
      ),
    [rows, lane, q],
  );

  // Stat tıklaması (2026-08-04 modeli): sayılar tam kümeden geldiği için tıklama da tam kümeye döner —
  // branş SIFIRLANIP sayacın kendi filtresi (QUEUE_COUNTER_FILTERS — sayımla AYNI where) URL'e yazılır; aktifken
  // ikinci tıklama kapatır. Listeyi filtresiz açmak için ayrı aç/kapat düğmesi var (startCollapsed).
  const counterActive = (key: QueueCounterKey) => {
    const f = QUEUE_COUNTER_FILTERS[key];
    return serverFilters.branch === "all" && serverFilters.status === (f.status ?? "all") && serverFilters.urgent === !!f.urgent;
  };
  const toggleStat = (key: QueueCounterKey) => {
    const f = QUEUE_COUNTER_FILTERS[key];
    pushServerFilters(
      counterActive(key)
        ? { branch: "all", status: "all", urgent: false }
        : { branch: "all", status: f.status ?? "all", urgent: !!f.urgent },
    );
  };
  const toggleList = () => {
    if (listOpen) {
      setOpened(false);
      if (hasUrlFilter) router.push(pathname); // URL filtresi listeyi açık tutar → temizle
    } else {
      setOpened(true);
    }
  };
  const pageHref = (p: number) => `${pathname}?page=${p}${pagination?.qs ?? ""}`;

  return (
    <div>
      {/* Stats — tıklanabilir (2026-08-04): sunucu filtresini URL'e yazar; kapalı başlangıçta listeyi de açar. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {QUEUE_COUNTER_KEYS.map((key) => (
          <Stat
            key={key}
            label={QUEUE_COUNTERS[key].label}
            caption={QUEUE_COUNTERS[key].caption}
            value={stats[key]}
            tone={QUEUE_COUNTERS[key].tone}
            interactive
            active={counterActive(key)}
            onClick={() => toggleStat(key)}
          />
        ))}
      </div>
      {/* Tek-tuş aç/kapat (2026-07-31, kullanıcı isteği): tüm listeyi filtresiz açar; sayaçlar
          ayrıca kendi stat filtresiyle açmaya devam eder. Kapalıyken kutu + metin aura mavisi
          ışımayla çağırır (2026-08-16 kullanıcı kararı; .queue-reveal-glow globals.css) —
          liste açılınca söner (v6.98 profil-chevron istisnasıyla aynı sınıf). */}
      {startCollapsed && (
        <button
          type="button"
          onClick={toggleList}
          aria-expanded={listOpen}
          className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border bg-[var(--c-panel)] px-4 py-2.5 text-sm font-semibold transition ${
            listOpen
              ? "border-[var(--c-hairline)] text-[var(--c-ink-2)] hover:border-[var(--c-accent)]/40 hover:text-[var(--c-ink)]"
              : "queue-reveal-glow"
          }`}
        >
          {listOpen ? (
            <>Listeyi gizle <ChevronUp size={15} /></>
          ) : (
            <>Tüm eşleşen vakaları göster <ChevronDown size={15} /></>
          )}
        </button>
      )}

      {listOpen && (
        <>
          {/* Filters — branş/durum/sıralama sunucuda (URL); metin araması bu sayfada */}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--c-ink-3)]" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Bu sayfada ara…"
                aria-label="Bu sayfada hasta adına göre ara"
                className="rounded-lg border border-[var(--c-hairline)] bg-[var(--c-panel)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--c-accent)]"
              />
            </div>
            <select value={serverFilters.branch} onChange={(e) => pushServerFilters({ branch: e.target.value })} aria-label="Branşa göre filtrele" className="rounded-lg border border-[var(--c-hairline)] bg-[var(--c-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--c-accent)]">
              <option value="all">Tüm branşlar</option>
              {serverFilters.branches.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <select value={serverFilters.status} onChange={(e) => pushServerFilters({ status: e.target.value })} aria-label="Duruma göre filtrele" className="rounded-lg border border-[var(--c-hairline)] bg-[var(--c-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--c-accent)]">
              <option value="all">Tüm durumlar</option>
              {/* Sözde durumlar — sayaçlarla aynı küme (lib/case-access statusFilterWhere) */}
              <option value="open">Açık (arşiv hariç)</option>
              <option value="pending">İşlem bekleyen (yeni + incelemede)</option>
              {Object.entries(CASE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            {/* Sıralama — aciliyet varsayılan, "en yeni" sisteme düşme zamanı (sunucuda; sayfalı dilimde istemci sıralaması yanıltırdı) */}
            <select value={serverFilters.sort} onChange={(e) => pushServerFilters({ sort: e.target.value === "newest" ? "newest" : "urgency" })} aria-label="Sıralama" className="rounded-lg border border-[var(--c-hairline)] bg-[var(--c-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--c-accent)]">
              <option value="urgency">Sırala: Aciliyet</option>
              <option value="newest">Sırala: En yeni</option>
            </select>
          </div>

          {/* Kulvar çipleri (doktor dalı) — 5'li yol filtresi; sayfa içi */}
          {laneFilter && (
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

          {/* Sayfalama — /denetim deseni; İKİ dalda (K09). Liste açıkken çizilir. */}
          {pagination && pagination.totalPages > 1 && (
            <nav className="mt-5 flex flex-wrap items-center justify-between gap-3" aria-label="Vaka kuyruğu sayfaları">
              <span className="text-xs text-[var(--c-ink-2)]">
                Toplam <strong className="text-[var(--c-ink)]">{pagination.total}</strong> vaka · Sayfa{" "}
                <strong className="text-[var(--c-ink)]">{pagination.page}</strong> / {pagination.totalPages}
              </span>
              <div className="flex items-center gap-2">
                {pagination.page > 1 ? (
                  <Link href={pageHref(pagination.page - 1)} className="inline-flex items-center gap-1 rounded-lg border border-[var(--c-hairline)] px-3 py-1.5 text-sm font-medium text-[var(--c-ink-2)] hover:bg-[var(--c-surface)]">
                    <ChevronLeft size={15} /> Önceki
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-[var(--c-hairline)] px-3 py-1.5 text-sm font-medium text-[var(--c-ink-3)] cursor-not-allowed">
                    <ChevronLeft size={15} /> Önceki
                  </span>
                )}
                {pagination.page < pagination.totalPages ? (
                  <Link href={pageHref(pagination.page + 1)} className="inline-flex items-center gap-1 rounded-lg border border-[var(--c-hairline)] px-3 py-1.5 text-sm font-medium text-[var(--c-ink-2)] hover:bg-[var(--c-surface)]">
                    Sonraki <ChevronRight size={15} />
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-[var(--c-hairline)] px-3 py-1.5 text-sm font-medium text-[var(--c-ink-3)] cursor-not-allowed">
                    Sonraki <ChevronRight size={15} />
                  </span>
                )}
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  caption,
  value,
  tone,
  interactive,
  active,
  onClick,
}: {
  label: string;
  /** Sayacın KAPSAMI (D02): hangi kümeyi saydığı alt yazıda — sayı tek başına iş önceliği izlenimi vermesin. */
  caption?: string;
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
      {caption && <div className="mt-0.5 text-[10px] leading-snug text-[var(--c-ink-3)]">{caption}</div>}
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
