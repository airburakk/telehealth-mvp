import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { notifyUser } from "@/lib/notify";
import { branchKeyFromLabel } from "@/lib/procedures";

// POST /api/cases/:id/tourism-outreach — sağlık turizmi ilk-temas (2026-07-14).
// Branş havuzundaki DOKTOR, tourism-Case'e tanıtım mesajı + opsiyonel video randevu teklifi gönderir.
// ÇOKLU doktor aynı vakaya outreach yapabilir; her biri ayrı TourismOutreach kaydı + hastaya bildirim.
// Hasta bekleme ekranında hepsini görür, bir video teklifini kabul eder (respond ucu).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  if (!["DOCTOR", "ADMIN"].includes(user.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });

  const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  if (!me?.doctorId) return NextResponse.json({ error: "Doktor profili yok." }, { status: 403 });

  const { id } = await params;
  const [doc, c] = await Promise.all([
    db.doctor.findUnique({ where: { id: me.doctorId }, select: { branch: true, name: true, title: true, verified: true } }),
    db.case.findUnique({ where: { id }, select: { userId: true, branch: true, tourismPlan: true } }),
  ]);
  if (!doc || !c) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
  if (!doc.verified) return NextResponse.json({ error: "Hesabınız henüz doğrulanmadı." }, { status: 403 });
  // Yalnız sağlık turizmi vakası (tourismPlan != null = turizm ayırt edici) + doktorun kendi branş havuzu.
  if (!c.tourismPlan) return NextResponse.json({ error: "Bu bir sağlık turizmi vakası değil." }, { status: 400 });
  if (branchKeyFromLabel(doc.branch) !== branchKeyFromLabel(c.branch)) {
    return NextResponse.json({ error: "Bu vaka sizin branş havuzunuzda değil." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return NextResponse.json({ error: "Lütfen bir tanıtım mesajı yazın." }, { status: 400 });
  if (message.length > 2000) return NextResponse.json({ error: "Mesaj çok uzun (en fazla 2000 karakter)." }, { status: 400 });

  let proposedAt: Date | null = null;
  if (body.proposedAt) {
    const d = new Date(body.proposedAt);
    if (isNaN(d.getTime())) return NextResponse.json({ error: "Geçerli bir tarih/saat girin." }, { status: 400 });
    if (d.getTime() < Date.now() - 60_000) return NextResponse.json({ error: "Geçmiş bir zaman seçilemez." }, { status: 400 });
    proposedAt = d;
  }

  const created = await db.tourismOutreach.create({
    data: { caseId: id, doctorId: me.doctorId, message, proposedAt, status: "SENT" },
  });

  // Hastaya bildirim (uygulama-içi + push + kanal; body PHI değil — doktor tanıtımı).
  if (c.userId) {
    const drName = `${doc.title ?? ""} ${doc.name}`.trim();
    await notifyUser(c.userId, {
      type: proposedAt ? "TOURISM_OFFER" : "TOURISM_MESSAGE",
      title: proposedAt ? "Video görüşme teklifi" : "Doktordan mesaj",
      body: proposedAt
        ? `${drName} sizinle video görüşme önerdi. Talebinizi görüntüleyin.`
        : `${drName} sağlık turizmi talebinize mesaj gönderdi.`,
      href: `/vaka/${id}`,
    });
  }

  return NextResponse.json({ ok: true, id: created.id, status: "SENT" }, { status: 201 });
}
