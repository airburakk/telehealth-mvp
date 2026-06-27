import Link from "next/link";
import { redirect } from "next/navigation";
import { Luggage, ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { decryptField } from "@/lib/crypto";
import { countryFlag, countryName } from "@/lib/constants";
import { parseJourney, journeyProgress } from "@/lib/journey";
import { LogisticsEditor } from "./LogisticsEditor";

export const dynamic = "force-dynamic";

const STAFF_ROLES = ["COORDINATOR", "ADMIN"];

// Lojistik Takip Paneli (S2/S3 operasyon) — koordinatör onaylı (Escrow) rezervasyonların Patient
// Journey aşamalarını yönetir (durum + planlanan/gerçek tarih + lojistik not). Hasta rezervasyon
// sayfasında gerçek durumu görür; aşama ilerleyince bildirim alır. Personel paneli → TR-sabit (i18n yok).
export default async function LogisticsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/operasyon/lojistik");
  if (!STAFF_ROLES.includes(user.role)) redirect("/"); // middleware de korur — derinlemesine savunma

  const bookings = await db.booking.findMany({
    where: { status: "CONFIRMED" },
    orderBy: { createdAt: "desc" },
    include: { case: { select: { patientName: true, branch: true, country: true } } },
  });

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <Link href="/operasyon" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={15} /> Operasyon Paneli
      </Link>
      <div className="mt-3 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#14C3D0] text-[#101010]"><Luggage size={22} /></span>
        <div>
          <h1 className="text-2xl font-bold text-[#101010]">Lojistik Takip</h1>
          <p className="text-sm text-slate-500">Patient Journey — karşılama · konaklama · tedavi · dönüş aşamalarını yönet</p>
        </div>
      </div>

      {bookings.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
          Henüz onaylı (Escrow) rezervasyon yok. Bir paket onaylanınca lojistik takibi burada açılır.
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {bookings.map((b) => {
            const stages = parseJourney(b.journeyData);
            const progress = journeyProgress(stages);
            return (
              <div key={b.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-slate-800">{decryptField(b.case.patientName)}</div>
                    <div className="text-xs text-slate-500">
                      {countryFlag(b.case.country)} {countryName(b.case.country)} · {b.branch} · {b.tier} · {b.hotelStars}★ / {b.nights} gece
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-400">
                    <div className="font-mono">{b.id.slice(0, 8).toUpperCase()}</div>
                    <div>{progress.done}/{progress.total} · <span className="font-medium text-teal-700">{progress.current}</span></div>
                  </div>
                </div>
                <LogisticsEditor bookingId={b.id} initialStages={stages} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
