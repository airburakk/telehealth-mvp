// ClinicalTrials.gov faz öneki — TEK KAYNAK (2026-10-02). SAF modül.
//
// İlaç & Cihaz akışındaki klinik araştırma başlıkları "<faz> · <başlık>" biçimindedir. Önek eskiden API'nin ham değeriyle
// ("PHASE3", "PHASE2/PHASE3") yazılıp başlıkla BİRLİKTE çeviriye giriyordu; model onu kimi gün aynen bıraktı ("PHASE4 · …"),
// kimi gün bozdu ("FAZE 3 · …") — sabah bülteni kartında ikisi de görüldü (26.09 → 02.10.2026; kart LinkedIn'e gidiyor).
//
// Kural:
//   · önek KODDA üretilir (trialPhaseLabel → "Faz 3", "Faz 2/3", "Erken Faz 1"),
//   · ÇEVİRİYE GİRMEZ (translate-news.protectTrialPhase: gövde çevrilir, önek geri eklenir),
//   · eski satırlar OKUNURKEN aynı biçime getirilir (doctorium.toFeedItem · social-digest.toItem → normalizeTrialPhasePrefix);
//     veritabanında düzeltme gerekmez.
const SEP = " · ";

// Tanınan önek biçimleri: ham API değeri (PHASE3 · EARLY_PHASE1 · PHASE2/PHASE3), kanonik ("Faz 3" · "Faz 2/3" · "Erken Faz 1")
// ve çevirinin ürettiği bozuk biçimler ("FAZE 3" · "FAZ 3" · "Aşama 3"). Yalnız başlığın BAŞINDA ve ayraçla (·) birlikte
// eşleşir — "Phase 3 trial of X" gibi gövde metnine dokunmaz.
const PREFIX =
  /^\s*(early[_\s]?|erken\s+)?(?:phase|faze?|aşama)[_\s]?([1-4])(?:\s*\/\s*(?:(?:phase|faze?|aşama)[_\s]?)?([1-4]))?\s*·\s*/iu;

/** API fazları (["PHASE2", "PHASE3"]) → "Faz 2/3"; ["EARLY_PHASE1"] → "Erken Faz 1"; boş ya da tanınmayan (NA) → "" (önek yazılmaz). */
export function trialPhaseLabel(phases: readonly string[]): string {
  const nums: string[] = [];
  let early = false;
  for (const p of phases) {
    const m = /^(EARLY_)?PHASE([1-4])$/.exec(p);
    if (!m) continue;
    if (m[1]) early = true;
    nums.push(m[2]);
  }
  return nums.length ? `${early ? "Erken " : ""}Faz ${nums.join("/")}` : "";
}

/** Önek + gövde → başlık ("Faz 3" + "X" → "Faz 3 · X"); önek boşsa gövde aynen. */
export function joinTrialPhase(phase: string, rest: string): string {
  return phase ? `${phase}${SEP}${rest}` : rest;
}

/** "PHASE3 · X" / "FAZE 3 · X" / "Faz 2/3 · X" → { phase: "Faz 3", rest: "X" } (önek kanonik); önek yoksa null. */
export function splitTrialPhasePrefix(title: string): { phase: string; rest: string } | null {
  const m = PREFIX.exec(title);
  if (!m) return null;
  const rest = title.slice(m[0].length).trim();
  if (!rest) return null;
  return { phase: `${m[1] ? "Erken " : ""}Faz ${m[2]}${m[3] ? `/${m[3]}` : ""}`, rest };
}

/** Öneki kanonik biçime getirir ("PHASE4 · X" → "Faz 4 · X"); önek yoksa başlık AYNEN döner. */
export function normalizeTrialPhasePrefix(title: string): string {
  const p = splitTrialPhasePrefix(title);
  return p ? joinTrialPhase(p.phase, p.rest) : title;
}
