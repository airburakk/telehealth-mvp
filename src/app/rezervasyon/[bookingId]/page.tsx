import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Rezervasyon görünümü tek hasta vaka merkezine taşındı (basitleştirme Faz 6, 2026-07-12) —
// ReservationView artık /vaka/[caseId]#rezervasyon bölümünde gömülü. Eski linkler/bildirimler için
// kalıcı köprü; auth/BOLA kapısını hub yapar (buradaki lookup yalnız bookingId→caseId çevirisidir).
export default async function ReservationRedirect({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const booking = await db.booking.findUnique({ where: { id: bookingId }, select: { caseId: true } });
  if (!booking) notFound();
  redirect(`/vaka/${booking.caseId}#rezervasyon`);
}
