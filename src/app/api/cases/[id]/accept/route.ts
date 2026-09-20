import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { clinicalDoctorFor } from "@/lib/doctor-activation";
import { DOCTOR_POOL_STATUSES } from "@/lib/case-access";
import { deletionLocked } from "@/lib/account-deletion";
import { recordAccess, reqMeta } from "@/lib/audit";

// POST /api/cases/:id/accept — havuzdaki (atanmamış, KENDİ branşı) vakayı ÜSTLENME (K06 1C-a, 2026-09-20).
//
// Personel metni A09 madde 10.1: doktor yalnız "size atanan veya kabul ettiğiniz" başvuruların klinik verisine erişir;
// havuzda yalnız kimliksiz önizleme görür. Kabul = atama (Case.doctorId) → erişim seviyesi "preview" → "full"
// (lib/ownership caseAccessLevel). Görüşmeyi doğrudan başlatmak (POST /consult) da havuz vakasını atar ("kabul
// ettiğiniz"); bu uç doktorun görüşme AÇMADAN dosyayı üstlenip incelemesi içindir.
//   · yalnız DOCTOR (doğrulanmış + klinik-aktive — clinicalDoctorFor; boş branş fail-closed) · yabancı branş 403
//   · silme kilidi 404 (vakanın varlığını ele vermez) · zaten bana atanmış → 200 (idempotent, yazım yok)
//   · başkasına atanmış → 409 · durum NEW/IN_REVIEW dışı (DOCS_PENDING/IN_CONSULT/DONE) → 409
//   · geçiş ATOMİK: doctorId:null + branş + durum koşullu updateMany — yarışı kaybeden 409, çift atama olmaz
//   · her kabul CASE_ACCEPT olarak denetim zincirine yazılır (hasta /erisim-kaydi'nda görür).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  if (user.role !== "DOCTOR") return NextResponse.json({ error: "Yalnız doktorlar vaka üstlenebilir." }, { status: 403 });

  const { id } = await params;
  const c = await db.case.findUnique({
    where: { id },
    select: { id: true, userId: true, doctorId: true, branch: true, status: true, deletionLockedAt: true },
  });
  if (!c || deletionLocked(c)) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });

  const ctx = await clinicalDoctorFor(user.id);
  if (!ctx || !ctx.verified || !ctx.branch) {
    return NextResponse.json({ error: "Vaka üstlenmek için doğrulanmış ve klinik aktivasyonu tamamlanmış doktor hesabı gerekir." }, { status: 403 });
  }
  if (c.doctorId === ctx.doctorId) return NextResponse.json({ accepted: true, already: true }, { status: 200 });
  if (c.doctorId) return NextResponse.json({ error: "Bu vakayı başka bir doktor üstlendi." }, { status: 409 });
  if (c.branch !== ctx.branch) return NextResponse.json({ error: "Bu vaka branşınızın havuzunda değil." }, { status: 403 });
  if (!(DOCTOR_POOL_STATUSES as readonly string[]).includes(c.status)) {
    const error =
      c.status === "DOCS_PENDING"
        ? "Belgeler tamamlanmadan vaka üstlenilemez."
        : c.status === "DONE"
          ? "Bu vaka tamamlanmış; üstlenilemez."
          : "Bu vaka havuzda değil; sayfayı yenileyin.";
    return NextResponse.json({ error }, { status: 409 });
  }

  // Atomik atama: koşullar sorguda — eşzamanlı ikinci istek count=0 alır (409), vaka iki doktora atanmaz.
  const upd = await db.case.updateMany({
    where: { id, doctorId: null, branch: ctx.branch, status: { in: [...DOCTOR_POOL_STATUSES] } },
    data: { doctorId: ctx.doctorId },
  });
  if (upd.count !== 1) {
    return NextResponse.json({ error: "Vaka bu sırada başka bir doktor tarafından üstlenildi ya da durumu değişti; sayfayı yenileyin." }, { status: 409 });
  }

  await recordAccess({
    actor: user, action: "CASE_ACCEPT", resourceType: "CASE", resourceId: id, subjectUserId: c.userId,
    detail: "havuzdan üstlenme (kimliksiz önizleme → tam erişim)", ...reqMeta(req),
  });
  return NextResponse.json({ accepted: true }, { status: 200 });
}
