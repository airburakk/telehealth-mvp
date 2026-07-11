import Link from "next/link";
import { redirect } from "next/navigation";
import { Luggage, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { decryptField } from "@/lib/crypto";
import { countryFlag, countryName } from "@/lib/constants";
import { parseJourney, journeyProgress } from "@/lib/journey";
import { LogisticsEditor } from "./LogisticsEditor";

export const dynamic = "force-dynamic";

const STAFF_ROLES = ["COORDINATOR", "ADMIN"];
const PAGE_SIZE = 20; // sayfa başına rezervasyon (/denetim deseni)

// Lojistik Takip Paneli (S2/S3 operasyon) — koordinatör onaylı (Escrow) rezervasyonların Patient
// Journey aşamalarını yönetir (durum + planlanan/gerçek tarih + lojistik not). Hasta rezervasyon
// sayfasında gerçek durumu görür; aşama ilerleyince bildirim alır. Personel paneli → TR-sabit (i18n yok).
export default async function LogisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/operasyon/lojistik");
  if (!STAFF_ROLES.includes(user.role)) redirect("/"); // middleware de korur — derinlemesine savunma

  const sp = await searchParams;
  const total = await db.booking.count({ where: { status: "CONFIRMED" } });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // İstenen sayfayı geçerli aralığa sıkıştır (0/negatif/NaN/aşırı-büyük güvenli).
  const page = Math.min(Math.max(1, parseInt(sp.page ?? "1", 10) || 1), totalPages);

  const bookings = await db.booking.findMany({
    where: { status: "CONFIRMED" },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    // Dar liste-DTO: breakdown/split/insuranceDetail gibi ağır alanlar taşınmaz —
    // yalnız kart başlığı + LogisticsEditor'ün kullandığı journeyData.
    select: {
      id: true,
      journeyData: true,
      branch: true,
      tier: true,
      hotelStars: true,
      nights: true,
      case: { select: { patientName: true, country: true } },
    },
  });

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <Link href="/operasyon" className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white/75">
        <ArrowLeft size={15} /> Operasyon Paneli
      </Link>
      <div className="mt-3 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#28C8D8] text-[#0D0E10]"><Luggage size={22} /></span>
        <div>
          <h1 className="text-2xl font-bold text-[#F4F5F3]">Lojistik Takip</h1>
          <p className="text-sm text-white/50">Patient Journey — karşılama · konaklama · tedavi · dönüş aşamalarını yönet</p>
        </div>
      </div>

      {bookings.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-white/10 bg-[#1E1F22] px-5 py-10 text-center text-sm text-white/50">
          Henüz onaylı (Escrow) rezervasyon yok. Bir paket onaylanınca lojistik takibi burada açılır.
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {bookings.map((b) => {
            const stages = parseJourney(b.journeyData);
            const progress = journeyProgress(stages);
            return (
              <div key={b.id} className="rounded-3xl border border-white/10 bg-[#161719] p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-[#F4F5F3]">{decryptField(b.case.patientName)}</div>
                    <div className="text-xs text-white/50">
                      {countryFlag(b.case.country)} {countryName(b.case.country)} · {b.branch} · {b.tier} · {b.hotelStars}★ / {b.nights} gece
                    </div>
                  </div>
                  <div className="text-right text-xs text-white/40">
                    <div className="font-mono">{b.id.slice(0, 8).toUpperCase()}</div>
                    <div>{progress.done}/{progress.total} · <span className="font-medium text-[#28C8D8]">{progress.current}</span></div>
                  </div>
                </div>
                <LogisticsEditor bookingId={b.id} initialStages={stages} />
              </div>
            );
          })}
        </div>
      )}

      {/* Sayfalama — /denetim deseni: Toplam N · Sayfa X/Y + Önceki/Sonraki */}
      {totalPages > 1 && (
        <nav className="mt-5 flex flex-wrap items-center justify-between gap-3" aria-label="Lojistik takip sayfaları">
          <span className="text-xs text-white/50">
            Toplam <strong className="text-white/75">{total}</strong> rezervasyon · Sayfa{" "}
            <strong className="text-white/75">{page}</strong> / {totalPages}
          </span>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link
                href={`/operasyon/lojistik?page=${page - 1}`}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-sm font-medium text-white/65 hover:bg-[#1E1F22]"
              >
                <ChevronLeft size={15} /> Önceki
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-sm font-medium text-white/25 cursor-not-allowed">
                <ChevronLeft size={15} /> Önceki
              </span>
            )}
            {page < totalPages ? (
              <Link
                href={`/operasyon/lojistik?page=${page + 1}`}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-sm font-medium text-white/65 hover:bg-[#1E1F22]"
              >
                Sonraki <ChevronRight size={15} />
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-sm font-medium text-white/25 cursor-not-allowed">
                Sonraki <ChevronRight size={15} />
              </span>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
