import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { canAccessCase } from "@/lib/ownership";
import { type LineItem } from "@/lib/pricing";
import { decryptField } from "@/lib/crypto";
import { parseJourney } from "@/lib/journey";
import { ReservationView } from "@/components/ReservationView";

export const dynamic = "force-dynamic";

// /rezervasyon/[bookingId] — onaylanmış rezervasyon (CONFIRMED). Server: auth + decrypt + DB;
// sunum + i18n + escrow güven görseli client ReservationView'da (FAZ 3).
export default async function ReservationPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { case: true } });
  if (!booking) notFound();
  if (!(await canAccessCase(booking.case))) notFound(); // hasta yalnız kendi rezervasyonunu görür
  if (booking.status !== "CONFIRMED") redirect(`/teklif/${booking.id}`); // taslak/iptal teklif → teklif sayfası

  const items: LineItem[] = JSON.parse(booking.breakdown);
  const split: LineItem[] = JSON.parse(booking.split);

  return (
    <ReservationView
      bookingId={booking.id}
      rezNo={booking.id.slice(0, 8).toUpperCase()}
      tier={booking.tier}
      hospitalType={booking.hospitalType}
      hotelStars={booking.hotelStars}
      nights={booking.nights}
      translator={booking.translator}
      insuranceLevel={booking.insuranceLevel}
      insuranceDetail={booking.insuranceDetail}
      items={items}
      split={split}
      total={booking.total}
      patientName={decryptField(booking.case.patientName)}
      branch={booking.branch}
      escrowStatus={booking.escrowStatus}
      stages={parseJourney(booking.journeyData)}
      caseId={booking.case.id}
    />
  );
}
