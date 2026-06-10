import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computePackage, type PackageSelection, type Tier, type HospitalType } from "@/lib/pricing";
import { notifyRoles } from "@/lib/notify";

// POST /api/cases/:id/booking — sağlık turizmi paketi rezervasyonu oluştur (Escrow)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db.case.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const selection: PackageSelection = {
    branch: c.branch,
    country: c.country,
    tier: (["Ekonomik", "Standart", "Premium"].includes(b.tier) ? b.tier : "Standart") as Tier,
    hotelStars: b.hotelStars === 5 ? 5 : 4,
    hospitalType: (b.hospitalType === "Üniversite" ? "Üniversite" : "Özel") as HospitalType,
    nights: Math.min(30, Math.max(1, Number(b.nights) || 5)),
    translator: !!b.translator,
    insuranceExtended: !!b.insuranceExtended,
    insuranceMalpractice: !!b.insuranceMalpractice,
  };

  const quote = computePackage(selection);

  const booking = await db.booking.create({
    data: {
      caseId: c.id,
      branch: selection.branch,
      country: selection.country,
      tier: selection.tier,
      hotelStars: selection.hotelStars,
      hospitalType: selection.hospitalType,
      nights: selection.nights,
      translator: selection.translator,
      insuranceExtended: selection.insuranceExtended,
      insuranceMalpractice: selection.insuranceMalpractice,
      subtotal: quote.subtotal,
      platformFee: quote.platformFee,
      total: quote.total,
      currency: quote.currency,
      breakdown: JSON.stringify(quote.items),
      split: JSON.stringify(quote.split),
    },
  });

  await db.case.update({ where: { id: c.id }, data: { status: "DONE" } });

  await notifyRoles(["COORDINATOR"], {
    type: "BOOKING",
    title: `💼 Yeni rezervasyon: ${c.patientName}`,
    body: `${selection.tier} · ${selection.branch} · $${quote.total.toLocaleString("en-US")} (Escrow'da)`,
    href: `/rezervasyon/${booking.id}`,
  });

  return NextResponse.json({ bookingId: booking.id }, { status: 201 });
}
