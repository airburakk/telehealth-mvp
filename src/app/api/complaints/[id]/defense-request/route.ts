import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { resolveDefenseTarget, sendSystemMessage } from "@/lib/system-messages";
import { maskCaseId, RESPONDENT_TYPES, DEFENSE_LOCK_DAYS } from "@/lib/ethics";
import { recordAccess, reqMeta } from "@/lib/audit";

// POST /api/complaints/:id/defense-request — Etik Kurul karşı taraftan savunma/bilgi talep eder (v6.79).
// Yetki: YALNIZ ETHICS/ADMIN. Talep, hastanın bildirdiği karşı tarafa sistem mesajı olarak düşer
// (yönlendirme: lib/system-messages resolveDefenseTarget). Kurul karşı taraf KİMLİĞİNİ görmez.
// Talep açılınca karar formu kilitlenir: yanıt gelince VEYA 3 gün dolunca açılır (defenseLockState).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  if (!["ETHICS", "ADMIN"].includes(user.role)) return NextResponse.json({ error: "Yalnız Etik Kurul talep açabilir." }, { status: 403 });

  const complaint = await db.complaint.findUnique({
    where: { id },
    include: { case: { select: { userId: true, doctorId: true } } },
  });
  if (!complaint) return NextResponse.json({ error: "Başvuru bulunamadı." }, { status: 404 });
  if (complaint.status === "RESOLVED") return NextResponse.json({ error: "Karara bağlanmış başvuruda talep açılamaz." }, { status: 400 });

  const b = await req.json().catch(() => ({}));
  const note = String(b.note ?? "").trim();
  if (note.length < 10) return NextResponse.json({ error: "Talep metni en az 10 karakter olmalıdır." }, { status: 400 });

  const target = await resolveDefenseTarget(complaint.respondentType, complaint.case.doctorId);
  const typeLabel = RESPONDENT_TYPES[complaint.respondentType ?? ""] ?? "İlgili taraf";
  const ref = maskCaseId(complaint.caseId);

  // Gövde ŞİFRELİ saklanır → serbest metin güvenli. Koordinatöre düşen vekil taleplerde
  // (hastane/platform/atanmamış doktor) yönlendirme notu gövdeye eklenir.
  const viaCoordinator = target.role === "COORDINATOR" && complaint.respondentType !== "OTHER";
  const body =
    `Etik Kurul, ${ref} referanslı başvuru kapsamında "${typeLabel}" tarafından savunma/bilgi talep etmektedir.\n\n` +
    `Kurulun talebi:\n${note}\n\n` +
    (viaCoordinator ? `Not: Bu taraf platformda hesap sahibi olmadığından (veya vakaya atanmış hesap bulunmadığından) talep operasyon koordinatörlüğüne iletilmiştir; yanıtı ilgili taraftan temin edip buradan giriniz.\n\n` : "") +
    `Yanıtınız kurula, kimliğiniz gösterilmeden ("Karşı taraf — ${typeLabel}" etiketiyle) iletilir. ` +
    `Yanıt penceresi: talep tarihinden itibaren ${DEFENSE_LOCK_DAYS} gündür; süre dolduğunda kurul yanıtsız da karar verebilir.`;

  const messageId = await sendSystemMessage({
    target,
    kind: "DEFENSE_REQUEST",
    subject: `Savunma/bilgi talebi — ${ref}`,
    body,
    threadKey: `complaint:${complaint.id}`,
    needsReply: true,
  });
  if (!messageId) return NextResponse.json({ error: "Talep oluşturulamadı." }, { status: 500 });

  // Audit: içerik YAZILMAZ — yalnız kim/hangi başvuru/hangi taraf tipi (değiştirilemez zincir).
  await recordAccess({
    actor: user,
    action: "DEFENSE_REQUEST",
    resourceType: "COMPLAINT",
    resourceId: complaint.id,
    subjectUserId: complaint.case.userId ?? null,
    detail: complaint.respondentType ?? "UNSPECIFIED",
    ...reqMeta(req),
  });

  return NextResponse.json({ ok: true, messageId }, { status: 201 });
}
