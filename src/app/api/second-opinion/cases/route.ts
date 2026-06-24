import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { BRANCHES } from "@/lib/triage";
import { COUNTRIES, LANGUAGES } from "@/lib/constants";
import { logSoEvent } from "@/lib/second-opinion-service";

// GET /api/second-opinion/cases — hasta kendi SO vakalarını listeler (klinik personel: tümü)
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  const cases = await db.secondOpinionCase.findMany({
    where: user.role === "PATIENT" ? { patientId: user.id } : {},
    orderBy: { createdAt: "desc" },
    include: {
      documents: { select: { id: true, type: true, deliveryMethod: true } },
      payment: { select: { status: true } },
      requests: { where: { status: "PENDING" }, select: { id: true, type: true } },
    },
  });
  return NextResponse.json(cases);
}

// POST /api/second-opinion/cases — yeni ikinci görüş vakası (DRAFT). KVKK açık rıza zorunlu (§8).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const consent = body.consent === true;
  const diagnosisSummary = String(body.diagnosisSummary ?? "").trim();
  const branch = String(body.branch ?? "").trim();
  const country = String(body.country ?? "").trim();
  const language = String(body.language ?? "").trim();

  if (!consent) {
    return NextResponse.json({ error: "Devam etmek için açık rıza onayı gereklidir." }, { status: 400 });
  }
  if (diagnosisSummary.length < 10) {
    return NextResponse.json({ error: "Lütfen mevcut tanınızı kısaca özetleyin (en az 10 karakter)." }, { status: 400 });
  }
  if (!BRANCHES.some((b) => b.key === branch)) {
    return NextResponse.json({ error: "Geçerli bir tıbbi branş seçin." }, { status: 400 });
  }
  if (!COUNTRIES.some((c) => c.code === country)) {
    return NextResponse.json({ error: "Lütfen ülkenizi seçin." }, { status: 400 });
  }
  if (!LANGUAGES.includes(language)) {
    return NextResponse.json({ error: "Lütfen tercih ettiğiniz iletişim dilini seçin." }, { status: 400 });
  }

  const created = await db.secondOpinionCase.create({
    data: {
      patientId: user.id,
      branch,
      diagnosisSummary: diagnosisSummary.slice(0, 4000),
      country,
      language,
      status: "DRAFT",
      consentAt: new Date(),
    },
  });
  await logSoEvent(created.id, {
    actorId: user.id,
    actorRole: user.role,
    action: "STATUS_CHANGE",
    detail: "→DRAFT (açık rıza alındı)",
  });
  return NextResponse.json(created, { status: 201 });
}
