import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { transitionSoCase, logSoEvent, SoError } from "@/lib/second-opinion-service";
import { notifyUser } from "@/lib/notify";

// POST /api/second-opinion/cases/[id]/request — hasta talebi aç.
// Talep A (MISSING_DOCUMENT): koordinatör, PENDING_REVIEW → AWAITING_DOCUMENTS.
// Talep B (ADDITIONAL_EXAMINATION): atanmış doktor, ASSIGNED → AWAITING_ADDITIONAL_TESTS (Faz 3).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const type = String(body.type ?? "");
  const description = String(body.description ?? "").trim();
  if (!["MISSING_DOCUMENT", "ADDITIONAL_EXAMINATION"].includes(type)) {
    return NextResponse.json({ error: "Geçersiz talep tipi." }, { status: 400 });
  }
  if (description.length < 5) {
    return NextResponse.json({ error: "Lütfen talebi açıklayın." }, { status: 400 });
  }

  const c = await db.secondOpinionCase.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: "Vaka bulunamadı." }, { status: 404 });

  let nextStatus: "AWAITING_DOCUMENTS" | "AWAITING_ADDITIONAL_TESTS";
  let requestedBy: string;
  if (type === "MISSING_DOCUMENT") {
    if (!["COORDINATOR", "ADMIN"].includes(user.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
    if (c.status !== "PENDING_REVIEW") return NextResponse.json({ error: "Eksik belge talebi yalnız inceleme aşamasında açılabilir." }, { status: 409 });
    nextStatus = "AWAITING_DOCUMENTS";
    requestedBy = "coordinator";
  } else {
    if (!["DOCTOR", "ADMIN"].includes(user.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
    if (c.status !== "ASSIGNED") return NextResponse.json({ error: "Ek tetkik talebi yalnız atama sonrası açılabilir." }, { status: 409 });
    nextStatus = "AWAITING_ADDITIONAL_TESTS";
    requestedBy = "doctor";
  }

  await db.secondOpinionRequest.create({
    data: { caseId: id, type, description: description.slice(0, 1000), requestedBy, requestedById: user.id, status: "PENDING" },
  });
  try {
    await transitionSoCase(id, nextStatus, { actorId: user.id, actorRole: user.role });
  } catch (e) {
    if (e instanceof SoError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  await logSoEvent(id, { actorId: user.id, actorRole: user.role, action: "REQUEST_OPEN", detail: type });
  await notifyUser(c.patientId, {
    type: "SO_REQUEST",
    title: type === "MISSING_DOCUMENT" ? "📄 Eksik belge talebi" : "🧪 Ek tetkik talebi",
    body: description.slice(0, 120),
    href: `/second-opinion/vaka/${id}`,
  });
  return NextResponse.json({ ok: true, status: nextStatus });
}
