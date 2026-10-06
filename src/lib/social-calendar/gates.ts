// İçerik takvimi — ONAY KAPILARI (v6.328, 2026-10-06). SAF: aynı girdi → aynı rapor; DB/ağ yok.
//
// 👤 Karar (2026-10-06): hukuk günü için "taraf adı/kimlik bilgisi içermiyor" onay kutusu ZORUNLU + otomatik tarama. Bu dosya kapıların
// tamamıdır; servis (plan.ts) `approve`da bunu çalıştırır, engelleyen (block) bir kapı varsa onay VERİLMEZ. Rapor yalnız bilgi amaçlı
// olarak `ContentPlanItem.gateReport`a yazılır — onay kararı HER ZAMAN yeniden hesaplanır (saklanan rapora güvenilmez).
//
//   kaynak · slayt · uzunluk                 → her rubrik
//   cikarim                                  → noteLabel'li rubrik (Doktor için çıkarım ≥ 3 madde)
//   uyari · alinti · kimlik-tarama · kimlik-onay → hukuk günü (series.approval === "legal")
//   ifade                                    → her rubrik, YALNIZ kendi metnimizde (alıntı slaytı mahkemenin sözüdür — "hekim" gibi sözcükler aynen kalır)
import { describeHits, scanIdentity } from "./identity";
import { LIMITS, MIN_CAPTION_CHARS, MIN_NOTE_BULLET_CHARS, MIN_NOTE_BULLETS } from "./limits";
import type { PlanPayload, Slide } from "./payload";
import { SLIDE_ROLE_LABEL, type SeriesDef } from "./series";
import { tl, verifyQuote } from "./text";

// Eşikler limits.ts'te (istemci sayaçları da okusun); mevcut içe aktarmalar için yeniden dışa aktarılır.
export { MIN_CAPTION_CHARS, MIN_NOTE_BULLET_CHARS, MIN_NOTE_BULLETS };

export type GateId = "kaynak" | "slayt" | "uzunluk" | "cikarim" | "uyari" | "alinti" | "ifade" | "kimlik-tarama" | "kimlik-onay";

export interface GateResult {
  id: GateId;
  label: string;
  ok: boolean;
  /** block = onayı engeller · warn = ekranda uyarı, engellemez (Faz 1'de kullanılmıyor; hazır). */
  severity: "block" | "warn";
  detail?: string;
}

export interface GateReport {
  /** Engelleyen (block) hiçbir kapı başarısız değil. */
  ok: boolean;
  checkedAt: string;
  gates: GateResult[];
}

export interface GateInput {
  series: SeriesDef;
  payload: PlanPayload | null;
  attestIdentity: boolean;
  sourceIds: string[];
  /** Seçili kaynakların metinleri (alıntı doğrulaması için; hukuk günü). */
  sourceTexts: string[];
  now?: Date;
}

/** `kaynak` slaytında bulunması ZORUNLU uyarı ifadeleri (küçük harf, tr-TR katlanmış). */
export const REQUIRED_WARNING_PHRASES = ["bilgilendirme amaçlıdır", "hukuki görüş değildir"] as const;

const LABELS: Record<GateId, string> = {
  kaynak: "Kaynak seçili",
  slayt: "Slaytlar tamam",
  uzunluk: "Uzunluk sınırları",
  cikarim: "Doktor için çıkarım yazıldı",
  uyari: "Bilgilendirme uyarısı var",
  alinti: "Alıntılar kaynakta birebir geçiyor",
  ifade: "Yasak ifade yok (kendi metnimiz)",
  "kimlik-tarama": "Kimlik taraması temiz",
  "kimlik-onay": "Kimlik bilgisi içermediği onaylandı",
};

