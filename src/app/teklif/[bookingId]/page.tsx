import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { canAccessCase } from "@/lib/ownership";
import { type LineItem } from "@/lib/pricing";
import { decryptField } from "@/lib/crypto";
import { OfferView } from "@/components/OfferView";

export const dynamic = "force-dynamic";

// /teklif/[bookingId] — hastaya gönderilen tedavi paketi teklifi (DRAFT booking). Server: auth +
// decrypt + DB + redirect; sunum + i18n + escrow güven görseli client OfferView'da (FAZ 3).
// Hasta onaylar → Escrow (CONFIRMED) → /rezervasyon. PDF/yazdır ile belge alınabilir.
export default async function OfferPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { case: true } });
  if (!booking) notFound();
  if (!(await canAccessCase(booking.case))) notFound(); // hasta yalnız kendi teklifini görür
  if (booking.status === "CONFIRMED") redirect(`/rezervasyon/${booking.id}`); // onaylanmış → rezervasyon

  const items: LineItem[] = JSON.parse(booking.breakdown);
  const createdLabel = new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeZone: "Europe/Istanbul" }).format(booking.createdAt);

  // Doktorun seçtiği hastane + sağlık turizmi yetki belge no'su (HealthTürkiye; hasta güven sinyali)
  const reg = booking.case.hospitalRegistryId
    ? await db.registryHospital.findUnique({ where: { id: booking.case.hospitalRegistryId }, select: { authorizationNumber: true } })
    : null;

  return (
    <OfferView
      hospitalName={booking.case.hospitalName}
      hospitalAuthNo={reg?.authorizationNumber || null}
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
      total={booking.total}
      patientName={decryptField(booking.case.patientName)}
      country={booking.case.country}
      branch={booking.branch}
      escrowStatus={booking.escrowStatus}
      declined={booking.status === "CANCELLED"}
      createdLabel={createdLabel}
    />
  );
}
