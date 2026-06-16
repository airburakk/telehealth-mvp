import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { countryFlag, urgencyStyle, CASE_STATUS, formatDateTime } from "@/lib/constants";
import { FolderHeart, Plus, ArrowRight, Stethoscope, HeartPulse, Luggage, FileText, Inbox } from "lucide-react";

export const dynamic = "force-dynamic";

// Vakalarım — hastanın kendi başvuruları (hasta↔vaka sahipliği). Hasta yalnız kendi vakalarını görür.
export default async function MyCasesPage() {
  const user = await getCurrentUser();
  if (!user || !["PATIENT", "ADMIN"].includes(user.role)) redirect("/giris?next=/vakalarim");

  const cases = await db.case.findMany({
    where: user.role === "PATIENT" ? { userId: user.id } : {},
    orderBy: { createdAt: "desc" },
    include: {
      bookings: { orderBy: { createdAt: "desc" }, take: 1 },
      recovery: { select: { id: true } },
    },
  });

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#0E9E97] text-white"><FolderHeart size={22} /></span>
          <div>
            <h1 className="text-2xl font-bold text-[#0A3F39]">Vakalarım</h1>
            <p className="text-sm text-slate-500">Sağlık başvurularınız — yalnızca siz görürsünüz.</p>
          </div>
        </div>
        <Link href="/triyaj" className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
          <Plus size={16} /> Yeni başvuru
        </Link>
      </div>

      <div className="mt-6 space-y-3">
        {cases.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center">
            <Inbox className="mx-auto mb-2 text-slate-300" size={28} />
            <p className="text-sm text-slate-500">Henüz başvurunuz yok.</p>
            <Link href="/triyaj" className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#0E9E97] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0A7D77]">
              <Plus size={15} /> Triyaj ile başlayın
            </Link>
          </div>
        )}

        {cases.map((c) => {
          const u = urgencyStyle(c.urgency);
          const st = CASE_STATUS[c.status] ?? CASE_STATUS.NEW;
          const booking = c.bookings[0];
          return (
            <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-800">{c.patientName}</span>
                    <span className="text-xs text-slate-400">{countryFlag(c.country)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${st.color}`}>{st.label}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${u.badge}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${u.dot}`} /> {c.urgency}/5
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1"><Stethoscope size={12} /> <span className="font-medium text-[#0A7D77]">{c.branch}</span></span>
                    <span>· {formatDateTime(c.createdAt)}</span>
                    {booking && <span>· {booking.tier} {booking.status === "DRAFT" ? "teklifi" : "paket"} (${booking.total.toLocaleString("en-US")})</span>}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600">{c.symptoms}</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <CaseAction href={`/triyaj/${c.id}`} icon={<FileText size={13} />}>Vaka özeti</CaseAction>
                {c.recovery && <CaseAction href={`/takip/${c.id}`} icon={<HeartPulse size={13} />} tone="text-teal-700 border-teal-200 bg-teal-50 hover:bg-teal-100">Post-Op takip</CaseAction>}
                {booking && booking.status === "CONFIRMED" && <CaseAction href={`/rezervasyon/${booking.id}`} icon={<Luggage size={13} />} tone="text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100">Rezervasyon</CaseAction>}
                {booking && booking.status === "DRAFT" && <CaseAction href={`/teklif/${booking.id}`} icon={<FileText size={13} />} tone="text-violet-700 border-violet-200 bg-violet-50 hover:bg-violet-100">Bekleyen teklif</CaseAction>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CaseAction({ href, icon, children, tone }: { href: string; icon: React.ReactNode; children: React.ReactNode; tone?: string }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium ${tone ?? "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
      {icon} {children} <ArrowRight size={11} />
    </Link>
  );
}
