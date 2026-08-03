import { NextResponse } from "next/server";
import { runTriage } from "@/lib/triage-llm";
import { getCurrentUser } from "@/lib/auth";
import { detectSecondOpinionIntent } from "@/lib/so-intent";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { hasCurrentConsent } from "@/lib/consent";
import { AI_CONSENT_SCOPE, AI_CONSENT_VERSION } from "@/lib/ai-consent";

// POST /api/triage/analyze — semptomları analiz eder (vaka oluşturmadan önizleme)
// Yetki: oturum zorunlu (kimliksiz LLM çağrısı = maliyet/abuse vektörü).
//
// 2026-08-03 dış denetimi (P1): bu uçta NE hız freni NE de girdi boyutu sınırı vardı → tek düşük
// ayrıcalıklı hesap sınırsız LLM çağrısı + devasa prompt gönderebiliyordu. Projenin geri kalanı
// zaten frenli (login 10/5dk · signup 10/5dk · /api/ai/soap 20/dk); bu uç desenin dışında kalmıştı.
//
// AÇIK RIZA: AI_TRIAGE kovası tam olarak bu işlemi kapsar ("yalnızca sizi doğru branş doktoruna
// yönlendirmek için analiz edilecektir"). Kapı şimdiye dek YALNIZ istemcideydi (AiConsentGate rıza
// yoksa formu mount etmiyordu) → uç doğrudan çağrılabiliyordu. Rıza artık SUNUCUDA doğrulanır.
const MAX_SYMPTOMS = 4000; // vaka kaydındaki 4000 karakterlik sınırla hizalı
const MAX_ANSWERS_CHARS = 4000; // ek yanıtlar prompt'a JSON olarak giriyor → sınırsız olamaz

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });

  const rl = await rateLimit(`triage:${user.id}`, 20, 60_000); // 20/dk/kullanıcı (soap ile aynı)
  if (!rl.ok) return tooMany(rl.retryAfter);

  if (!(await hasCurrentConsent(user.id, AI_CONSENT_SCOPE, AI_CONSENT_VERSION))) {
    return NextResponse.json(
      { error: "Yapay zeka ile analiz için açık rızanız gerekiyor.", code: "AI_CONSENT_REQUIRED" },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const symptoms = String(body.symptoms ?? "").slice(0, MAX_SYMPTOMS);
  // answers serbest bir nesnedir ve JSON olarak prompt'a girer → boyutu ölçülüp sınırlanır.
  const answers = body.answers ?? undefined;
  if (answers !== undefined && JSON.stringify(answers).length > MAX_ANSWERS_CHARS) {
    return NextResponse.json({ error: "Gönderilen yanıtlar çok uzun." }, { status: 413 });
  }

  const result = await runTriage({
    symptoms,
    durationText: body.durationText ? String(body.durationText).slice(0, 500) : undefined,
    answers,
    forceBranchKey: body.forceBranchKey ? String(body.forceBranchKey) : undefined,
  });
  // İkinci Görüş niyet önerisi (deterministik, LLM'den bağımsız) — yalnız telehealth
  // triyaj arayüzü gösterir; sağlık-turizmi çağıranı bu alanı yok sayar.
  return NextResponse.json({ ...result, soSuggested: detectSecondOpinionIntent(symptoms) });
}
