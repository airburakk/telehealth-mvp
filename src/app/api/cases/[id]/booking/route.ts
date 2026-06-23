import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computePackage, type PackageSelection, type Tier, type HospitalType, type RecommendedTreatment } from "@/lib/pricing";
import { getTryPerUsd } from "@/lib/fxrate";
import { notifyRoles, notifyUser } from "@/lib/notify";
import { getCurrentUser } from "@/lib/auth";
import { ownsCase } from "@/lib/ownership";

// POST /api/cases/:id/booking — sağlık turizmi paketi rezervasyonu oluştur (Escrow)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  const { id } = await params;
  const c = await db.case.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });
  if (!ownsCase(user, c)) return NextResponse.json({ error: "Bu vakaya erişim yetkiniz yok." }, { status: 403 });

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

  // Doktorun M2'de tavsiye ettiği tedaviler (varsa) → fiyat doktorun ₺ değerlerinden ($'a çevrilir)
  let treatments: RecommendedTreatment[] = [];
  try { treatments = c.recommendedProcedures ? (JSON.parse(c.recommendedProcedures) as RecommendedTreatment[]) : []; } catch { treatments = []; }

  const fx = await getTryPerUsd();
  const quote = computePackage(selection, treatments, fx.rate);

  const isOffer = b.mode === "offer"; // hastaya teklif (DRAFT) — onay hastada; aksi halde doğrudan Escrow

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
      // Teklif: hasta onayına dek emanet tutulmaz (DRAFT/PENDING); onaylanınca CONFIRMED + HELD olur.
      status: isOffer ? "DRAFT" : "CONFIRMED",
      escrowStatus: isOffer ? "PENDING" : "HELD",
    },
  });

  const amount = `$${quote.total.toLocaleString("en-US")}`;

  if (isOffer) {
    // Vaka "DONE" yapılmaz — teklif beklemede. Hastaya kişisel bildirim + teklif linki.
    if (c.userId) {
      await notifyUser(c.userId, {
        type: "OFFER",
        title: `📋 Tedavi paketi teklifiniz hazır`,
        body: `${selection.tier} paket · ${selection.branch} · ${amount} — incelemek için dokunun`,
        href: `/teklif/${booking.id}`,
      });
    }
    await notifyRoles(["COORDINATOR"], {
      type: "OFFER",
      title: `📤 Hastaya teklif gönderildi: ${c.patientName}`,
      body: `${selection.tier} · ${selection.branch} · ${amount} — hasta onayı bekleniyor`,
      href: `/teklif/${booking.id}`,
    });
    return NextResponse.json({ bookingId: booking.id, mode: "offer" }, { status: 201 });
  }

  await db.case.update({ where: { id: c.id }, data: { status: "DONE" } });

  await notifyRoles(["COORDINATOR"], {
    type: "BOOKING",
    title: `💼 Yeni rezervasyon: ${c.patientName}`,
    body: `${selection.tier} · ${selection.branch} · ${amount} (Escrow'da)`,
    href: `/rezervasyon/${booking.id}`,
  });

  return NextResponse.json({ bookingId: booking.id }, { status: 201 });
}
