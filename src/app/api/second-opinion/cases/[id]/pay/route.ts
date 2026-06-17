import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ownsSecondOpinionCase } from "@/lib/ownership";
import { BRANCHES } from "@/lib/triage";
import { SO_CURRENCY, SO_FEE_USD } from "@/lib/second-opinion";
import { logSoEvent, transitionSoCase, SoError } from "@/lib/second-opinion-service";
import { notifyRoles } from "@/lib/notify";

// POST /api/second-opinion/cases/[id]/pay — peşin ödeme (SİMÜLE). 600 USD tek ödeme (§11).
// DRAFT → AWAITING_PAYMENT → PENDING_REVIEW (ödeme onayıyla vaka inceleme boru hattına girer).
// İade politikası PARK (§9.1) → REFUNDED durumu ileride. Kart verisi modülde TUTULMAZ.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  const c = await db.secondOpinionCase.findUnique({ where: { id }, include: { payment: true } });
  if (!c) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });
  if (!ownsSecondOpinionCase(user, c)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  if (c.payment?.status === "PAID") return NextResponse.json({ error: "Bu vaka için ödeme zaten alınmış." }, { status: 409 });
  if (!["DRAFT", "AWAITING_PAYMENT"].includes(c.status)) {
    return NextResponse.json({ error: "Ödeme bu aşamada alınamaz." }, { status: 409 });
  }

  const now = new Date();
  const providerRef = "SIM-" + Math.random().toString(36).slice(2, 10).toUpperCase();
  await db.secondOpinionPayment.upsert({
    where: { caseId: id },
    create: { caseId: id, amount: SO_FEE_USD, currency: SO_CURRENCY, status: "PAID", providerRef, paidAt: now },
    update: { status: "PAID", providerRef, paidAt: now },
  });

  try {
    if (c.status === "DRAFT") {
      await transitionSoCase(id, "AWAITING_PAYMENT", { actorId: user.id, actorRole: user.role, data: { paidAt: now } });
    }
    await transitionSoCase(id, "PENDING_REVIEW", { actorId: user.id, actorRole: user.role });
  } catch (e) {
    if (e instanceof SoError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  await logSoEvent(id, { actorId: user.id, actorRole: user.role, action: "PAYMENT", detail: `PAID ${SO_FEE_USD} ${SO_CURRENCY} (${providerRef})` });

  const branchLabel = BRANCHES.find((b) => b.key === c.branch)?.label ?? c.branch;
  await notifyRoles(["COORDINATOR"], {
    type: "SO_REVIEW",
    title: "🩺 Yeni İkinci Görüş vakası",
    body: `${branchLabel} · belge incelemesi bekliyor`,
    href: "/operasyon",
  });

  return NextResponse.json({ ok: true, status: "PENDING_REVIEW", providerRef });
}
