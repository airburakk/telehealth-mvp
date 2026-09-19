// AI triyaj kapısı — rol · hız · AKTİF rıza · girdi boyutu TEK yerde (kontrol raporu 2026-09-17 K04, P1).
//
// Sorun: `POST /api/triage/analyze` (önizleme) 2026-08-03'ten beri rıza + hız + boyut denetliyordu ama vaka
// oluşturan `POST /api/cases` (ve free-care/apply, patient/tourism-request) yalnız `requireUser` sonrası
// `runTriage` çağırıyordu → istemcideki AiConsentGate atlanınca rızasız / sınırsız AI çağrısı mümkündü (raporun
// yerel provası bunu doğruladı). İstemci kapısı güvenlik sınırı DEĞİLDİR; API rotaları proxy ile korunmaz.
//
// Bu yardımcı AI'ya giden HER yolun önüne konur. Sıra: rol → hız (kullanıcı, sonra IP) → aktif rıza → boyut.
// Rıza geri-alma duyarlıdır (`activeConsent`): geri alınmış ya da eski sürümlü rıza → 403 AI_CONSENT_REQUIRED.
// Hız kovası `triage:<userId>` analyze ile ORTAKTIR → önizleme + oluşturma aynı dakikalık bütçeyi paylaşır.
import { NextResponse } from "next/server";
import { activeConsent } from "./aura-consent";
import { AI_CONSENT_SCOPE, AI_CONSENT_VERSION } from "./ai-consent";
import { rateLimit, clientIp, tooMany } from "./rate-limit";
import type { SessionUser } from "./session";
import type { TriageInput } from "./triage";

export const AI_TRIAGE_LIMITS = {
  symptoms: 4000, // vaka kaydındaki 4000 karakterlik sınırla hizalı
  answersChars: 4000, // ek yanıtlar prompt'a JSON olarak girer → sınırsız olamaz
  durationText: 500,
  perUserPerMinute: 20, // /api/ai/soap ile aynı
  perIpPerMinute: 60, // hesap çoğaltarak kotayı aşma freni (hız fail-open: Upstash düşerse in-memory)
} as const;

/** AI ön değerlendirmeyi tetikleyebilen roller — hasta yüzü uçları yalnız hasta hesabıyla çağrılır; ADMIN demo/prova
 *  için (patient/tourism-request'teki mevcut istisnayla aynı). Doktor/personel/partner → 403. */
export const AI_TRIAGE_ROLES: readonly string[] = ["PATIENT", "ADMIN"];

/** Kapıdan geçen, `runTriage`'a doğrudan verilebilen normalize girdi (lib/triage TriageInput ile aynı şekil). */
export type AiTriageInput = TriageInput;

export type AiGateVerdict = { ok: true; input: AiTriageInput } | { ok: false; response: NextResponse };

function fail(status: number, error: string, code?: string): AiGateVerdict {
  return { ok: false, response: NextResponse.json(code ? { error, code } : { error }, { status }) };
}

/** Branş soruları yanıtları: yalnız düz nesne + string değerler (prompt'a JSON olarak girer; dizi/iç içe nesne atılır). */
function normalizeAnswers(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const entries = Object.entries(raw as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === "string");
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export async function requireAiTriage(user: SessionUser, req: Request, body: Record<string, unknown>): Promise<AiGateVerdict> {
  if (!AI_TRIAGE_ROLES.includes(user.role)) {
    return fail(403, "Bu işlem yalnız hasta hesabıyla yapılabilir.", "AI_ROLE_NOT_ALLOWED");
  }
  const perUser = await rateLimit(`triage:${user.id}`, AI_TRIAGE_LIMITS.perUserPerMinute, 60_000);
  if (!perUser.ok) return { ok: false, response: tooMany(perUser.retryAfter) };
  const perIp = await rateLimit(`triage-ip:${clientIp(req)}`, AI_TRIAGE_LIMITS.perIpPerMinute, 60_000);
  if (!perIp.ok) return { ok: false, response: tooMany(perIp.retryAfter) };
  if (!(await activeConsent(user.id, AI_CONSENT_SCOPE, AI_CONSENT_VERSION))) {
    return fail(403, "Yapay zeka ile analiz için açık rızanız gerekiyor.", "AI_CONSENT_REQUIRED");
  }
  const symptoms = String(body.symptoms ?? "").trim();
  if (symptoms.length > AI_TRIAGE_LIMITS.symptoms) {
    return fail(413, `Şikayet metni çok uzun (en fazla ${AI_TRIAGE_LIMITS.symptoms} karakter).`);
  }
  const rawAnswers = body.answers ?? undefined;
  if (rawAnswers !== undefined && JSON.stringify(rawAnswers).length > AI_TRIAGE_LIMITS.answersChars) {
    return fail(413, "Gönderilen yanıtlar çok uzun.");
  }
  const durationText = body.durationText ? String(body.durationText) : undefined;
  if (durationText && durationText.length > AI_TRIAGE_LIMITS.durationText) {
    return fail(413, "Süre bilgisi çok uzun.");
  }
  return {
    ok: true,
    input: {
      symptoms,
      durationText,
      answers: normalizeAnswers(rawAnswers),
      forceBranchKey: body.forceBranchKey ? String(body.forceBranchKey) : undefined,
    },
  };
}
