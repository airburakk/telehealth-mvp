// Doctorium anket katmanı (v6.69 Faz 2) — TEK SORULU anketler (Doximity poll deseni).
//
// İKİ REJİM (dayanak: vault output/doctorium-reklam-monetizasyon-2026-08-04.md §5-6):
//  - COMMUNITY = İÇERİK rejimi: akış branş süzmesi (haber akışıyla aynı mantık) — pazarlama
//    rızası GEREKMEZ; şehir hedefi bu rejimde YOK SAYILIR (akış da şehirle süzülmez).
//  - SPONSORED = PAZARLAMA rejimi: sponsorlu kart kurallarının aynısı (filterCampaigns) —
//    hedefli anket YALNIZ açık rızalı doktora; hedefsiz (bağlamsal) herkese.
//
// ⚠️ HONORARIUM KİLİDİ: honorarium > 0 anket ACTIVE EDİLEMEZ (canActivateSurvey; API fail-closed).
// Ödeme/vergi kurgusu (gider pusulası ↔ SM makbuzu · GİB özelgesi · kamu hekimi · TİTCK değer
// aktarımı) kullanıcı kararı bekliyor — kurgu yokken doktora "ödenir" vaadi verilmez.
// Sonuç daima AGREGAT çıkar: kimlikli tekil yanıt hiçbir yüzeye/sponsora verilmez.
import { db } from "./db";
import { filterCampaigns } from "./sponsor";

export const SURVEY_KINDS = ["COMMUNITY", "SPONSORED"] as const;
export const SURVEY_STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "ENDED"] as const;
export const SURVEY_KIND_LABEL: Record<string, string> = {
  COMMUNITY: "Topluluk anketi",
  SPONSORED: "Sponsorlu anket",
};
// Akışa aynı anda girecek en fazla anket kartı (sponsorlu kartlardan AYRI sayılır).
export const MAX_FEED_SURVEYS = 1;
// Şık sınırları (kapalı uçlu; serbest metin bilinçli yok — agregat disiplin).
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 6;

export interface SurveyCard {
  id: string;
  kind: string;
  sponsor: string | null;
  question: string;
  options: string[];
  points: number; // v6.88 ödül puanı (0 = puansız — kart rozet basmaz)
}

interface VisibleRow {
  kind: string;
  targetBranches: string | null;
  targetCities: string | null;
}

export function parseOptions(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function parseList(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Saf görünürlük süzmesi (birim test edilebilir): rejim ayrımının tek kaynağı.
 * COMMUNITY → içerik rejimi (branş kesişimi; rıza ve şehirden bağımsız).
 * SPONSORED → pazarlama rejimi (filterCampaigns: rızasıza yalnız hedefsiz).
 */
export function visibleSurveys<T extends VisibleRow>(
  rows: T[],
  opts: { personalized: boolean; branches: string[]; city: string | null },
): T[] {
  return rows.filter((s) => {
    if (s.kind === "COMMUNITY") {
      const tb = parseList(s.targetBranches);
      return tb.length === 0 || tb.some((b) => opts.branches.includes(b));
    }
    return filterCampaigns([s], opts).length > 0;
  });
}

/** Honorarium kilidi: ödeme kurgusu netleşene dek ücretli anket yayına ALINAMAZ (fail-closed). */
export function canActivateSurvey(s: { honorarium: number | null }): boolean {
  return (s.honorarium ?? 0) <= 0;
}

/** Akışa girecek anketler: ACTIVE + tarih penceresi; rejim süzmesi visibleSurveys ile. */
export async function activeSurveysFor(opts: {
  personalized: boolean;
  branches: string[];
  city: string | null;
}): Promise<SurveyCard[]> {
  const now = new Date();
  const rows = await db.survey.findMany({
    where: { status: "ACTIVE", startsAt: { lte: now }, endsAt: { gte: now } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, kind: true, sponsor: true, question: true, options: true, points: true,
      targetBranches: true, targetCities: true,
    },
  });
  return visibleSurveys(rows, opts)
    .slice(0, MAX_FEED_SURVEYS)
    .map((s) => ({ id: s.id, kind: s.kind, sponsor: s.sponsor, question: s.question, options: parseOptions(s.options), points: s.points }));
}

/** Toplu sonuç: şık başına yanıt sayısı (options uzunluğuna sıfır-dolgulu) + toplam. */
export async function aggregateResults(surveyId: string, optionCount: number): Promise<{ counts: number[]; total: number }> {
  const grouped = await db.surveyResponse.groupBy({
    by: ["optionIndex"],
    where: { surveyId },
    _count: { _all: true },
  });
  const counts = Array.from({ length: optionCount }, () => 0);
  for (const g of grouped) {
    if (g.optionIndex >= 0 && g.optionIndex < optionCount) counts[g.optionIndex] = g._count._all;
  }
  return { counts, total: counts.reduce((a, b) => a + b, 0) };
}

/** Doktorun bu anketteki yanıtı (yoksa null) — kart "yanıtla" mı "sonuç" mu kararı için. */
export async function doctorResponse(surveyId: string, doctorId: string): Promise<number | null> {
  const r = await db.surveyResponse.findUnique({
    where: { surveyId_doctorId: { surveyId, doctorId } },
    select: { optionIndex: true },
  });
  return r?.optionIndex ?? null;
}
