// Haber özeti ONARIM kararları (scripts/repair-news-summaries.ts'in saf çekirdeği).
//
// Kilitlenenler: (1) çevrilmiş satırda yalnız ÖZGÜN metin onarılır, Türkçe giriş korunur; (2) sayfa-metni onarımı yalnız
// ingest imzasını (> 500 kar.) aşan satıra dokunur ve çevrilmiş satırı yeniden kuyruğa alır; (3) ikisi de idempotent;
// (4) "gövde yok" boşaltır, "erişilemedi" bu katmana hiç gelmez (betik yazmaz — yazma yolunun güvencesi).
import { describe, it, expect } from "vitest";
import { INGEST_SUMMARY_MAX, planLabelRepair, planPageTextRepair } from "@/lib/summary-repair";

describe("planLabelRepair", () => {
  it("çevrilmemiş satır: summary onarılır", () => {
    expect(planLabelRepair({ summary: "BackgroundGas flaring is bad.ObjectiveTo assess it.", summaryOriginal: null }))
      .toEqual({ summary: "Background: Gas flaring is bad. Objective: To assess it." });
  });

  it("çevrilmiş satır: YALNIZ özgün (summaryOriginal) onarılır — Türkçe giriş korunur (yama summary'ye dokunmaz)", () => {
    const patch = planLabelRepair({ summary: "Gaz yakma kötüdür.", summaryOriginal: "BackgroundGas flaring is bad.ObjectiveTo assess it." });
    expect(patch).toEqual({ summaryOriginal: "Background: Gas flaring is bad. Objective: To assess it." });
    expect(patch).not.toHaveProperty("summary");
  });

  it("zaten temiz satır null döner; onarılmış metin yeniden onarılmaz (idempotent)", () => {
    expect(planLabelRepair({ summary: "Background: Already fine.", summaryOriginal: null })).toBeNull();
    const once = planLabelRepair({ summary: "BackgroundText.", summaryOriginal: null });
    expect(once).not.toBeNull();
    expect(planLabelRepair({ summary: once?.summary as string, summaryOriginal: null })).toBeNull();
  });
});

describe("planPageTextRepair", () => {
  const polluted = `IDCM Dergisinin Eylül 2026 Sayısı Yayında! | Klimik ${"Dernek Kurullar Üyelik ".repeat(30)}`; // > 500 kar.

  it("imza eşiği ingest sınırıyla aynıdır (RSS 500 · WHO/ClinicalTrials 400)", () => {
    expect(INGEST_SUMMARY_MAX).toBe(500);
    expect(polluted.length).toBeGreaterThan(INGEST_SUMMARY_MAX);
  });

  it("kirli sayfa-metni, yeni çıkarımla DEĞİŞTİRİLİR", () => {
    expect(planPageTextRepair({ summary: polluted, summaryOriginal: null }, "Yalnızca makale gövdesi burada yer alır."))
      .toEqual({ summary: "Yalnızca makale gövdesi burada yer alır.", summaryOriginal: null });
  });

  it("gövde yoksa (fresh = null) özet BOŞALTILIR — menü özet olarak kalmaz", () => {
    expect(planPageTextRepair({ summary: polluted, summaryOriginal: null }, null)).toEqual({ summary: "", summaryOriginal: null });
  });

  it("RSS/liste özetine (≤ 500 kar.) DOKUNMAZ — sayfa-metni değildir", () => {
    expect(planPageTextRepair({ summary: "x".repeat(INGEST_SUMMARY_MAX), summaryOriginal: null }, "başka")).toBeNull();
    expect(planPageTextRepair({ summary: "Yeni Sayı İçin Tıklayınız", summaryOriginal: null }, null)).toBeNull();
  });

  it("yeni çıkarım mevcutla aynıysa null (idempotent: ikinci koşu değişiklik bulmaz)", () => {
    const clean = "Gerçek makale gövdesi. ".repeat(40); // > 500 kar. ama zaten temiz
    expect(planPageTextRepair({ summary: clean, summaryOriginal: null }, clean)).toBeNull();
  });

  it("çevrilmiş satır YENİDEN KUYRUĞA girer: özgün yeni metne, summaryOriginal null (çeviri hattı yeniden çevirir)", () => {
    const patch = planPageTextRepair({ summary: "Kirli metnin Türkçe girişi", summaryOriginal: polluted }, "Clean English body text.");
    expect(patch).toEqual({ summary: "Clean English body text.", summaryOriginal: null });
  });

  it("çevrilmiş satırda eşik ÖZGÜN metne bakar (Türkçe giriş kısa olsa da)", () => {
    expect(planPageTextRepair({ summary: "kısa", summaryOriginal: polluted }, null)).toEqual({ summary: "", summaryOriginal: null });
    expect(planPageTextRepair({ summary: "x".repeat(900), summaryOriginal: "kısa özgün" }, null)).toBeNull();
  });
});
