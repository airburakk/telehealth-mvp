import { NextResponse } from "next/server";
import { runTriage } from "@/lib/triage-llm";

// POST /api/triage/analyze — semptomları analiz eder (vaka oluşturmadan önizleme)
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const result = await runTriage({
    symptoms: String(body.symptoms ?? ""),
    durationText: body.durationText ? String(body.durationText) : undefined,
    answers: body.answers ?? undefined,
  });
  return NextResponse.json(result);
}
