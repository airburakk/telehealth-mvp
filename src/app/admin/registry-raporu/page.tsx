import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/constants";
import { ClipboardList, UserRound, Building2, TrendingUp, TrendingDown, AlertTriangle, Inbox } from "lucide-react";

export const dynamic = "force-dynamic";

interface DocRow { id: number; name: string; lastName: string; branchName: string | null; cityName: string | null; establishmentName: string | null }
interface HospRow { id: number; name: string; cityName: string | null; facilityTypeName: string | null }

function parse<T>(s: string | null): T[] {
  if (!s) return [];
  try { const v = JSON.parse(s); return Array.isArray(v) ? (v as T[]) : []; } catch { return []; }
}

// FAZ 6 — HealthTürkiye günlük değişiklik raporları (ADMIN/Etik Kurul; proxy /admin zaten kapıyor,
// sayfa kendi savunmasını da yapar). Cron her gün doktor+tesis dizinini senkronlar; eklenen/çıkarılan
// kayıtlar burada gün gün listelenir (kullanıcı talebi: günlük rapor + ayrı tabloda kalıcı saklama).
export default async function RegistryReportPage() {
  const user = await getCurrentUser();
  if (!user || !["ADMIN", "ETHICS"].includes(user.role)) notFound();

  const [reports, activeDoctors, activeHospitals] = await Promise.all([
    db.registryReport.findMany({ orderBy: { date: "desc" }, take: 30 }),
    db.registryDoctor.count({ where: { removedAt: null } }),
    db.registryHospital.count({ where: { removedAt: null } }),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--c-accent)] text-[var(--c-bg)]"><ClipboardList size={22} /></span>
        <div>
          <h1 className="text-2xl font-bold text-[var(--c-ink)]">HealthTürkiye Günlük Raporları</h1>
          <p className="text-sm text-[var(--c-ink-2)]">healthturkiye.gov.tr doktor + tesis dizini — 24 saatte bir senkron, eklenen/çıkarılan kayıtlar.</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:max-w-md">
        <Stat icon={<UserRound size={16} />} label="Kayıtlı doktor (aktif)" value={activeDoctors} />
        <Stat icon={<Building2 size={16} />} label="Kayıtlı tesis (aktif)" value={activeHospitals} />
      </div>

      {reports.length === 0 && (
        <div className="mt-8 rounded-3xl border border-dashed border-[var(--c-hairline)] bg-[var(--c-panel)] py-12 text-center text-[var(--c-ink-3)]">
          <Inbox className="mx-auto mb-2" /> Henüz senkron raporu yok — ilk çekim <code>scripts/registry-sync.ts</code> veya günlük cron ile oluşur.
        </div>
      )}

      <div className="mt-6 space-y-4">
        {reports.map((r) => {
          const ad = parse<DocRow>(r.addedDoctors);
          const rd = parse<DocRow>(r.removedDoctors);
          const ah = parse<HospRow>(r.addedHospitals);
          const rh = parse<HospRow>(r.removedHospitals);
          const updates = (r.updatedDoctors ?? 0) + (r.updatedHospitals ?? 0); // alan-güncellemesi (v5.4)
          const changes = ad.length + rd.length + ah.length + rh.length + updates;
          // JSON listeleri 500'le sınırlı saklanır (ilk tam çekim şişmesin) → rozette "+" ile belirt
          const capped = (r.detail ?? "").includes("(ilk 500");
          return (
            <div key={r.id} className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-[var(--c-ink)]">{r.date}</span>
                  {r.status === "OK" ? (
                    changes === 0 ? (
                      <span className="rounded-full bg-[var(--c-ink)]/10 px-2.5 py-0.5 text-[11px] font-medium text-[var(--c-ink-2)]">değişiklik yok</span>
                    ) : (
                      <span className="rounded-full bg-[var(--c-accent)]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[var(--c-accent)] ring-1 ring-[var(--c-accent)]/25">{changes}{capped ? "+" : ""} değişiklik</span>
                    )
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-red-300 ring-1 ring-red-400/25"><AlertTriangle size={11} /> {r.status}</span>
                  )}
                </div>
                <span className="text-xs text-[var(--c-ink-3)]">
                  {r.doctorsTotal.toLocaleString("tr-TR")} doktor · {r.hospitalsTotal.toLocaleString("tr-TR")} tesis
                  {updates > 0 && <span className="text-sky-300"> · ✎ {r.updatedDoctors} doktor / {r.updatedHospitals} tesis güncellendi</span>}
                  {" · "}{formatDateTime(r.createdAt)}
                </span>
              </div>
              {r.detail && <p className="mt-2 rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300 ring-1 ring-amber-400/20">{r.detail}</p>}

              {changes > 0 && (
                <div className="mt-3 grid gap-3 border-t border-[var(--c-hairline)] pt-3 sm:grid-cols-2">
                  <ChangeList icon={<TrendingUp size={13} />} tone="text-emerald-300" title={`Eklenen doktor (${ad.length})`}
                    rows={ad.map((d) => `${d.name} ${d.lastName} — ${d.branchName ?? "?"}${d.establishmentName ? " · " + d.establishmentName : ""}${d.cityName ? " · " + d.cityName : ""}`)} />
                  <ChangeList icon={<TrendingDown size={13} />} tone="text-red-300" title={`Çıkarılan doktor (${rd.length})`}
                    rows={rd.map((d) => `${d.name} ${d.lastName} — ${d.branchName ?? "?"}${d.establishmentName ? " · " + d.establishmentName : ""}`)} />
                  <ChangeList icon={<TrendingUp size={13} />} tone="text-emerald-300" title={`Eklenen tesis (${ah.length})`}
                    rows={ah.map((h) => `${h.name}${h.cityName ? " · " + h.cityName : ""}${h.facilityTypeName ? " · " + h.facilityTypeName : ""}`)} />
                  <ChangeList icon={<TrendingDown size={13} />} tone="text-red-300" title={`Çıkarılan tesis (${rh.length})`}
                    rows={rh.map((h) => `${h.name}${h.cityName ? " · " + h.cityName : ""}`)} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-3.5">
      <div className="flex items-center gap-1.5 text-2xl font-bold text-[var(--c-ink)]">{icon} {value.toLocaleString("tr-TR")}</div>
      <div className="text-xs text-[var(--c-ink-2)]">{label}</div>
    </div>
  );
}

function ChangeList({ icon, tone, title, rows }: { icon: React.ReactNode; tone: string; title: string; rows: string[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)]/60 p-3">
      <div className={`flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide ${tone}`}>{icon} {title}</div>
      <ul className="mt-1.5 max-h-48 space-y-0.5 overflow-y-auto text-xs text-[var(--c-ink-2)]">
        {rows.slice(0, 100).map((t, i) => <li key={i} className="truncate">• {t}</li>)}
        {rows.length > 100 && <li className="text-[var(--c-ink-3)]">… ve {rows.length - 100} kayıt daha</li>}
      </ul>
    </div>
  );
}
