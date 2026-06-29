// Birim testleri — lib/journey.ts (lojistik Patient Journey parse/normalize). Saf, DB yok.
import { describe, it, expect } from "vitest";
import {
  defaultJourney,
  parseJourney,
  journeyProgress,
  isJourneyStatus,
  JOURNEY_STAGE_KEYS,
} from "@/lib/journey";

describe("defaultJourney", () => {
  it("5 aşama, ilki active gerisi pending", () => {
    const d = defaultJourney();
    expect(d).toHaveLength(5);
    expect(d[0].status).toBe("active");
    expect(d.slice(1).every((s) => s.status === "pending")).toBe(true);
    expect(d.map((s) => s.key)).toEqual(JOURNEY_STAGE_KEYS);
  });
});

describe("isJourneyStatus", () => {
  it("geçerli statüleri tanır", () => {
    expect(isJourneyStatus("pending")).toBe(true);
    expect(isJourneyStatus("active")).toBe(true);
    expect(isJourneyStatus("done")).toBe(true);
  });
  it("geçersiz değerleri reddeder", () => {
    expect(isJourneyStatus("foo")).toBe(false);
    expect(isJourneyStatus(null)).toBe(false);
    expect(isJourneyStatus(42)).toBe(false);
  });
});

describe("parseJourney — bozuk/eksik girdi güvenliği", () => {
  it("null/undefined → defaultJourney", () => {
    expect(parseJourney(null).map((s) => s.status)).toEqual(defaultJourney().map((s) => s.status));
    expect(parseJourney(undefined)).toHaveLength(5);
  });
  it("geçersiz JSON → defaultJourney", () => {
    expect(parseJourney("{bozuk")).toHaveLength(5);
    expect(parseJourney("not json at all")[0].status).toBe("active");
  });
  it("dizi değilse → defaultJourney", () => {
    expect(parseJourney("{}")).toHaveLength(5);
    expect(parseJourney('"string"')).toHaveLength(5);
  });
});

describe("parseJourney — normalize", () => {
  it("bilinmeyen key atılır, eksik aşama default ile doldurulur, kanonik sıra korunur", () => {
    const json = JSON.stringify([
      { key: "transfer", status: "done", note: "VIP karşılama" },
      { key: "BOGUS", status: "active" }, // bilinmeyen → atılır
    ]);
    const out = parseJourney(json);
    expect(out).toHaveLength(5);
    expect(out.map((s) => s.key)).toEqual(JOURNEY_STAGE_KEYS); // sıra korunur, BOGUS yok
    expect(out[0]).toMatchObject({ key: "transfer", status: "done", note: "VIP karşılama" });
    expect(out[1].status).toBe("pending"); // hotel — eksikti, default doldurdu
  });

  it("geçersiz status → pending'e düşer", () => {
    const json = JSON.stringify([{ key: "hotel", status: "tamamlandı" }]);
    const hotel = parseJourney(json).find((s) => s.key === "hotel");
    expect(hotel?.status).toBe("pending");
  });
});

describe("journeyProgress", () => {
  it("tamamlanan sayısını ve aktif aşama etiketini döner", () => {
    const stages = parseJourney(
      JSON.stringify([
        { key: "transfer", status: "done" },
        { key: "hotel", status: "active" },
      ]),
    );
    const p = journeyProgress(stages);
    expect(p.done).toBe(1);
    expect(p.total).toBe(5);
    expect(p.current).toBe("Otel girişi");
  });

  it("hepsi tamamlandıysa son aşamayı gösterir", () => {
    const stages = JOURNEY_STAGE_KEYS.map((key) => ({ key, status: "done" as const }));
    const p = journeyProgress(stages);
    expect(p.done).toBe(5);
    expect(p.current).toBe("Taburcu & dönüş");
  });
});
