import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/api-auth";
import { canCaseBeAccessedBy } from "@/lib/ownership";
import { notifyRoles } from "@/lib/notify";
import { rateLimit, tooMany } from "@/lib/rate-limit";

// POST /api/bookings/:bookingId/contact-coordinator — hasta rezervasyon/teklif sayfasından
// koordinatörle görüşme talep eder ("Koordinatörle konuş" butonu; FAZ 3).
// Sahiplik kapısı (canCaseBeAccessedBy) BOLA'yı önler; isim bildirime GÖMÜLMEZ (E2EE inc.2c).
// middleware /api'yi korumaz → route kendi auth'unu yapar ([[api-routes-need-self-auth]]).
export async function POST(_req: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const { user, error } = await requireUser();
  if (error) return error;

  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { case: true } });
  if (!booking) return NextResponse.json({ error: "Rezervasyon bulunamadı." }, { status: 404 });
  if (!(await canCaseBeAccessedBy(user, booking.case))) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });

  // Bildirim spam freni: 5/10dk/kullanıcı/rezervasyon
  const rl = await rateLimit(`coord-contact:${user.id}:${bookingId}`, 5, 10 * 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  const href = booking.status === "CONFIRMED" ? `/rezervasyon/${booking.id}` : `/teklif/${booking.id}`;
  await notifyRoles(["COORDINATOR"], {
    type: "BOOKING",
    title: "💬 Hasta koordinatör görüşmesi talep ediyor",
    body: `${booking.tier} · ${booking.branch} · ${booking.id.slice(0, 8).toUpperCase()}`,
    href,
  });

  return NextResponse.json({ ok: true });
}
