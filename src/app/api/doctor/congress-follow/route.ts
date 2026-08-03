import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { normalizeAlertDays } from "@/lib/doctorium";

// Doctorium Modül E (v6.49) — kongre takibi + alarm tercihleri.
// Self-auth (middleware /api'yi korumaz): yalnız DOCTOR + kendi Doctor kaydı.
async function myDoctorId(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") return null;
  const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  return me?.doctorId ?? null;
}

// POST — takip aç/kapat (body: {congressId, follow}) VEYA alarm tercihi (body: {alertDays, deadlineAlertDays}).
export async function POST(req: Request) {
  const doctorId = await myDoctorId();
  if (!doctorId) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const b = await req.json().catch(() => ({}));

  // (a) Alarm tercihleri — üç AYRI eşik (v6.62, kullanıcı isteği): başlangıç · bildiri · erken
  // kayıt. Bildiri hazırlamak haftalar sürer, erken kayıt tek işlemdir → aynı gün sayısı ikisine
  // de doğru gelmiyordu. Eşikler her kongrenin KENDİ tarihine uygulanır (lib/congress-reminder).
  // null/geçersiz = o alarm kapalı.
  if ("alertDays" in b || "abstractAlertDays" in b || "earlyBirdAlertDays" in b) {
    const congressAlertDays = normalizeAlertDays(b.alertDays);
    const congressAbstractAlertDays = normalizeAlertDays(b.abstractAlertDays);
    const congressEarlyBirdAlertDays = normalizeAlertDays(b.earlyBirdAlertDays);
    await db.doctor.update({
      where: { id: doctorId },
      data: { congressAlertDays, congressAbstractAlertDays, congressEarlyBirdAlertDays },
    });
    // Eşik değişince önceki "gönderildi" işaretleri anlamını yitirir (hekim daha erken uyarılmak
    // isteyebilir) → sıfırla, yeni eşiğe göre yeniden değerlendirilsin.
    await db.congressFollow.updateMany({ where: { doctorId }, data: { sentAlerts: "[]" } });
    return NextResponse.json({ ok: true, congressAlertDays, congressAbstractAlertDays, congressEarlyBirdAlertDays });
  }

  // (b) Takip aç/kapat
  const congressId = typeof b.congressId === "string" ? b.congressId : "";
  if (!congressId) return NextResponse.json({ error: "congressId gerekli." }, { status: 400 });
  const exists = await db.medicalCongress.findUnique({ where: { id: congressId }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Kongre bulunamadı." }, { status: 404 });

  if (b.follow === false) {
    await db.congressFollow.deleteMany({ where: { doctorId, congressId } });
    return NextResponse.json({ ok: true, following: false });
  }
  await db.congressFollow.upsert({
    where: { doctorId_congressId: { doctorId, congressId } },
    create: { doctorId, congressId },
    update: {},
  });
  return NextResponse.json({ ok: true, following: true });
}
