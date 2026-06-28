import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computePackage, type PackageSelection, type Tier, type HospitalType, type RecommendedTreatment, type InsuranceLevel } from "@/lib/pricing";
import { getTryPerUsd } from "@/lib/fxrate";
import { notifyRoles, notifyUser } from "@/lib/notify";
import { getCurrentUser } from "@/lib/auth";
import { ownsCase } from "@/lib/ownership";
import { defaultJourney } from "@/lib/journey";

// POST /api/cases/:id/booking — sağlık turizmi paketi rezervasyonu oluştur (Escrow)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  const { id } = await params;
  const c = await db.case.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });
  if (!ownsCase(user, c)) return NextResponse.json({ error: "Bu vakaya erişim yetkiniz yok." }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  // Sigorta seviyesi: insuranceLevel esas; yoksa eski booleanlardan türet (geriye uyum).
  const insuranceLevel = ([1, 2, 3].includes(Number(b.insuranceLevel))
    ? Number(b.insuranceLevel)
    : b.insuranceMalpractice ? 3 : b.insuranceExtended === false ? 1 : 2) as InsuranceLevel;
  const selection: PackageSelection = {
    branch: c.branch,
    country: c.country,
    tier: (["Ekonomik", "Standart", "Premium"].includes(b.tier) ? b.tier : "Standart") as Tier,
    hotelStars: b.hotelStars === 5 ? 5 : 4,
    hospitalType: (b.hospitalType === "Üniversite" ? "Üniversite" : "Özel") as HospitalType,
    nights: Math.min(30, Math.max(1, Number(b.nights) || 5)),
    translator: !!b.translator,
    insuranceLevel,
    insuranceExtended: insuranceLevel >= 2,
    insuranceMalpractice: insuranceLevel >= 3,
  };

  // Doktorun M2'de tavsiye ettiği tedaviler (varsa) → fiyat doktorun ₺ değerlerinden ($'a çevrilir)
  let treatments: RecommendedTreatment[] = [];
  try { treatments = c.recommendedProcedures ? (JSON.parse(c.recommendedProcedures) as RecommendedTreatment[]) : []; } catch { treatments = []; }

  const fx = await getTryPerUsd();

  // Katman 3 girdisi: vakanın doktorunun mevcut MMSS teminat limiti (₺ ise canlı kurla USD'ye normalize).
  // Limit hedefi karşılıyorsa malpraktis ek primi 0 olur (boşluk yok).
  let doctorMmssLimitUsd: number | undefined;
  if (c.doctorId) {
    const doc = await db.doctor.findUnique({ where: { id: c.doctorId }, select: { mmssCoverageLimit: true, mmssCoverageCurrency: true } });
    if (doc?.mmssCoverageLimit && doc.mmssCoverageLimit > 0) {
      doctorMmssLimitUsd = doc.mmssCoverageCurrency === "USD" ? doc.mmssCoverageLimit : Math.round(doc.mmssCoverageLimit / fx.rate);
    }
  }

  const quote = computePackage(selection, treatments, fx.rate, doctorMmssLimitUsd);

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
      insuranceLevel: selection.insuranceLevel ?? 1,
      insuranceDetail: JSON.stringify(quote.insurance), // teminat tabanı/hedef/boşluk/katman primleri (endikatif)
      subtotal: quote.subtotal,
      platformFee: quote.platformFee,
      total: quote.total,
      currency: quote.currency,
      breakdown: JSON.stringify(quote.items),
      split: JSON.stringify(quote.split),
      // Teklif: hasta onayına dek emanet tutulmaz (DRAFT/PENDING); onaylanınca CONFIRMED + HELD olur.
      status: isOffer ? "DRAFT" : "CONFIRMED",
      escrowStatus: isOffer ? "PENDING" : "HELD",
      journeyData: JSON.stringify(defaultJourney()), // lojistik Patient Journey başlangıcı (ilk aşama aktif)
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
      title: `📤 Hastaya teklif gönderildi`, // isim bildirime gömülmez (E2EE inc.2c)
      body: `${selection.tier} · ${selection.branch} · ${amount} — hasta onayı bekleniyor`,
      href: `/teklif/${booking.id}`,
    });
    return NextResponse.json({ bookingId: booking.id, mode: "offer" }, { status: 201 });
  }

  await db.case.update({ where: { id: c.id }, data: { status: "DONE" } });

  await notifyRoles(["COORDINATOR"], {
    type: "BOOKING",
    title: `💼 Yeni rezervasyon`,
    body: `${selection.tier} · ${selection.branch} · ${amount} (Escrow'da)`,
    href: `/rezervasyon/${booking.id}`,
  });

  return NextResponse.json({ bookingId: booking.id }, { status: 201 });
}
