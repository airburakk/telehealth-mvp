import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { canAccessCase } from "@/lib/ownership";
import { formatUSD, type LineItem } from "@/lib/pricing";
import { ESCROW_STATUS } from "@/lib/ethics";
import {
  CheckCircle2, Lock, Plane, BedDouble, Stethoscope, Home,
  MessageCircle, ShieldCheck, Languages, Building2, HeartPulse, Scale,
} from "lucide-react";

export const dynamic = "force-dynamic";

const JOURNEY = [
  { icon: Plane, t: "Karşılama & transfer", d: "Havalimanı VIP karşılama" },
  { icon: BedDouble, t: "Otel girişi", d: "Konaklama başlangıcı" },
  { icon: Building2, t: "Hastane & ön muayene", d: "Tetkik ve hazırlık" },
  { icon: Stethoscope, t: "Operasyon / tedavi", d: "Planlanan işlem" },
  { icon: Home, t: "Taburcu & dönüş", d: "Kontroller + uçuş" },
];

export default async function ReservationPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { case: true } });
  if (!booking) notFound();
  if (!(await canAccessCase(booking.case))) notFound(); // hasta yalnız kendi rezervasyonunu görür
  if (booking.status !== "CONFIRMED") redirect(`/teklif/${booking.id}`); // taslak/iptal teklif → teklif sayfası

  const items: LineItem[] = JSON.parse(booking.breakdown);
  const split: LineItem[] = JSON.parse(booking.split);
  const c = booking.case;
  const esc = ESCROW_STATUS[booking.escrowStatus] ?? ESCROW_STATUS.HELD;

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" />
        <div>
          <h1 className="font-bold text-emerald-900">Paket onaylandı · Ödeme Escrow&apos;da emanette</h1>
          <p className="mt-0.5 text-sm text-emerald-800/80">
            {c.patientName} için {booking.branch} tedavi paketi rezerve edildi. Tutar, hizmet tamamlanana dek platform güvencesinde tutulur.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-[1fr_300px]">
        {/* Sol: paket içeriği */}
        <div className="space-y-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">Rezervasyon No</div>
                <div className="font-mono text-sm text-slate-700">{booking.id.slice(0, 8).toUpperCase()}</div>
              </div>
              <span className="rounded-full bg-[#14C3D0] px-3 py-1 text-xs font-semibold text-[#101010]">{booking.tier} Paket</span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Spec icon={<Building2 size={14} />} k="Hastane" v={`${booking.hospitalType}`} />
              <Spec icon={<BedDouble size={14} />} k="Otel" v={`${booking.hotelStars}★ · ${booking.nights} gece`} />
              <Spec icon={<Languages size={14} />} k="Tercüman" v={booking.translator ? "Dahil" : "Yok"} />
              <Spec icon={<ShieldCheck size={14} />} k="Sigorta" v={["Zorunlu", booking.insuranceExtended ? "Genişletilmiş" : null, booking.insuranceMalpractice ? "Malpraktis" : null].filter(Boolean).join(" + ")} />
            </div>

            <ul className="mt-5 space-y-2 border-t border-slate-100 pt-4">
              {items.map((it) => (
                <li key={it.key} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-slate-600">{it.label}{it.note && <span className="block text-xs text-slate-400">{it.note}</span>}</span>
                  <span className="shrink-0 font-medium text-slate-800">{formatUSD(it.amount)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-end justify-between border-t border-slate-200 pt-3">
              <span className="text-sm font-semibold text-slate-700">Toplam (Escrow)</span>
              <span className="text-2xl font-bold text-[#101010]">{formatUSD(booking.total)}</span>
            </div>
          </div>

          {/* Hasta yolculuğu */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hasta Yolculuğu</div>
            <ol className="mt-4 space-y-0">
              {JOURNEY.map((j, i) => {
                const Icon = j.icon;
                return (
                  <li key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-teal-100 text-teal-700"><Icon size={16} /></span>
                      {i < JOURNEY.length - 1 && <span className="my-1 h-6 w-0.5 bg-slate-200" />}
                    </div>
                    <div className="pb-2">
                      <div className="text-sm font-medium text-slate-800">{j.t}</div>
                      <div className="text-xs text-slate-400">{j.d}</div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>

        {/* Sağ: Escrow + split */}
        <aside className="space-y-4">
          <div className="rounded-3xl border border-teal-200 bg-teal-50/60 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-teal-800"><Lock size={16} /> Escrow Durumu</div>
            <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold ring-1 ${esc.color}`}>
              <span className={`h-2 w-2 rounded-full ${esc.dot}`} /> {esc.label}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              Tüm ödeme platform havuzunda toplandı. Tedavi tamamlanınca aşağıdaki taraflara dağıtılır; sorun halinde iade Etik Kurul kararıyla yapılır.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ödeme Dağılımı (Split)</div>
            <ul className="mt-3 space-y-2 text-sm">
              {split.map((s) => (
                <li key={s.key} className="flex items-center justify-between">
                  <span className="text-slate-600">{s.label}</span>
                  <span className="font-medium text-slate-800">{formatUSD(s.amount)}</span>
                </li>
              ))}
            </ul>
          </div>

          <Link href={`/takip/${c.id}`} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
            <HeartPulse size={16} /> Post-Op takibe başla
          </Link>
          <button className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <MessageCircle size={15} /> Koordinatörle konuş
          </button>
          <Link href={`/sikayet/${c.id}`} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Scale size={15} /> Şikayet / itiraz (Etik Kurul)
          </Link>
          <Link href="/doktor" className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#14C3D0] px-4 py-2.5 text-sm font-semibold text-[#101010] hover:bg-[#0EA5B2]">
            <Stethoscope size={16} /> Doktor paneline dön
          </Link>
        </aside>
      </div>
    </div>
  );
}

function Spec({ icon, k, v }: { icon: React.ReactNode; k: string; v: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs text-slate-400">{icon} {k}</div>
      <div className="mt-0.5 text-sm font-medium text-slate-800">{v}</div>
    </div>
  );
}
