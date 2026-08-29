import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { transitionRedemption, REDEMPTION_STATUSES, type RedemptionStatus } from "@/lib/rewards";

export const dynamic = "force-dynamic";

// Ödül talep kararları (v6.88) — ADMIN. Geçiş kuralları tek kaynakta (canTransitionRedemption):
// REQUESTED → APPROVED | REJECTED · APPROVED → FULFILLED | REJECTED. Ret/iptal iade üretir
// (transitionRedemption atomik). FULFILLED = ayni menfaatin İFA anı — TESLİMDEN sonra işaretlenir.
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const redemptionId = typeof b.redemptionId === "string" ? b.redemptionId : "";
  const to = typeof b.status === "string" ? b.status : "";
  const adminNote =
    typeof b.adminNote === "string" && b.adminNote.trim() ? b.adminNote.trim().slice(0, 500) : null;
  if (!redemptionId) return NextResponse.json({ error: "redemptionId zorunlu." }, { status: 400 });
  if (!(REDEMPTION_STATUSES as readonly string[]).includes(to)) {
    return NextResponse.json({ error: "Geçersiz durum." }, { status: 400 });
  }

  const r = await transitionRedemption({
    redemptionId,
    to: to as RedemptionStatus,
    byAdmin: true,
    adminNote,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status ?? 400 });
  return NextResponse.json({ ok: true });
}
