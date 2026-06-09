import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { analyzeTriage } from "@/lib/triage";

// GET /api/cases — vaka kuyruğu (filtrelenebilir)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const branch = searchParams.get("branch");
  const status = searchParams.get("status");

  const cases = await db.case.findMany({
    where: {
      ...(branch ? { branch } : {}),
      ...(status ? { status } : {}),
    },
    include: { doctor: true },
    orderBy: [{ urgency: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(cases);
}

// POST /api/cases — yeni vaka oluştur (triyaj sunucu tarafında yeniden hesaplanır)
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const patientName = String(body.patientName ?? "").trim();
  const symptoms = String(body.symptoms ?? "").trim();
  if (!patientName || !symptoms) {
    return NextResponse.json({ error: "Hasta adı ve şikayet zorunludur." }, { status: 400 });
  }

  const a = analyzeTriage({
    symptoms,
    durationText: body.durationText ? String(body.durationText) : undefined,
    answers: body.answers ?? undefined,
  });

  const attachments: string | null = Array.isArray(body.attachments) && body.attachments.length
    ? body.attachments.join(",")
    : null;

  const created = await db.case.create({
    data: {
      patientName,
      country: String(body.country ?? "TR"),
      language: String(body.language ?? "Türkçe"),
      symptoms,
      durationText: body.durationText ? String(body.durationText) : null,
      extra: body.answers ? JSON.stringify(body.answers) : null,
      attachments,
      branch: a.branch,
      urgency: a.urgency,
      confidence: a.confidence,
      reasoning: a.reasoning,
      status: "NEW",
      consultFee: typeof body.consultFee === "number" ? body.consultFee : null,
      payStatus: ["PAID", "INSURED"].includes(String(body.payStatus)) ? String(body.payStatus) : "PENDING",
      payMethod: body.payMethod ? String(body.payMethod) : null,
      policyNo: body.policyNo ? String(body.policyNo).slice(0, 40) : null,
      payRef: body.payRef ? String(body.payRef).slice(0, 40) : null,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
