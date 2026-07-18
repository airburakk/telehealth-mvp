import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canCaseBeAccessedBy } from "@/lib/ownership";
import { recordAccess, reqMeta } from "@/lib/audit";

// POST /api/cases/:id/recovery/complete — post-op takibi tamamla → klinik personel erişimi kapanır (E2EE Faz 2A).
// Tetikleyici: MANUEL (doktor "Takibi tamamla"). Otomatik yedek ayrıca lib/postop-access.recoveryClosed ile lazy hesaplanır.
// §0.1·3: tamamlanınca erişim yalnız hastaya döner (tedavi doktoru dahil personel kapanır). Mantıksal+audit'li (2A).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  // Tamamlamayı yalnız klinik personel (tedavi/takip ekibi) tetikler — hasta değil.
  if (user.role === "PATIENT") return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });

  const c = await db.case.findUnique({ where: { id }, select: { id: true, userId: true, doctorId: true, branch: true, deletionLockedAt: true } });
  if (!c) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });
  // BOLA düzeltmesi (2026-07-18 denetimi): rol tek başına yetmez — kardeş rotalarla (coding/labs/
  // documents) simetri. Doktor yalnız kendisine atanmış/kuyruk vakasının post-op takibini kapatabilir;
  // aksi halde atanmamış bir doktor rastgele vakanın takibini kapatıp tedavi ekibi erişimini kesebilir.
  if (!(await canCaseBeAccessedBy(user, c))) {
    return NextResponse.json({ error: "Bu vakaya erişim yetkiniz yok." }, { status: 403 });
  }

  const recovery = await db.recovery.findUnique({ where: { caseId: id } });
  if (!recovery) return NextResponse.json({ error: "Bu vakada post-op takip yok." }, { status: 404 });
  if (recovery.status === "COMPLETED") return NextResponse.json({ ok: true, alreadyCompleted: true });

  await db.recovery.update({
    where: { caseId: id },
    data: { status: "COMPLETED", completedAt: new Date(), completedBy: user.id },
  });

  // Yaşam-döngüsü olayını değiştirilemez audit'e mühürle (hash-zinciri + zaman damgası).
  const meta = reqMeta(req);
  await recordAccess({
    actor: user,
    action: "RECOVERY_COMPLETE",
    resourceType: "RECOVERY",
    resourceId: recovery.id,
    subjectUserId: c.userId,
    detail: "post-op takip tamamlandı → klinik personel erişimi kapandı (hasta-only)",
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return NextResponse.json({ ok: true });
}
