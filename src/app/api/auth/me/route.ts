import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isMaster } from "@/lib/master";
import { db } from "@/lib/db";
import { currentDoctoriumAudience } from "@/lib/doctorium-audience";

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

  // Üç katman (2026-09-05): Header'ın deneme rozeti (+ B1 öğrenci kancası) — kozmetik, kapı değil.
  let audience: string | null = null;
  let trial: { daysLeft: number; endsAtLabel: string } | null = null;
  if (user.role === "DOCTOR") {
    try {
      const ctx = await currentDoctoriumAudience();
      audience = ctx?.audience ?? null;
      trial = ctx?.trial ? { daysLeft: ctx.trial.daysLeft, endsAtLabel: ctx.trial.endsAtLabel } : null;
    } catch {
      audience = null;
      trial = null;
    }
  }

  return NextResponse.json({
    user: { name: user.name, role: user.role },
    lang,
    student,
    stage1,
    audience,
    trial,
    imp: !!user.imp,
    isMaster: isMaster(user),
  });
}
