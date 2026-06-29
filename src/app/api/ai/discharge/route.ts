import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { generateDischarge } from "@/lib/ai-clinical";
import { recoveryClosed } from "@/lib/postop-access";
import { countryName } from "@/lib/constants";
import { encryptField, decryptField } from "@/lib/crypto";
import { recordAccess, reqMeta } from "@/lib/audit";

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

  // E2EE Faz 2A — post-op takip tamamlandıysa epikriz üretimi (klinik yazma/AI) kapalı (hasta-only, §0.1·3).
  if (c.recovery && recoveryClosed(c.recovery).closed) {
    await recordAccess({ actor: user, action: "POSTOP_ACCESS_DENIED", resourceType: "CASE", resourceId: caseId, subjectUserId: c.userId, detail: `post-op kapalı (${recoveryClosed(c.recovery).reason}) — discharge`, ...reqMeta(req) });
    return NextResponse.json({ error: "Post-op takip tamamlandı; klinik erişim hastaya devredildi." }, { status: 403 });
  }

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
    const lastNote = last ? decryptField(last.note) : null; // post-op not at-rest şifreli → epikriz özetine düz
    const day = Math.max(1, Math.floor((Date.now() - new Date(c.recovery.startedAt).getTime()) / 86_400_000) + 1);
    const redCount = ch.filter((x) => x.severity === "RED").length;
    recoverySummary = last
      ? `Post-op ${day}. gün · ${ch.length} kontrol · son: ağrı ${last.pain}/10, ateş ${last.feverC.toFixed(1)}°C, ` +
        `ilaç ${last.meds ? "düzenli" : "aksatıldı"}${redCount ? ` · ${redCount} kırmızı bayrak` : ""}` +
        `${lastNote ? ` · hasta notu: ${lastNote}` : ""} · durum: ${c.recovery.status}`
      : `Post-op takip başladı (${day}. gün), henüz kontrol girişi yok.`;
  }

  try {
    const { sections, structured } = await generateDischarge({
      patientName: decryptField(c.patientName), // kimlik at-rest şifreli → AI girdisi için çöz (E2EE inc.2c)
      countryName: countryName(c.country),
      language: c.language,
      branch: c.branch,
      urgency: c.urgency,
      symptoms: decryptField(c.symptoms),
      triageReasoning: decryptField(c.reasoning),
      soapNotes: decryptField(c.consultations[0]?.notes ?? ""), // SOAP at-rest şifreli → AI girdisi için çöz
      packageSummary,
      recoverySummary,
    });

    // Deterministik başlık + AI bölümleri
    const doctorLine = c.doctor ? `${c.doctor.title} ${c.doctor.name}` : user.name;
    const dateLine = new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeZone: "Europe/Istanbul" }).format(new Date());
    const header =
      `EPİKRİZ / TABURCU RAPORU\n` +
      `Hasta: ${decryptField(c.patientName)} · ${countryName(c.country)} · Branş: ${c.branch}\n` +
      `Sorumlu Doktor: ${doctorLine} · Tarih: ${dateLine}\n` +
      `${"─".repeat(40)}`;
    const report = `${header}\n\n${sections}`;
    const dischargeAt = new Date();

    // Epikriz at-rest şifrelenir (E2EE Faz 1). Yanıt RAM'deki düz metni döndürür (yeniden okuma yok).
    await db.case.update({
      where: { id: caseId },
      data: { dischargeReport: encryptField(report), dischargeStructured: encryptField(JSON.stringify(structured)), dischargeAt },
    });

    await recordAccess({
      actor: user, action: "DISCHARGE_GENERATE", resourceType: "CASE", resourceId: caseId, subjectUserId: c.userId,
      detail: "Epikriz/taburcu raporu üretildi", ...reqMeta(req),
    });

    return NextResponse.json({ report, structured, savedAt: dischargeAt.toISOString() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "AI hatası" }, { status: 502 });
  }
}
