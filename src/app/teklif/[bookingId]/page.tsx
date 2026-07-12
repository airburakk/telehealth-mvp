import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Teklif görünümü tek hasta vaka merkezine taşındı (basitleştirme Faz 6, 2026-07-12) —
// OfferView artık /vaka/[caseId]#teklif bölümünde gömülü. Eski linkler/bildirimler için kalıcı
// köprü; auth/BOLA kapısını hub yapar (buradaki lookup yalnız bookingId→caseId çevirisidir).
export default async function OfferRedirect({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const booking = await db.booking.findUnique({ where: { id: bookingId }, select: { caseId: true } });
  if (!booking) notFound();
  redirect(`/vaka/${booking.caseId}#teklif`);
}
