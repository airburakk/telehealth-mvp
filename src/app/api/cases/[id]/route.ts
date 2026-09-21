import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { caseAccessLevel } from "@/lib/ownership";
import { casePreviewDto } from "@/lib/case-preview";
import { caseLogisticsDto } from "@/lib/case-logistics";
import { staffAccessClosed } from "@/lib/postop-access";
import { recordAccess, reqMeta } from "@/lib/audit";
import { decryptField, decryptCaseFields } from "@/lib/crypto";

// GET /api/cases/:id — vaka detayı
// Erişim: oturum zorunlu + erişim seviyesi (lib/ownership caseAccessLevel): hasta yalnız kendi vakası; doktor atanmış
// vakada TAM, aynı branştaki ATANMAMIŞ havuz vakasında yalnız KİMLİKSİZ önizleme DTO'su (K06 1C-a — A09 madde 10.1;
// kabul: POST /accept); koordinatör/yönetici yalnız LOJİSTİK DTO (K06 1C-b — A09 madde 10.2/10.4); Etik Kurul 403 (10.3).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  const { id } = await params;
  const item = await db.case.findUnique({
    where: { id },
    include: { doctor: true, consultations: { include: { doctor: true }, orderBy: { startedAt: "desc" } } },
  });
  if (!item) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });
  const level = await caseAccessLevel(user, item);
  if (level === "none") return NextResponse.json({ error: "Bu vakaya erişim yetkiniz yok." }, { status: 403 });

  // E2EE Faz 2A — post-op erişim daraltma: takip tamamlandıysa klinik personel erişimi kapalı (hasta-only, §0.1·3).
  const closed = await staffAccessClosed(id, user);
  if (closed.closed) {
    await recordAccess({ actor: user, action: "POSTOP_ACCESS_DENIED", resourceType: "CASE", resourceId: item.id, subjectUserId: item.userId, detail: `post-op kapalı (${closed.reason})`, ...reqMeta(req) });
    return NextResponse.json({ error: "Bu vakanın post-op takibi tamamlandı; klinik erişim hastaya devredildi." }, { status: 403 });
  }

  if (level === "preview") {
    // Havuz önizlemesi: kimlik/telefon/belge/triyaj yanıtı/gerekçe/epikriz/görüşme notu YOK; ad şikâyette maskeli.
    await recordAccess({ actor: user, action: "CASE_VIEW", resourceType: "CASE", resourceId: item.id, subjectUserId: item.userId, detail: "kimliksiz havuz önizlemesi (kabul öncesi)", ...reqMeta(req) });
    return NextResponse.json(
      casePreviewDto({
        id: item.id, branch: item.branch, urgency: item.urgency, country: item.country, language: item.language, status: item.status,
        createdAt: item.createdAt, durationText: item.durationText, attachments: item.attachments,
        symptoms: decryptField(item.symptoms), patientName: decryptField(item.patientName),
      }),
    );
  }

  if (level === "logistics") {
    // K06 1C-b: koordinatör/yönetici → LOJİSTİK DTO (A09 10.2/10.4) — şikâyet/triyaj yanıtı/belge/lab/epikriz/görüşme notu/sağlık beyanı YOK.
    await recordAccess({ actor: user, action: "CASE_VIEW", resourceType: "CASE", resourceId: item.id, subjectUserId: item.userId, detail: "lojistik görünüm (klinik içerik yok)", ...reqMeta(req) });
    return NextResponse.json(
      caseLogisticsDto({
        id: item.id, patientName: decryptField(item.patientName), patientPhone: item.patientPhone ? decryptField(item.patientPhone) : null,
        contactPreference: item.contactPreference, country: item.country, language: item.language, branch: item.branch, urgency: item.urgency,
        status: item.status, createdAt: item.createdAt, consultFee: item.consultFee, payMethod: item.payMethod, payStatus: item.payStatus,
        freeCare: item.freeCare, freeCareStatus: item.freeCareStatus, tourismPlan: item.tourismPlan, hospitalName: item.hospitalName,
        treatmentDaysMin: item.treatmentDaysMin, treatmentDaysMax: item.treatmentDaysMax, agencySentAt: item.agencySentAt,
        pendingDocs: item.pendingDocs, attachments: item.attachments,
        doctor: item.doctor ? { id: item.doctor.id, title: item.doctor.title, name: item.doctor.name, branch: item.doctor.branch } : null,
      }),
    );
  }

  await recordAccess({ actor: user, action: "CASE_VIEW", resourceType: "CASE", resourceId: item.id, subjectUserId: item.userId, ...reqMeta(req) });
  // Klinik alanlar (kimlik + semptom/gerekçe/extra + epikriz) at-rest şifreli → tek-kaynak helper ile çöz
  // (T9: dischargeReport/Structured + patientName dahil; consultation notları ayrı). Tüketici düz metin bekler.
  return NextResponse.json({
    ...decryptCaseFields(item),
    consultations: item.consultations.map((co) => ({ ...co, notes: decryptField(co.notes) })),
  });
}
