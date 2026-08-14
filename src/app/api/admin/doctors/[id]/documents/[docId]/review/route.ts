import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { notifyUser } from "@/lib/notify";
import { recordAccess, reqMeta } from "@/lib/audit";

// POST — hekim mesleki belgesine inceleme kararı (Faz 2, 2026-08-14): ACCEPTED | REJECTED.
// Karar yalnız görünürlük+bildirim içindir; AKTİVASYONA DOKUNMAZ (tasarım kararı — refreshActivation
// belge varlığına bakar, reddedilen tekil belge yenisi yüklenince satırıyla değişir → PENDING).
// Self-auth raw ucuyla aynı: yalnız ETHICS/ADMIN, diğer herkese 404 (varlık gizlenir).
const REVIEWER_ROLES = ["ETHICS", "ADMIN"];
const DOC_TYPE_TR: Record<string, string> = {
  DIPLOMA: "Diploma", MMSS: "MMSS poliçesi", CHAMBER: "Tabip odası yazısı",
  STUDENT_CERT: "Öğrenci belgesi", CERTIFICATE: "Sertifika", ACADEMIC: "Akademik çalışma",
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params;
  const user = await getCurrentUser();
  if (!user || !REVIEWER_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
  }

  const doc = await db.doctorDocument.findUnique({
    where: { id: docId },
    select: { id: true, doctorId: true, type: true, label: true },
  });
  if (!doc || doc.doctorId !== id) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const status = String(b.status ?? "");
  const note = (b.note ? String(b.note) : "").trim().slice(0, 500);
  if (status !== "ACCEPTED" && status !== "REJECTED") {
    return NextResponse.json({ error: "Geçersiz karar (ACCEPTED | REJECTED)." }, { status: 400 });
  }
  if (status === "REJECTED" && !note) {
    return NextResponse.json({ error: "Yetersiz kararı gerekçe ister — doktora bildirimle gider." }, { status: 400 });
  }

  await db.doctorDocument.update({
    where: { id: docId },
    data: { status, reviewNote: status === "REJECTED" ? note : null },
  });

  // Denetim izi — gerekçe metni audit detail'ine KOYULMAZ (asla-loglama disiplini; içerik reviewNote'ta).
  const u = await db.user.findFirst({ where: { doctorId: id }, select: { id: true } });
  await recordAccess({
    actor: user, action: "DOCTOR_DOC_REVIEW", resourceType: "DOCTOR", resourceId: id,
    subjectUserId: u?.id ?? null, detail: `belge=${doc.type}:${doc.label.slice(0, 80)} karar=${status}`, ...reqMeta(req),
  });

  // Yalnız REJECTED bildirir (ACCEPTED sessiz — nihai müjde zaten verify bildirimi).
  // ⚖️ Bildirim dili TASLAK — nihai şablon v6.91 hukuk paketiyle onaylanacak.
  if (status === "REJECTED" && u) {
    const typeTr = DOC_TYPE_TR[doc.type] ?? doc.type;
    await notifyUser(u.id, {
      type: "DOC_REJECTED",
      title: "📄 Belgeniz yeniden yükleme bekliyor",
      body: `${typeTr} belgeniz incelemede yetersiz bulundu: ${note} — Lütfen güncel/okunaklı belgeyi yeniden yükleyin.`,
      href: "/doktor/baslangic",
    });
  }

  return NextResponse.json({ ok: true, status });
}
