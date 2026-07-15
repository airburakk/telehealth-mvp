import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canCaseBeAccessedBy } from "@/lib/ownership";
import { terminateCase } from "@/lib/clinical-duty";

// POST /api/cases/:id/terminate — 3-seçenek kapısı, Seçenek 3: Süreci sonlandır → veriyi sil + ücret iadesi.
// Gerçek crypto-shred (anahtar imhası) + gerçek escrow iadesi PARK (E2EE fazı / ödeme gateway).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const c = await db.case.findUnique({ where: { id }, select: { userId: true, doctorId: true, branch: true, deletionLockedAt: true } });
  if (!c) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });
  if (!(await canCaseBeAccessedBy(user, c))) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });

  const r = await terminateCase(id);
  if (!r) return NextResponse.json({ error: "Bu vaka bu aşamada silinemez." }, { status: 409 });
  return NextResponse.json({ ok: true, refunded: r.refunded });
}
