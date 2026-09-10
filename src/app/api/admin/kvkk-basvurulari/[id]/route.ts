import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { decideKvkkApplication } from "@/lib/kvkk-applications";

// KVKK m.11 başvuru kararı (2026-09-09) — /admin/kvkk-basvurulari "Yanıtla".
// Self-auth: yalnız ETHICS/ADMIN (proxy /admin'i korur ama /api'yi KORUMAZ — her uç kendi kapısı,
// admin/personel-onay/review deseni).
const REVIEWER_ROLES = ["ETHICS", "ADMIN"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || !REVIEWER_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const b = await req.json().catch(() => ({}));
  try {
    await decideKvkkApplication(id, user, String(b.decision ?? ""));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "İşlem tamamlanamadı." }, { status: 400 });
  }
}
