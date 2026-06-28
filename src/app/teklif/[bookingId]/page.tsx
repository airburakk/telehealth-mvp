import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { canAccessCase } from "@/lib/ownership";
import { formatUSD, type LineItem } from "@/lib/pricing";
import { countryFlag, countryName } from "@/lib/constants";
import { decryptField } from "@/lib/crypto";
import { OfferActions } from "@/components/OfferActions";
import { InsuranceSummary } from "@/components/InsuranceSummary";
import {
  ArrowLeft, FileText, Building2, BedDouble, Languages, ShieldCheck, Lock,
  Plane, Stethoscope, Home, XCircle, Sparkles,
} from "lucide-react";

export const dynamic = "force-dynamic";

const JOURNEY = [
  { icon: Plane, t: "Karşılama & transfer", d: "Havalimanı VIP karşılama" },
  { icon: BedDouble, t: "Otel girişi", d: "Konaklama başlangıcı" },
  { icon: Building2, t: "Hastane & ön muayene", d: "Tetkik ve hazırlık" },
  { icon: Stethoscope, t: "Operasyon / tedavi", d: "Planlanan işlem" },
  { icon: Home, t: "Taburcu & dönüş", d: "Kontroller + uçuş" },
];

// /teklif/[bookingId] — hastaya gönderilen tedavi paketi teklifi (DRAFT booking).
// Hasta onaylar → Escrow (CONFIRMED) → /rezervasyon. PDF/yazdır ile belge alınabilir.
export default async function OfferPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { case: true } });
  if (!booking) notFound();
  if (!(await canAccessCase(booking.case))) notFound(); // hasta yalnız kendi teklifini görür

  // Onaylanmış teklif → rezervasyon görünümü
  if (booking.status === "CONFIRMED") redirect(`/rezervasyon/${booking.id}`);

  const items: LineItem[] = JSON.parse(booking.breakdown);
  const c = booking.case;
  const declined = booking.status === "CANCELLED";
  const created = new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeZone: "Europe/Istanbul" }).format(booking.createdAt);

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link href="/vakalarim" className="print:hidden inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#0EA5B2]">
        <ArrowLeft size={16} /> Vakalarım
      </Link>

      {/* Belge başlığı */}
      <div className="mt-4 flex items-start justify-between gap-3 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-600 text-white"><FileText size={22} /></span>
          <div>
            <h1 className="text-2xl font-bold text-[#101010]">Tedavi Paketi Teklifi</h1>
            <p className="text-sm text-slate-500">{decryptField(c.patientName)} · {countryFlag(c.country)} {countryName(c.country)} · {c.branch}</p>
          </div>
        </div>
        <div className="text-right text-xs text-slate-400">
          <div className="font-mono text-slate-600">{booking.id.slice(0, 8).toUpperCase()}</div>
          <div>{created}</div>
        </div>
      </div>

      {/* Durum bandı */}
      {declined ? (
        <div className="mt-5 flex items-start gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <XCircle className="mt-0.5 shrink-0 text-slate-400" />
          <div>
            <div className="font-semibold text-slate-700">Bu teklif reddedildi</div>
            <p className="text-sm text-slate-500">Yeni bir teklif için koordinatörünüzle görüşebilirsiniz.</p>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex items-start gap-3 rounded-3xl border border-violet-200 bg-violet-50/70 p-4">
          <Sparkles className="mt-0.5 shrink-0 text-violet-600" />
          <div>
            <div className="font-semibold text-violet-900">Size özel hazırlanmış tedavi paketi teklifi</div>
            <p className="text-sm text-violet-800/80">Aşağıdaki paketi inceleyin. Onayladığınızda ödeme, hizmet tamamlanana dek platform Escrow güvencesinde tutulur.</p>
          </div>
        </div>
      )}

      {/* Paket içeriği */}
      <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Paket içeriği</span>
          <span className="rounded-full bg-[#14C3D0] px-3 py-1 text-xs font-semibold text-[#101010]">{booking.tier} Paket</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <Spec icon={<Building2 size={14} />} k="Hastane" v={booking.hospitalType} />
          <Spec icon={<BedDouble size={14} />} k="Otel" v={`${booking.hotelStars}★ · ${booking.nights} gece`} />
          <Spec icon={<Languages size={14} />} k="Tercüman" v={booking.translator ? "Dahil" : "Yok"} />
          <Spec icon={<ShieldCheck size={14} />} k="Sigorta" v={`Seviye ${booking.insuranceLevel}`} />
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
          <span className="text-sm font-semibold text-slate-700">Toplam</span>
          <span className="text-2xl font-bold text-[#101010]">{formatUSD(booking.total)}</span>
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-teal-50 px-3 py-2 text-xs text-teal-800 ring-1 ring-teal-100">
          <Lock size={14} className="mt-0.5 shrink-0" />
          Ödeme platform Escrow havuzunda emanet tutulur; hizmet tamamlanınca taraflara aktarılır. Sorun halinde iade Etik Kurul kararıyla yapılır.
        </div>
      </div>

      {/* Sigorta teminat özeti (3 kademeli) */}
      <div className="mt-5">
        <InsuranceSummary detailJson={booking.insuranceDetail} />
      </div>

      {/* Hasta yolculuğu */}
      <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hasta Yolculuğu</div>
        <ol className="mt-4 grid gap-3 sm:grid-cols-5">
          {JOURNEY.map((j, i) => {
            const Icon = j.icon;
            return (
              <li key={i} className="flex flex-col items-center text-center">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-teal-100 text-teal-700"><Icon size={16} /></span>
                <div className="mt-1.5 text-xs font-medium text-slate-800">{j.t}</div>
                <div className="text-[10px] text-slate-400">{j.d}</div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Aksiyonlar (taslak teklif) */}
      {!declined && (
        <div className="mt-6">
          <OfferActions bookingId={booking.id} total={formatUSD(booking.total)} />
        </div>
      )}

      <p className="mt-6 text-center text-[11px] text-slate-400">
        Bu teklif AURA sağlık turizmi platformu üzerinden hazırlanmıştır · {created}
      </p>
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
