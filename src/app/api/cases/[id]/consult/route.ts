import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canStartConsultation } from "@/lib/ownership";
import { staffAccessClosed } from "@/lib/postop-access";
import { recordAccess, reqMeta } from "@/lib/audit";

// POST /api/cases/:id/consult — vaka için görüşme başlat / mevcut aktif görüşmeye katıl.
//
// Kontrol raporu 2026-09-19 D03 (P1): bu uç OKUMA kapısıyla (canCaseBeAccessedBy) korunuyordu ve durum
// geçişine bakmıyordu → tamamlanmış (DONE) vaka yeniden IN_CONSULT'a yazılabiliyor, hasta rolü de aynı yazım
// yoluna ulaşıyor, atanmamış vakaya "ilk doğrulanmış doktor" (yabancı branş dahil) atanıyordu.
// Artık:
//   · yetki = `canStartConsultation` (YAZMA kapısı: hasta yalnız atanmış doktorla katılır; doktor kendi
//     vakası veya kendi branş havuzu [üstlenme = atama]; koordinatör/admin yalnız atanmış vakada),
//   · post-op kapanışı (E2EE Faz 2A) personel için 403 + audit,
//   · aktif görüşme varsa ona katılınır (idempotent, durumdan bağımsız),
//   · yeni görüşme YALNIZ NEW/IN_REVIEW'dan açılır (DONE → 409; yeniden açma AYRI süreçtir),
//   · geçiş ATOMİK: durum-koşullu updateMany (yarışı kaybeden 409) + consultation aynı işlemde,
//   · her açılış CONSULT_START olarak denetim zincirine yazılır.
const START_FROM = ["NEW", "IN_REVIEW"] as const;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  const { id } = await params;
  const caseItem = await db.case.findUnique({
    where: { id },
    select: {
      id: true, userId: true, doctorId: true, branch: true, status: true, deletionLockedAt: true,
      consultations: { where: { status: "ACTIVE" }, select: { id: true }, orderBy: { startedAt: "desc" }, take: 1 },
    },
  });
  if (!caseItem) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });

  const verdict = await canStartConsultation(user, caseItem);
  if (!verdict.ok) return NextResponse.json({ error: verdict.error }, { status: verdict.status });

  // E2EE Faz 2A — post-op takip kapandıysa klinik personel görüşme de açamaz (hasta muaf — helper PATIENT'a false döner).
  const closed = await staffAccessClosed(id, user);
  if (closed.closed) {
    await recordAccess({ actor: user, action: "POSTOP_ACCESS_DENIED", resourceType: "CASE", resourceId: id, subjectUserId: caseItem.userId, detail: `post-op kapalı (${closed.reason}) — consult`, ...reqMeta(req) });
    return NextResponse.json({ error: "Bu vakanın post-op takibi tamamlandı; klinik erişim hastaya devredildi." }, { status: 403 });
  }

  // Aktif görüşme varsa ona katıl — yeni kayıt açılmaz (idempotent; kopuk bağlantı sonrası yeniden giriş).
  const active = caseItem.consultations[0];
  if (active) return NextResponse.json({ consultationId: active.id }, { status: 200 });

  // Durum makinesi: yeni görüşme yalnız açık (NEW/IN_REVIEW) vakada.
  if (!(START_FROM as readonly string[]).includes(caseItem.status)) {
    const error =
      caseItem.status === "DONE"
        ? "Bu vaka tamamlanmış; yeniden görüşme için vakanın yeniden açılması gerekir."
        : caseItem.status === "DOCS_PENDING"
          ? "Belgeler tamamlanmadan görüşme başlatılamaz."
          : "Bu vakada açık görüşme kaydı bulunamadı; sayfayı yenileyin.";
    return NextResponse.json({ error }, { status: 409 });
  }

  // Atomik geçiş: durum koşullu updateMany — eşzamanlı ikinci istek count=0 alır, ikinci görüşme oluşmaz.
  const created = await db.$transaction(async (tx) => {
    const upd = await tx.case.updateMany({
      where: { id, status: { in: [...START_FROM] } },
      data: { status: "IN_CONSULT", doctorId: verdict.doctorId },
    });
    if (upd.count !== 1) return null;
    return tx.consultation.create({ data: { caseId: id, doctorId: verdict.doctorId }, select: { id: true } });
  });
  if (!created) {
    return NextResponse.json({ error: "Vaka durumu bu sırada değişti; sayfayı yenileyip tekrar deneyin." }, { status: 409 });
  }

  await recordAccess({
    actor: user, action: "CONSULT_START", resourceType: "CASE", resourceId: id, subjectUserId: caseItem.userId,
    detail: `görüşme açıldı · atama=${verdict.assigned}`, ...reqMeta(req),
  });
  return NextResponse.json({ consultationId: created.id }, { status: 201 });
}
