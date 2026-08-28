import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isMaster } from "@/lib/master";
import { db } from "@/lib/db";

// Header/MasterBar'ın kozmetik kullanıcı gösterimi (2026-08-28, P0-3 denetimi) — bu mantık
// eskiden kök layout.tsx'te SSR'de çalışıyordu; `cookies()` kullandığı için TÜM SİTEYİ dynamic'e
// zorluyordu (`/doctorium` sayfasındaki `revalidate=600` bu yüzden etkisizdi). Artık AppChrome
// bunu client-side'da mount'ta çeker. `getCurrentUser`/`requireUser` her korumalı sayfa/API'de
// AYRICA çalışır — bu route bir güvenlik kapısı DEĞİL, yalnızca kozmetik veri taşır.
export const dynamic = "force-dynamic";

export async function GET() {
  let user: Awaited<ReturnType<typeof getCurrentUser>> = null;
  try {
    user = await getCurrentUser();
  } catch {
    user = null;
  }
  if (!user) return NextResponse.json({ user: null });

  // Partner doktorun global Header'ı kendi dilinde (diğer roller Türkçe — useT no-op).
  let lang = "Türkçe";
  if (user.role === "PARTNER") {
    try {
      const u = await db.user.findUnique({ where: { id: user.id }, select: { partnerId: true } });
      const p = u?.partnerId ? await db.partnerDoctor.findUnique({ where: { id: u.partnerId }, select: { language: true } }) : null;
      lang = p?.language || "İngilizce";
    } catch {
      lang = "İngilizce";
    }
  }

  // v6.95/v6.105 — öğrenci hunisi + Aşama 1 kromu (bkz. eski layout.tsx yorumu, git geçmişi).
  let student = false;
  let stage1 = false;
  if (user.role === "DOCTOR") {
    try {
      const u = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
      const d = u?.doctorId
        ? await db.doctor.findUnique({ where: { id: u.doctorId }, select: { studentTrack: true, activatedAt: true } })
        : null;
      student = !!d?.studentTrack;
      stage1 = !!d && !d.studentTrack && !d.activatedAt;
    } catch {
      student = false;
      stage1 = false;
    }
  }

  return NextResponse.json({
    user: { name: user.name, role: user.role },
    lang,
    student,
    stage1,
    imp: !!user.imp,
    isMaster: isMaster(user),
  });
}
