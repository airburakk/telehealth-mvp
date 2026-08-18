import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// v6.95 — Mezuniyet geçişi: öğrenci hunisinden açılmış hesabın studentTrack işaretini kapatır →
// /doktor/baslangic normal doktor onboarding'ine (diploma + ihtiyari MMSS blokları) döner. Erişim/
// damga DEĞİŞMEZ (studentVerifiedAt durur; klinik kapı yine zorunlu belgeyi ister [v6.105'ten beri
// yalnız diploma] — bu uç yetki AÇMAZ,
// yalnız onboarding modunu değiştirir). Self-auth: yalnız kendi hesabı; geri dönüşü yok (tekrar
// öğrenci moduna dönmek gerekirse yeni karar konusu — bilinçli tek yön).
export async function POST() {
  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  if (!me?.doctorId) return NextResponse.json({ error: "Doktor profili bağlı değil." }, { status: 400 });

  const d = await db.doctor.findUnique({ where: { id: me.doctorId }, select: { studentTrack: true } });
  if (!d) return NextResponse.json({ error: "Doktor profili bulunamadı." }, { status: 400 });
  if (!d.studentTrack) return NextResponse.json({ ok: true, already: true }); // idempotent — zaten doktor modunda

  await db.doctor.update({ where: { id: me.doctorId }, data: { studentTrack: false } });
  return NextResponse.json({ ok: true });
}
