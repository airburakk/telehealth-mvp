import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { decryptField } from "@/lib/crypto";
import { countryFlag, countryName, formatDateTime } from "@/lib/constants";
import { formatTRY } from "@/lib/procedures";
import { Luggage, ArrowRight, Inbox, Languages, CalendarRange, Building2, Send, CheckCircle2, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

// S3 — Sağlık Turizmi Acentesi kuyruğu (FAZ 4, 2026-07-10).
// Doktorun tedavi kararını kaydettiği (agencySentAt damgalı) dosyalar burada listelenir; acente
// teklif hazırlayıp hastaya gönderir. VERİ MİNİMİZASYONU: liste ve dosyada yalnız kimlik/iletişim +
// doktorun kararı (işlem/ücret/süre/hastane) vardır — semptom, belge, görüntüleme, lab ASLA seçilmez
// (SELECT kısıtlı; klinik kolonlar sorguya girmez → decrypt bile edilmez).
export default async function AgencyQueue() {
  const user = await getCurrentUser();
  if (!user || !["AGENCY", "ADMIN"].includes(user.role)) notFound();

  const cases = await db.case.findMany({
    where: { agencySentAt: { not: null } },
    select: {
      id: true, patientName: true, country: true, language: true, branch: true,
      contactPreference: true, recommendedProcedures: true,
      treatmentDaysMin: true, treatmentDaysMax: true, hospitalName: true, agencySentAt: true,
      doctor: { select: { title: true, name: true } },
      bookings: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, status: true, total: true, currency: true } },
    },
    orderBy: { agencySentAt: "desc" },
    take: 100,
  });

  const rows = cases.map((c) => {
    let procs: { code: string; name: string; priceTRY: number }[] = [];
    try { procs = c.recommendedProcedures ? JSON.parse(c.recommendedProcedures) : []; } catch { procs = []; }
    const totalTRY = procs.reduce((a, p) => a + (p.priceTRY || 0), 0);
    const bk = c.bookings[0];
    return { c, procs, totalTRY, bk };
  });

  const waiting = rows.filter((r) => !r.bk).length;

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--c-accent)] text-[var(--c-bg)]"><Luggage size={22} /></span>
        <div>
          <h1 className="aura-display text-3xl font-medium tracking-tight text-[var(--c-ink)]">Tedavi Dosyaları</h1>
          <p className="text-sm text-[var(--c-ink-2)]">Doktorların ilettiği tedavi kararları — teklif hazırlayıp hastaya gönderin.</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:max-w-xs">
        <Stat label="Toplam dosya" value={rows.length} />
        <Stat label="Teklif bekleyen" value={waiting} tone="text-amber-300" />
      </div>

      <div className="mt-6 space-y-2.5">
        {rows.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[var(--c-hairline)] bg-[var(--c-panel)] py-12 text-center text-[var(--c-ink-3)]">
            <Inbox className="mx-auto mb-2" /> Henüz iletilmiş tedavi dosyası yok.
          </div>
        )}
        {rows.map(({ c, procs, totalTRY, bk }) => (
          <Link
            key={c.id}
            href={`/acente/dosya/${c.id}`}
            className="group flex items-center gap-4 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-4 transition hover:border-[var(--c-accent)]/40 hover:shadow-sm"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--c-accent)]/10 text-[var(--c-accent)] ring-1 ring-[var(--c-accent)]/20">
              <Luggage size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-[var(--c-ink)]">{decryptField(c.patientName)}</span>
                <span className="text-xs text-[var(--c-ink-3)]">{countryFlag(c.country)} {countryName(c.country)}</span>
                <span className="inline-flex items-center gap-1 text-xs text-[var(--c-ink-3)]"><Languages size={12} /> {c.language}</span>
                {bk ? (
                  bk.status === "DRAFT" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] font-semibold text-violet-300"><Send size={11} /> Teklif hastada</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300"><CheckCircle2 size={11} /> {bk.status === "CONFIRMED" ? "Onaylandı" : bk.status}</span>
                  )
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300"><Clock size={11} /> Teklif bekleniyor</span>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[var(--c-ink-2)]">
                <span className="font-medium text-[var(--c-accent-strong)]">{c.branch}</span>
                <span>· {procs.length} işlem{totalTRY ? ` · ${formatTRY(totalTRY)}` : ""}</span>
                {c.treatmentDaysMin != null && c.treatmentDaysMax != null && (
                  <span className="inline-flex items-center gap-1"><CalendarRange size={12} /> {c.treatmentDaysMin}–{c.treatmentDaysMax} gün</span>
                )}
                {c.hospitalName && <span className="inline-flex items-center gap-1"><Building2 size={12} /> {c.hospitalName}</span>}
                {c.doctor && <span>· {c.doctor.title} {c.doctor.name}</span>}
                {c.agencySentAt && <span className="text-[var(--c-ink-3)]">· iletildi: {formatDateTime(c.agencySentAt)}</span>}
              </div>
            </div>
            <ArrowRight size={18} className="hidden shrink-0 text-[var(--c-ink-3)] group-hover:text-[var(--c-accent)] sm:block" />
          </Link>
        ))}
      </div>

      <p className="mt-6 text-[11px] leading-relaxed text-[var(--c-ink-3)]">
        Veri minimizasyonu: acente panelinde yalnız hasta kimliği/iletişimi ve doktorun tedavi kararı
        (işlem · ücret · süre · hastane) görüntülenir. Tıbbi belge, görüntüleme, test sonucu ve şikâyet
        metni acenteyle paylaşılmaz.
      </p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-3.5">
      <div className={`text-2xl font-bold ${tone ?? "text-[var(--c-ink)]"}`}>{value}</div>
      <div className="text-xs text-[var(--c-ink-2)]">{label}</div>
    </div>
  );
}
