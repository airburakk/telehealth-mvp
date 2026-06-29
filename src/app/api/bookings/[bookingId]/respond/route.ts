import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canCaseBeAccessedBy } from "@/lib/ownership";
import { notifyRoles } from "@/lib/notify";

// POST /api/bookings/:bookingId/respond — hasta DRAFT teklifi yanıtlar.
// { action: "approve" | "decline" }
//  approve → Booking CONFIRMED + escrow HELD, vaka DONE, koordinatöre bildirim
//  decline → Booking CANCELLED, koordinatöre bildirim
export async function POST(req: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { case: true } });
  if (!booking) return NextResponse.json({ error: "Teklif bulunamadı." }, { status: 404 });

  // Hasta yalnız kendi teklifini yanıtlayabilir (klinik personel serbest)
  const user = await getCurrentUser();
  if (!(await canCaseBeAccessedBy(user, booking.case))) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });

  if (booking.status !== "DRAFT") {
    return NextResponse.json({ error: "Bu teklif zaten yanıtlanmış.", status: booking.status }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action === "decline" ? "decline" : "approve";
  const c = booking.case;
  const amount = `$${booking.total.toLocaleString("en-US")}`;

  if (action === "decline") {
    await db.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } });
    await notifyRoles(["COORDINATOR"], {
      type: "OFFER",
      title: `🚫 Teklif reddedildi`, // isim bildirime gömülmez (E2EE inc.2c)
      body: `${booking.tier} · ${booking.branch} · ${amount} — hasta teklifi reddetti`,
      href: `/teklif/${booking.id}`,
    });
    return NextResponse.json({ ok: true, declined: true });
  }

  // approve → Escrow'a al
  await db.booking.update({ where: { id: booking.id }, data: { status: "CONFIRMED", escrowStatus: "HELD" } });
  await db.case.update({ where: { id: c.id }, data: { status: "DONE" } });
  await notifyRoles(["COORDINATOR"], {
    type: "BOOKING",
    title: `✅ Teklif onaylandı`,
    body: `${booking.tier} · ${booking.branch} · ${amount} — Escrow'a alındı`,
    href: `/rezervasyon/${booking.id}`,
  });
  return NextResponse.json({ ok: true, bookingId: booking.id });
}
