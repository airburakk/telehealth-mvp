// Klinik araştırma faz öneki — tek kaynak sözleşmesi (2026-10-02).
//
// Bulgu: sabah bülteni kartında (LinkedIn/X'e giden görsel) önek kimi gün ham ("PHASE4 · …"), kimi gün çeviride bozulmuş
// ("FAZE 3 · …") çıkıyordu — önek başlıkla birlikte çeviriye giriyordu. Kilitlenenler:
//   1) önek kodda ve Türkçe üretilir (trialPhaseLabel),
//   2) tanınan her biçim kanonik "Faz N · " önekine iner; gövde metnine dokunulmaz (normalize/split),
//   3) çeviriye yalnız gövde girer, önek geri eklenir (translate-news protectTrialPhase),
//   4) kart ve portal eski satırları okurken düzeltir (social-digest toItem · doctorium toFeedItem).
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { joinTrialPhase, normalizeTrialPhasePrefix, splitTrialPhasePrefix, trialPhaseLabel } from "@/lib/trial-phase";
import { protectTrialPhase } from "@/lib/translate-news";
import { pickSocialDigest, type SocialArticle } from "@/lib/social-digest";
import { BRANCHES } from "@/lib/triage";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("trialPhaseLabel: API fazları → Türkçe önek", () => {
  it("tek faz, birleşik faz ve erken faz", () => {
    expect(trialPhaseLabel(["PHASE3"])).toBe("Faz 3");
    expect(trialPhaseLabel(["PHASE4"])).toBe("Faz 4");
    expect(trialPhaseLabel(["PHASE2", "PHASE3"])).toBe("Faz 2/3");
    expect(trialPhaseLabel(["EARLY_PHASE1"])).toBe("Erken Faz 1");
  });
  it("boş ya da tanınmayan değer önek üretmez (başlık öneksiz yazılır)", () => {
    expect(trialPhaseLabel([])).toBe("");
    expect(trialPhaseLabel(["NA"])).toBe("");
    expect(joinTrialPhase("", "Başlık")).toBe("Başlık");
    expect(joinTrialPhase("Faz 3", "Başlık")).toBe("Faz 3 · Başlık");
  });
});

describe("splitTrialPhasePrefix / normalizeTrialPhasePrefix: görülen tüm biçimler kanonik öneke iner", () => {
  it.each([
    ["PHASE4 · NeosTigmin ve Sugammadeks'in Optik Sinir Kılıfı Çapına Etkisi", "Faz 4 · NeosTigmin ve Sugammadeks'in Optik Sinir Kılıfı Çapına Etkisi"],
    ["FAZE 3 · Kalp Yetmezliği ve Inflamasyonu Olan Katılımcılarda Ziltivekimab", "Faz 3 · Kalp Yetmezliği ve Inflamasyonu Olan Katılımcılarda Ziltivekimab"],
    ["PHASE2/PHASE3 · A Study of X", "Faz 2/3 · A Study of X"],
    ["FAZ 3 · Bir Çalışma", "Faz 3 · Bir Çalışma"],
    ["Faz 3 · Bir Çalışma", "Faz 3 · Bir Çalışma"],
    ["faz 2/3 · Bir Çalışma", "Faz 2/3 · Bir Çalışma"],
    ["Aşama 3 · Bir Çalışma", "Faz 3 · Bir Çalışma"],
    ["EARLY_PHASE1 · First-in-human study", "Erken Faz 1 · First-in-human study"],
    ["Erken Faz 1 · İlk insan çalışması", "Erken Faz 1 · İlk insan çalışması"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeTrialPhasePrefix(input)).toBe(expected);
  });

  it("önek yoksa başlık AYNEN döner — gövdedeki 'Phase 3' ifadesine dokunulmaz", () => {
    for (const t of [
      "Phase 3 trial of semaglutide in adults with obesity",
      "Faz 3 çalışmasında yeni bulgular",
      "A Study of X in Phase 2 · follow-up",
      "GAS yakılması ve Ekvador'un Amazon bölgesinde kanser: ekolojik bir çalışma",
    ]) {
      expect(splitTrialPhasePrefix(t)).toBeNull();
      expect(normalizeTrialPhasePrefix(t)).toBe(t);
    }
  });

  it("gövdesi boş önek başlık sayılmaz", () => {
    expect(splitTrialPhasePrefix("PHASE3 · ")).toBeNull();
    expect(normalizeTrialPhasePrefix("PHASE3 · ")).toBe("PHASE3 · ");
  });

  it("split kanonik öneki ve gövdeyi ayrı verir", () => {
    expect(splitTrialPhasePrefix("PHASE3 · A Research Study")).toEqual({ phase: "Faz 3", rest: "A Research Study" });
  });
});

