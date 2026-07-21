import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { recordAccess, reqMeta } from "@/lib/audit";
import { poolPreviewForCase, createRequestFromCase, processRequestAi, DicomRejectedError } from "@/lib/consultation-requests";

export const maxDuration = 60; // belge AI değerlendirme (POST sonrası) uzun sürebilir

// v6.33 Faz 3 — İç vakadan konsültasyon havuzuna açılma. YALNIZ vakaya ATANAN doktor (kullanıcı
// kararı 2026-07-21): havuza açma klinik bir karardır. deletionLockedAt kilitli vaka açılamaz.
// GET  → panel ön-dolumu: deidentifyCase anonim özet taslağı + seçilebilir belge listesi
// POST → { summary, docIds, dicomConfirm } — DICOM seçiliyse burned-in beyanı ZORUNLU;
//        özet yine scrub+redact'ten, DICOM'lar tag-strip'ten geçer (lib katmanı, fail-closed).
async function assignedDoctor(userId: string, role: string, caseId: string) {
  if (role !== "DOCTOR") return null;
  const u = await db.user.findUnique({ where: { id: userId }, select: { doctorId: true } });
  if (!u?.doctorId) return null;
  const c = await db.case.findUnique({ where: { id: caseId }, select: { id: true, userId: true, doctorId: true, deletionLockedAt: true } });
  if (!c || c.deletionLockedAt || c.doctorId !== u.doctorId) return null;
  const d = await db.doctor.findUnique({ where: { id: u.doctorId }, select: { id: true, title: true, name: true } });
  return d ? { ...d, caseUserId: c.userId } : null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  const doctor = await assignedDoctor(user.id, user.role, id);
  if (!doctor) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
  const preview = await poolPreviewForCase(id);
  if (!preview) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
  return NextResponse.json({ ok: true, ...preview });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  const rl = await rateLimit(`consult-pool:${user.id}`, 5, 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);
  const doctor = await assignedDoctor(user.id, user.role, id);
  if (!doctor) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const summary = typeof b.summary === "string" ? b.summary : "";
  const docIds = Array.isArray(b.docIds) ? (b.docIds as unknown[]).filter((x): x is string => typeof x === "string") : [];

  // DICOM seçiliyse burned-in beyanı zorunlu (partner formundaki onaylı metinle aynı kutu — UI basar).
  if (docIds.length) {
    const hasDicom = await db.caseDocument.count({ where: { caseId: id, id: { in: docIds }, mimeType: "application/dicom" } });
    if (hasDicom > 0 && b.dicomConfirm !== true) {
      return NextResponse.json({ error: "DICOM eklediyseniz görüntü üzeri kimlik kontrolü onayını işaretleyin." }, { status: 400 });
    }
  }

  let created: { id: string };
  try {
    const res = await createRequestFromCase({ caseId: id, doctorId: doctor.id, doctorName: `${doctor.title} ${doctor.name}`, summary, docIds });
    if (res === "EMPTY") return NextResponse.json({ error: "Anonim özet en az 10 karakter olmalı." }, { status: 400 });
    if (res === "NOT_FOUND") return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
    created = res;
  } catch (e) {
    if (e instanceof DicomRejectedError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }

  await recordAccess({
    actor: user, action: "CONSULT_POOL_OPEN", resourceType: "CASE", resourceId: id, subjectUserId: doctor.caseUserId,
    detail: "Vaka kimlikten arındırılarak konsültasyon havuzuna açıldı", ...reqMeta(req),
  });

  // Özet çevirisi zaten dolu (TR); belge AI değerlendirmesi (PDF/görüntü) best-effort — DICOM atlanır.
  await processRequestAi(created.id);

  return NextResponse.json({ ok: true, id: created.id });
}
