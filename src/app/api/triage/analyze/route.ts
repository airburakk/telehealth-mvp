import { NextResponse } from "next/server";
import { runTriage } from "@/lib/triage-llm";
import { getCurrentUser } from "@/lib/auth";
import { detectSecondOpinionIntent } from "@/lib/so-intent";
import { requireAiTriage } from "@/lib/ai-gate";

// POST /api/triage/analyze — semptomları analiz eder (vaka oluşturmadan önizleme)
// Yetki: oturum zorunlu (kimliksiz LLM çağrısı = maliyet/abuse vektörü).
//
// 2026-08-03 dış denetimi (P1): bu uçta NE hız freni NE de girdi boyutu sınırı vardı; AI rızası yalnız istemcideydi.
// Üçü de buraya eklendi. Kontrol raporu 2026-09-17 K04 (P1): aynı denetimler vaka OLUŞTURAN uçta yoktu → ortak
// `lib/ai-gate.requireAiTriage` (rol · hız [kullanıcı+IP] · aktif rıza · boyut) AI'ya giden her yolun önüne kondu;
// bu uç da aynı yardımcıyı kullanır (eski satır içi denetimler oraya taşındı; sınırı aşan girdi artık kırpılmaz, 413 döner).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const gate = await requireAiTriage(user, req, body);
  if (!gate.ok) return gate.response;

  const result = await runTriage(gate.input);
  // İkinci Görüş niyet önerisi (deterministik, LLM'den bağımsız) — yalnız telehealth
  // triyaj arayüzü gösterir; sağlık-turizmi çağıranı bu alanı yok sayar.
  return NextResponse.json({ ...result, soSuggested: detectSecondOpinionIntent(gate.input.symptoms) });
}
