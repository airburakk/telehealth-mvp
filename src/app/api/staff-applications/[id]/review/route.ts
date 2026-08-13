import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { approveStaffApplication, rejectStaffApplication } from "@/lib/staff-application";
import { recordAccess, reqMeta } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { roleHome, type Role } from "@/lib/roles";

// Kurumsal başvuru kararı (2026-08-12) — /admin/personel-onay Onayla/Reddet.
// Self-auth: yalnız ETHICS/ADMIN (proxy /admin'i korur ama /api'yi KORUMAZ — her uç kendi kapısı).
// Onay: staffVerifiedAt damgası (+PARTNER'da PartnerDoctor bağlanır) + audit + başvurana bildirim.
const REVIEWER_ROLES = ["ETHICS", "ADMIN"];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || !REVIEWER_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const b = await req.json().catch(() => ({}));
  const action = String(b.action ?? "");
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
  }

  try {
    if (action === "approve") {
      const { userId, role } = await approveStaffApplication(id, user.id);
      await recordAccess({
        actor: user, action: "STAFF_APP_APPROVE", resourceType: "STAFF_APPLICATION", resourceId: id,
        subjectUserId: userId, detail: `rol=${role}`, ...reqMeta(req),
      });
      await notifyUser(userId, {
        type: "ACCOUNT_VERIFIED",
        title: "Kurumsal üyeliğiniz onaylandı",
        body: "Başvurunuz doğrulandı — panelinize giriş yapabilirsiniz.",
        href: roleHome(role as Role),
      });
      return NextResponse.json({ ok: true, status: "APPROVED" });
    }

    const note = String(b.note ?? "").trim();
    if (note.length < 3) {
      return NextResponse.json({ error: "Ret için kısa bir gerekçe yazın (başvurana gösterilir)." }, { status: 400 });
    }
    const { userId, role } = await rejectStaffApplication(id, user.id, note);
    await recordAccess({
      actor: user, action: "STAFF_APP_REJECT", resourceType: "STAFF_APPLICATION", resourceId: id,
      subjectUserId: userId, detail: `rol=${role}`, ...reqMeta(req),
    });
    await notifyUser(userId, {
      type: "STAFF_APPLICATION",
      title: "Başvurunuzda düzeltme istendi",
      body: "İnceleme notunu görüp başvurunuzu güncelleyebilirsiniz.",
      href: "/kayit/durum",
    });
    return NextResponse.json({ ok: true, status: "REJECTED" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "İşlem tamamlanamadı.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