/** Kendi metnimizde YASAK ifadeler (küçük harf, tr-TR katlanmış metinde aranır). Dar tutuldu: yanlış engel, editörü kapıyla küstürür. */
const FORBIDDEN: { re: RegExp; label: string }[] = [
  { re: /hekim/, label: "“hekim” (sistemde “doktor” yazılır)" },
  { re: /uçtan uca/, label: "“uçtan uca” (vitrin iddia disiplini)" },
  { re: /akredit/, label: "“akredite/akreditasyon” (vitrin iddia disiplini)" },
  { re: /\bgaranti/, label: "sonuç/başarı garantisi ifadesi" },
  { re: /%\s*100/, label: "“%100” kesinlik ifadesi" },
  { re: /(?:davay[ıi]|tazminat[ıi])\s+(?:kesin(?:likle)?\s+)?kazan/, label: "dava/tazminat kazanma vaadi" },
  { re: /\b(?:bize|bizimle)\s+(?:ulaş|iletişim|danış)/, label: "yönlendirme/reklam ifadesi" },
  { re: /ücretsiz\s+(?:danışma|ön\s+görüşme|görüşme)/, label: "ücretsiz danışma vaadi" },
];

const slideText = (s: Slide): string => [s.title, s.body, ...(s.bullets ?? [])].filter(Boolean).join("\n");
const hasContent = (s: Slide): boolean => slideText(s).trim().length > 0;

/** Bir kapının sonucu (kısa yazım). */
const result = (id: GateId, ok: boolean, detail?: string, severity: GateResult["severity"] = "block"): GateResult => ({
  id,
  label: LABELS[id],
  ok,
  severity,
  ...(ok || !detail ? {} : { detail }),
});