describe("protectTrialPhase: önek çeviriye girmez", () => {
  it("çeviriye yalnız gövde gider; çeviri dönünce kanonik önek geri eklenir", () => {
    const guard = protectTrialPhase(["PHASE3 · A Research Study of Ziltivekimab", "Makale başlığı", "Faz 4 · Effect of Neostigmine"]);
    expect(guard.inputs).toEqual(["A Research Study of Ziltivekimab", "Makale başlığı", "Effect of Neostigmine"]);
    expect(guard.restore(["Ziltivekimab Araştırma Çalışması", "Çevrilmiş başlık", "Neostigminin Etkisi"])).toEqual([
      "Faz 3 · Ziltivekimab Araştırma Çalışması",
      "Çevrilmiş başlık",
      "Faz 4 · Neostigminin Etkisi",
    ]);
  });
  it("çeviri gelmeyen öğe null kalır (çağıran özgün başlığı yazar)", () => {
    const guard = protectTrialPhase(["PHASE3 · A Study", "B"]);
    expect(guard.restore([null, undefined])).toEqual([null, null]);
  });
  it("translateTitlesTr korumayı kullanır ve ingest öneki koddan üretir (kaynak kilidi)", () => {
    const tn = read("src/lib/translate-news.ts");
    expect(tn).toMatch(/const guard = protectTrialPhase\(titles\);[\s\S]{0,260}translateBatchTr\(guard\.inputs,[\s\S]{0,200}return guard\.restore\(out\);/);
    const src = read("src/lib/doctorium-sources.ts");
    expect(src).toMatch(/title: joinTrialPhase\(phase, title\.slice\(0, 220\)\)/);
    expect(src).not.toMatch(/\$\{phases\} · /); // ham API değeri başlığa yazılmaz
  });
});

describe("okuma sınırları eski satırları düzeltir", () => {
  const NOW = new Date("2026-10-02T04:45:00Z");
  const art = (over: Partial<SocialArticle>): SocialArticle => ({
    id: "t1", source: "clinicaltrials", module: "ilac", kind: "lansman", title: "PHASE4 · Bir Çalışma", sourceName: "ClinicalTrials.gov",
    summary: "Özet.", url: "https://clinicaltrials.gov/study/NCT0", branchSlugs: "[]",
    publishedAt: new Date("2026-10-01T00:00:00Z"), createdAt: new Date(NOW.getTime() - 2 * 3_600_000), ...over,
  });

  it("bülten ucu: klinik araştırma başlığı kanonik önekle çıkar (kart LinkedIn/X'e gider)", () => {
    const rot = BRANCHES[0];
    expect(pickSocialDigest([art({})], rot, NOW)[0].title).toBe("Faz 4 · Bir Çalışma");
    expect(pickSocialDigest([art({ title: "FAZE 3 · Bir Çalışma" })], rot, NOW)[0].title).toBe("Faz 3 · Bir Çalışma");
  });
  it("bülten ucu: başka kaynağın başlığına dokunulmaz", () => {
    const rot = BRANCHES[0];
    const item = pickSocialDigest([art({ source: "openfda", kind: "ilac", title: "PHASE4 · gibi başlayan başka bir başlık" })], rot, NOW)[0];
    expect(item.title).toBe("PHASE4 · gibi başlayan başka bir başlık");
  });
  it("portal akışı (toFeedItem) yalnız clinicaltrials satırında normalleştirir (kaynak kilidi)", () => {
    const d = read("src/lib/doctorium.ts");
    expect(d).toMatch(/r\.source === "clinicaltrials" \? normalizeTrialPhasePrefix\(t\) : t/);
    expect(d).toMatch(/title: fixPhase\(decodeFeedText\(r\.title\)\)/);
  });
});
