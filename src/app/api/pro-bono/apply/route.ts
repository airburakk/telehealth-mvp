import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runTriage } from "@/lib/triage-llm";
import { getCurrentUser } from "@/lib/auth";
import { matchForCase } from "@/lib/pro-bono";
import { encryptField } from "@/lib/crypto";

// POST /api/pro-bono/apply — hasta ön-triyaj → ÜCRETSİZ pro bono vaka (ödeme kapısı YOK) → anında eşleşme dener.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const symptoms = String(body.symptoms ?? "").trim();
  if (!symptoms) return NextResponse.json({ error: "Şikayet zorunludur." }, { status: 400 });
  if (body.consent !== true) return NextResponse.json({ error: "Devam için onay gerekli." }, { status: 400 });

  const patientName = String(body.patientName ?? "").trim() || user.name;

  // Branş/aciliyet için triyaj (eşleştirme + doktor bağlamı); ücret/belge kapısı yok.
  const a = await runTriage({
    symptoms,
    durationText: body.durationText ? String(body.durationText) : undefined,
  });

  const created = await db.case.create({
    data: {
      userId: user.id,
      patientName: encryptField(patientName), // kimlik at-rest şifreli (E2EE inc.2c)
      country: String(body.country ?? "TR"),
      language: String(body.language ?? "Türkçe"),
      symptoms: encryptField(symptoms), // E2EE Faz 1 — pro-bono yazımı inc.2'de atlanmıştı (gap fix)
      durationText: body.durationText ? String(body.durationText) : null,
      branch: a.branch,
      urgency: a.urgency,
      confidence: a.confidence,
      reasoning: encryptField(a.reasoning), // E2EE Faz 1 (gap fix)
      status: "NEW",
      proBono: true,
      proBonoStatus: "WAITING",
    },
  });

  const match = await matchForCase(created.id);
  return NextResponse.json(
    { caseId: created.id, consultationId: match?.consultationId ?? null },
    { status: 201 },
  );
}