export function evaluateGates(input: GateInput): GateReport {
  const { series, payload } = input;
  const checkedAt = (input.now ?? new Date()).toISOString();
  const gates: GateResult[] = [];

  if (!payload) {
    gates.push(result("slayt", false, "Henüz taslak yok — önce kaynağı seçin ya da slaytları yazın."));
    return { ok: false, checkedAt, gates };
  }
  const legal = series.approval === "legal";

  // 1 · kaynak
  {
    const missing: string[] = [];
    if (series.sourceKind === "ictihat" && input.sourceIds.length === 0) missing.push("kaynak karar seçilmedi");
    if (payload.sources.length === 0) missing.push("kaynak künyesi boş");
    gates.push(result("kaynak", missing.length === 0, `${missing.join("; ")}.`));
  }

  // 2 · slayt
  {
    const problems: string[] = [];
    if (payload.slides.length < LIMITS.minSlides) problems.push(`en az ${LIMITS.minSlides} slayt gerekir (şu an ${payload.slides.length})`);
    if (payload.slides.length > LIMITS.maxSlides) problems.push(`en çok ${LIMITS.maxSlides} slayt olabilir`);
    const absent: string[] = [];
    for (const role of series.requiredRoles) {
      const s = payload.slides.find((x) => x.role === role);
      // çıkarım slaytının İÇERİĞİ kendi kapısında ölçülür (çifte rapor olmasın) → burada yalnız varlığı
      if (!s || (role !== "cikarim" && !hasContent(s))) absent.push(SLIDE_ROLE_LABEL[role]);
    }
    if (absent.length) problems.push(`eksik/boş: ${absent.join(", ")}`);
    const empties = payload.slides.filter((s) => s.role !== "cikarim" && !hasContent(s)).length;
    if (empties && !absent.length) problems.push(`${empties} slayt boş`);
    gates.push(result("slayt", problems.length === 0, `${problems.join("; ")}.`));
  }

  // 3 · uzunluk
  {
    const problems: string[] = [];
    if (payload.caption.length < MIN_CAPTION_CHARS) problems.push(`altyazı en az ${MIN_CAPTION_CHARS} karakter olmalı`);
    if (payload.caption.length > LIMITS.caption) problems.push(`altyazı ${LIMITS.caption} karakteri aşıyor`);
    if (payload.hashtags.length > LIMITS.hashtags) problems.push(`en çok ${LIMITS.hashtags} etiket`);
    payload.slides.forEach((s, i) => {
      if (s.title.length > LIMITS.title) problems.push(`slayt ${i + 1} başlığı ${LIMITS.title} karakteri aşıyor`);
      if (s.body.length > LIMITS.body) problems.push(`slayt ${i + 1} gövdesi ${LIMITS.body} karakteri aşıyor`);
    });
    gates.push(result("uzunluk", problems.length === 0, `${problems.slice(0, 3).join("; ")}.`));
  }

  // 4 · çıkarım
  if (series.noteLabel) {
    const bullets = payload.slides.find((s) => s.role === "cikarim")?.bullets ?? [];
    const solid = bullets.filter((b) => b.trim().length >= MIN_NOTE_BULLET_CHARS);
    const ok = solid.length >= MIN_NOTE_BULLETS && solid.length === bullets.length;
    gates.push(
      result(
        "cikarim",
        ok,
        `“${series.noteLabel}” en az ${MIN_NOTE_BULLETS} madde olmalı ve her madde en az ${MIN_NOTE_BULLET_CHARS} karakter taşımalı (şu an ${bullets.length} madde, ${solid.length} yeterli).`,
      ),
    );
  }

  // 5–6 · hukuk günü: uyarı + alıntı
  if (legal) {
    const kaynak = payload.slides.find((s) => s.role === "kaynak");
    const t = tl(kaynak ? slideText(kaynak) : "");
    const lacking = REQUIRED_WARNING_PHRASES.filter((p) => !t.includes(p));
    gates.push(result("uyari", lacking.length === 0, `kaynak slaytında eksik ifade: ${lacking.map((p) => `“${p}”`).join(", ")}.`));

    const problems: string[] = [];
    for (const role of series.quoteRoles) {
      const s = payload.slides.find((x) => x.role === role);
      if (s && !s.quote) problems.push(`“${SLIDE_ROLE_LABEL[role]}” slaytı alıntı olarak işaretli değil`);
    }
    const quotes = payload.slides.filter((s) => s.quote);
    if (quotes.length > 0) {
      if (input.sourceTexts.length === 0) problems.push("kaynak karar metni okunamadı");
      else {
        const haystack = input.sourceTexts.join("\n\n");
        for (const s of quotes) {
          const v = verifyQuote(s.body, haystack);
          if (!v.ok) problems.push(`“${SLIDE_ROLE_LABEL[s.role]}” slaytı kaynakta aynen yok: «${v.missing[0] ?? ""}»`);
        }
      }
    }
    gates.push(result("alinti", problems.length === 0, `${problems.slice(0, 3).join("; ")}.`));
  }

  // 7 · yasak ifade (yalnız kendi metnimiz)
  {
    const own = [
      ...payload.slides.filter((s) => !s.quote).map(slideText),
      payload.caption,
      payload.hashtags.join(" "),
    ]
      .join("\n")
      .trim();
    const t = tl(own);
    const found = FORBIDDEN.filter((f) => f.re.test(t)).map((f) => f.label);
    gates.push(result("ifade", found.length === 0, `kendi metninizde: ${found.join("; ")}.`));
  }

  // 8–9 · hukuk günü: kimlik taraması (alıntı DAHİL tüm metin) + insan onayı
  if (legal) {
    const all = [...payload.slides.map(slideText), payload.caption].join("\n");
    const hits = scanIdentity(all);
    gates.push(result("kimlik-tarama", hits.length === 0, `${describeHits(hits)}. Metni düzeltin ya da başka bir kesit seçin.`));
  }
  if (series.attestIdentity) {
    gates.push(result("kimlik-onay", input.attestIdentity === true, "“Taraf adı / kimlik bilgisi içermiyor” kutusunu, metni gözle kontrol ettikten sonra işaretleyin."));
  }

  return { ok: gates.every((g) => g.ok || g.severity === "warn"), checkedAt, gates };
}

/** Başarısız (ekranda kırmızı/amber gösterilecek) kapılar. */
export function failedGates(report: GateReport): GateResult[] {
  return report.gates.filter((g) => !g.ok);
}
