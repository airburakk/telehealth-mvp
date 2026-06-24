import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { recordAccess, reqMeta } from "@/lib/audit";
import { recoveryClosed } from "@/lib/postop-access";

// POST /api/cases/:id/recovery/reopen — hasta post-op erişimini yeniden açar → klinik personel erişimi geri verilir
// (E2EE Faz 2A geri-alma). §6.2: takibi KAPATMA klinik kararıdır (personel tetikler), AÇMA ise HASTA kararıdır
// (hasta-merkezli kontrol; klinik personel kendi erişimini geri açamaz → daraltmanın anlamı korunur).
// reopenedAt set edilince otomatik kapanma penceresi o andan yeniden başlar (lib/postop-access.recoveryClosed).
// Mantıksal + audit'li (kriptografik DEĞİL): yalnız İLERİYE dönük yeni erişimi açar; kapalıyken görülmeyen veri yeniden erişilebilir olur.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  const c = await db.case.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!c) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });

  // Yeniden açmayı yalnız vaka sahibi hasta (veya ADMIN) tetikler — klinik personel kendi erişimini geri açamaz.
  const isOwner = user.role === "PATIENT" && c.userId === user.id;
  if (!isOwner && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yalnızca vaka sahibi erişimi yeniden açabilir." }, { status: 403 });
  }

  const recovery = await db.recovery.findUnique({ where: { caseId: id } });
  if (!recovery) return NextResponse.json({ error: "Bu vakada post-op takip yok." }, { status: 404 });

  // Zaten açıksa (klinik personel hâlâ erişebiliyorsa) yeniden açmak gereksiz — no-op.
  if (!recoveryClosed(recovery).closed) return NextResponse.json({ ok: true, alreadyOpen: true });

  await db.recovery.update({
    where: { caseId: id },
    data: { status: "ACTIVE", completedAt: null, completedBy: null, reopenedAt: new Date() },
  });

  // Yaşam-döngüsü olayını değiştirilemez audit'e mühürle (hash-zinciri + zaman damgası).
  const meta = reqMeta(req);
  await recordAccess({
    actor: user,
    action: "RECOVERY_REOPEN",
    resourceType: "RECOVERY",
    resourceId: recovery.id,
    subjectUserId: c.userId,
    detail: "hasta post-op erişimini yeniden açtı → klinik personel erişimi geri verildi (geri-alma)",
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return NextResponse.json({ ok: true });
}
