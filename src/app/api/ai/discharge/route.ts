import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { generateDischarge } from "@/lib/ai-clinical";
import { countryName } from "@/lib/constants";

// POST /api/ai/discharge — vakanın tüm yolculuğunu epikriz/taburcu raporuna sentezler (Claude) ve Case'e kaydeder.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const b = await req.json().catch(() => ({}));
  const caseId = String(b.caseId ?? "");
  if (!caseId) return NextResponse.json({ error: "caseId gerekli." }, { status: 400 });

  const c = await db.case.findUnique({
    where: { id: caseId },
    include: {
      doctor: true,
      consultations: { orderBy: { startedAt: "desc" } },
      bookings: { orderBy: { createdAt: "desc" } },
      recovery: { include: { checkIns: { orderBy: { createdAt: "desc" } } } },
    },
  });
  if (!c) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });

  // Tedavi paketi özeti (en güncel rezervasyon)
  const bk = c.bookings[0];
  const packageSummary = bk
    ? `${bk.tier} paket · ${bk.branch} · ${countryName(bk.country)} · ${bk.hospitalType} hastane · ${bk.nights} gece` +
      `${bk.translator ? " · tercüman" : ""}${bk.insuranceMalpractice ? " · malpraktis sigortası" : ""}` +
      ` · toplam ${bk.total.toLocaleString("tr-TR")} ${bk.currency} (emanet: ${bk.escrowStatus})`
    : "Paket oluşturulmadı.";

  // Post-op iyileşme özeti
  let recoverySummary = "Post-op takip başlamadı.";
  if (c.recovery) {
    const ch = c.recovery.checkIns;
    const last = ch[0];
    const day = Math.max(1, Math.floor((Date.now() - new Date(c.recovery.startedAt).getTime()) / 86_400_000) + 1);
    const redCount = ch.filter((x) => x.severity === "RED").length;
    recoverySummary = last
      ? `Post-op ${day}. gün · ${ch.length} kontrol · son: ağrı ${last.pain}/10, ateş ${last.feverC.toFixed(1)}°C, ` +
        `ilaç ${last.meds ? "düzenli" : "aksatıldı"}${redCount ? ` · ${redCount} kırmızı bayrak` : ""}` +
        `${last.note ? ` · hasta notu: ${last.note}` : ""} · durum: ${c.recovery.status}`
      : `Post-op takip başladı (${day}. gün), henüz kontrol girişi yok.`;
  }

  try {
    const { sections, structured } = await generateDischarge({
      patientName: c.patientName,
      countryName: countryName(c.country),
      language: c.language,
      branch: c.branch,
      urgency: c.urgency,
      symptoms: c.symptoms,
      triageReasoning: c.reasoning,
      soapNotes: c.consultations[0]?.notes ?? "",
      packageSummary,
      recoverySummary,
    });

    // Deterministik başlık + AI bölümleri
    const doctorLine = c.doctor ? `${c.doctor.title} ${c.doctor.name}` : user.name;
    const dateLine = new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeZone: "Europe/Istanbul" }).format(new Date());
    const header =
      `EPİKRİZ / TABURCU RAPORU\n` +
      `Hasta: ${c.patientName} · ${countryName(c.country)} · Branş: ${c.branch}\n` +
      `Sorumlu Hekim: ${doctorLine} · Tarih: ${dateLine}\n` +
      `${"─".repeat(40)}`;
    const report = `${header}\n\n${sections}`;
    const dischargeAt = new Date();

    await db.case.update({
      where: { id: caseId },
      data: { dischargeReport: report, dischargeStructured: JSON.stringify(structured), dischargeAt },
    });

    return NextResponse.json({ report, structured, savedAt: dischargeAt.toISOString() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "AI hatası" }, { status: 502 });
  }
}
