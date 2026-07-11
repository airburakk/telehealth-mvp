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
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#28C8D8] text-[#0D0E10]"><Luggage size={22} /></span>
        <div>
          <h1 className="text-2xl font-bold text-[#F4F5F3]">Tedavi Dosyaları</h1>
          <p className="text-sm text-white/50">Doktorların ilettiği tedavi kararları — teklif hazırlayıp hastaya gönderin.</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:max-w-xs">
        <Stat label="Toplam dosya" value={rows.length} />
        <Stat label="Teklif bekleyen" value={waiting} tone="text-amber-300" />
      </div>

      <div className="mt-6 space-y-2.5">
        {rows.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/15 bg-[#161719] py-12 text-center text-white/40">
            <Inbox className="mx-auto mb-2" /> Henüz iletilmiş tedavi dosyası yok.
          </div>
        )}
        {rows.map(({ c, procs, totalTRY, bk }) => (
          <Link
            key={c.id}
            href={`/acente/dosya/${c.id}`}
            className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-[#161719] p-4 transition hover:border-[#28C8D8]/40 hover:shadow-sm"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#28C8D8]/10 text-[#28C8D8] ring-1 ring-[#28C8D8]/20">
              <Luggage size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-[#F4F5F3]">{decryptField(c.patientName)}</span>
                <span className="text-xs text-white/40">{countryFlag(c.country)} {countryName(c.country)}</span>
                <span className="inline-flex items-center gap-1 text-xs text-white/40"><Languages size={12} /> {c.language}</span>
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
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-white/50">
                <span className="font-medium text-[#1FA9B8]">{c.branch}</span>
                <span>· {procs.length} işlem{totalTRY ? ` · ${formatTRY(totalTRY)}` : ""}</span>
                {c.treatmentDaysMin != null && c.treatmentDaysMax != null && (
                  <span className="inline-flex items-center gap-1"><CalendarRange size={12} /> {c.treatmentDaysMin}–{c.treatmentDaysMax} gün</span>
                )}
                {c.hospitalName && <span className="inline-flex items-center gap-1"><Building2 size={12} /> {c.hospitalName}</span>}
                {c.doctor && <span>· {c.doctor.title} {c.doctor.name}</span>}
                {c.agencySentAt && <span className="text-white/40">· iletildi: {formatDateTime(c.agencySentAt)}</span>}
              </div>
            </div>
            <ArrowRight size={18} className="hidden shrink-0 text-white/25 group-hover:text-[#28C8D8] sm:block" />
          </Link>
        ))}
      </div>

      <p className="mt-6 text-[11px] leading-relaxed text-white/40">
        Veri minimizasyonu: acente panelinde yalnız hasta kimliği/iletişimi ve doktorun tedavi kararı
        (işlem · ücret · süre · hastane) görüntülenir. Tıbbi belge, görüntüleme, test sonucu ve şikâyet
        metni acenteyle paylaşılmaz.
      </p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#161719] p-3.5">
      <div className={`text-2xl font-bold ${tone ?? "text-[#F4F5F3]"}`}>{value}</div>
      <div className="text-xs text-white/50">{label}</div>
    </div>
  );
}
