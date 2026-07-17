import { NextResponse } from "next/server";
import { runTriage } from "@/lib/triage-llm";
import { getCurrentUser } from "@/lib/auth";
import { detectSecondOpinionIntent } from "@/lib/so-intent";

// POST /api/triage/analyze — semptomları analiz eder (vaka oluşturmadan önizleme)
// Yetki: oturum zorunlu (kimliksiz LLM çağrısı = maliyet/abuse vektörü).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const symptoms = String(body.symptoms ?? "");
  const result = await runTriage({
    symptoms,
    durationText: body.durationText ? String(body.durationText) : undefined,
    answers: body.answers ?? undefined,
    forceBranchKey: body.forceBranchKey ? String(body.forceBranchKey) : undefined,
  });
  // İkinci Görüş niyet önerisi (deterministik, LLM'den bağımsız) — yalnız telehealth
  // triyaj arayüzü gösterir; sağlık-turizmi çağıranı bu alanı yok sayar.
  return NextResponse.json({ ...result, soSuggested: detectSecondOpinionIntent(symptoms) });
}
