import { NextResponse } from "next/server";
import { runTriage } from "@/lib/triage-llm";
import { getCurrentUser } from "@/lib/auth";

// POST /api/triage/analyze — semptomları analiz eder (vaka oluşturmadan önizleme)
// Yetki: oturum zorunlu (kimliksiz LLM çağrısı = maliyet/abuse vektörü).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const result = await runTriage({
    symptoms: String(body.symptoms ?? ""),
    durationText: body.durationText ? String(body.durationText) : undefined,
    answers: body.answers ?? undefined,
    forceBranchKey: body.forceBranchKey ? String(body.forceBranchKey) : undefined,
  });
  return NextResponse.json(result);
}
