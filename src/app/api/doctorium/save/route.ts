import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasDoctoriumAccess } from "@/lib/doctor-activation";

// Doctorium "Kaydettiklerim" toggle'ı (Faz 2, 2026-08-14). Middleware /api'yi KORUMAZ —
// route kendi auth'unu yapar (proje kuralı): DOCTOR + doktor profili + Doctorium Aşama-1
// kapısı (derinlik savunması; sayfa kapısıyla aynı şart). Öğrenci-sınırlı üye KAYDEDEBİLİR
// (içerik işlevi — pazarlama yüzeyi değil). Puan ÜRETMEZ.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  const doctor = me?.doctorId
    ? await db.doctor.findUnique({
        where: { id: me.doctorId },
        select: { id: true, diplomaVerifiedAt: true, studentVerifiedAt: true, doctoriumOptOutAt: true },
      })
    : null;
  if (!doctor || !hasDoctoriumAccess(doctor)) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const articleId = typeof body?.articleId === "string" ? body.articleId : "";
  if (!articleId) return NextResponse.json({ error: "articleId gerekli" }, { status: 400 });

  // Üç kaynaklı kimlik (2026-08-14, 2. tur): makale id'si · kongre id'si · kariyer SLUG'ı —
  // SavedArticle ilişkisiz düz-id deseninde tür kolonu gerekmez; savedFeed üç tabloda arar.
  const [article, congress, pathway] = await Promise.all([
    db.newsArticle.findUnique({ where: { id: articleId }, select: { id: true } }),
    db.medicalCongress.findUnique({ where: { id: articleId }, select: { id: true } }),
    db.careerPathway.findUnique({ where: { slug: articleId }, select: { slug: true } }),
  ]);
  if (!article && !congress && !pathway) {
    return NextResponse.json({ error: "İçerik bulunamadı" }, { status: 404 });
  }

  const existing = await db.savedArticle.findUnique({
    where: { doctorId_articleId: { doctorId: doctor.id, articleId } },
    select: { id: true },
  });
  if (existing) {
    await db.savedArticle.delete({ where: { id: existing.id } });
    return NextResponse.json({ saved: false });
  }
  await db.savedArticle.create({ data: { doctorId: doctor.id, articleId } });
  return NextResponse.json({ saved: true });
}
