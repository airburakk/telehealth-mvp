import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifyRoles } from "@/lib/notify";
import { isCurrentUserCasePatient } from "@/lib/ownership";
import { RESPONDENT_TYPES } from "@/lib/ethics";
import { encryptField } from "@/lib/crypto";

// POST /api/cases/:id/complaint — Etik Kurul'a başvuru oluştur
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db.case.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });
  // HASTA-ONLY (2026-08-03, kullanıcı kararı): Etik Kurul başvurusu hastanın kendi iradesidir —
  // hakkında şikayet edilebilecek personel onun adına başvuru açamamalı (eski hâli OKUMA kapısıydı).
  if (!(await isCurrentUserCasePatient(c))) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const subject = String(b.subject ?? "").trim();
  const description = String(b.description ?? "").trim();
  if (!subject || !description) {
    return NextResponse.json({ error: "Konu ve açıklama zorunludur." }, { status: 400 });
  }
  // İlgili/karşı taraf ZORUNLU (v6.79) — kurulun savunma/bilgi talebi bu tarafa yönlenir.
  const respondentType = String(b.respondentType ?? "");
  if (!Object.keys(RESPONDENT_TYPES).includes(respondentType)) {
    return NextResponse.json({ error: "İlgili/karşı taraf seçimi zorunludur." }, { status: 400 });
  }

  const latestBooking = await db.booking.findFirst({ where: { caseId: c.id }, orderBy: { createdAt: "desc" } });

  // Şikayet metni (subject/description/evidence) at-rest ŞİFRELİ (2026-08-28 — savunma gövde/yanıtı
  // ile aynı korumaya kavuştu; tutarlılık borcuydu). encryptField idempotent/kademeli-geçişli:
  // eski düz-metin satırlar decryptField'de "enc:" öneki olmadığından aynen döner — backfill şart değil.
  const complaint = await db.complaint.create({
    data: {
      caseId: c.id,
      bookingId: latestBooking?.id ?? null,
      subject: encryptField(subject),
      description: encryptField(description),
      requestType: ["REFUND", "DOCTOR_CHANGE", "HOSPITAL_CHANGE", "OTHER"].includes(b.requestType) ? b.requestType : "OTHER",
      respondentType,
      evidence: b.evidence ? encryptField(String(b.evidence)) : null,
    },
  });

  await notifyRoles(["ETHICS"], {
    type: "COMPLAINT",
    title: "⚖️ Yeni şikayet başvurusu",
    body: subject.slice(0, 80),
    href: `/etik-kurul/${complaint.id}`,
  });

  return NextResponse.json({ complaintId: complaint.id }, { status: 201 });
}
