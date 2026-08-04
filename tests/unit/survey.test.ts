// Doctorium anket — saf mantık sözleşmeleri (v6.69 Faz 2). DB'li yollar entegrasyon işidir;
// burada REJİM AYRIMI (içerik ⇄ pazarlama) + honorarium yayın kilidi + şık ayrıştırma kilitlenir.
import { describe, it, expect } from "vitest";
import {
  visibleSurveys, canActivateSurvey, parseOptions, MAX_FEED_SURVEYS, MIN_OPTIONS, MAX_OPTIONS,
} from "@/lib/survey";

const sv = (kind: string, tb: string | null, tc: string | null, id = "x") =>
  ({ id, kind, targetBranches: tb, targetCities: tc });

describe("rejim ayrımı — COMMUNITY içerik / SPONSORED pazarlama", () => {
  it("COMMUNITY branş-hedefli anket RIZASIZ doktora da görünür (içerik rejimi — akış süzmesiyle aynı)", () => {
    const rows = [sv("COMMUNITY", '["onkoloji"]', null, "c1")];
    const out = visibleSurveys(rows, { personalized: false, branches: ["onkoloji"], city: null });
    expect(out.map((s) => s.id)).toEqual(["c1"]);
  });

  it("COMMUNITY hedefli anket akış-branşı kesişmeyince görünmez; hedefsiz herkese", () => {
    const rows = [sv("COMMUNITY", '["kardiyoloji"]', null, "c1"), sv("COMMUNITY", null, null, "c2")];
    const out = visibleSurveys(rows, { personalized: true, branches: ["onkoloji"], city: null });
    expect(out.map((s) => s.id)).toEqual(["c2"]);
  });

  it("COMMUNITY'de şehir hedefi YOK SAYILIR (içerik rejimi şehirle süzülmez)", () => {
    const rows = [sv("COMMUNITY", null, '["İstanbul"]', "c1")];
    const out = visibleSurveys(rows, { personalized: false, branches: [], city: "Ankara" });
    expect(out.map((s) => s.id)).toEqual(["c1"]);
  });

  it("SPONSORED hedefli anket rızasız doktora GÖRÜNMEZ (pazarlama rejimi — kampanya kuralı)", () => {
    const rows = [sv("SPONSORED", '["onkoloji"]', null, "s1"), sv("SPONSORED", null, null, "s2")];
    const out = visibleSurveys(rows, { personalized: false, branches: ["onkoloji"], city: null });
    expect(out.map((s) => s.id)).toEqual(["s2"]);
  });

  it("SPONSORED hedefli anket rızalı + kesişen doktora görünür", () => {
    const rows = [sv("SPONSORED", '["onkoloji"]', null, "s1")];
    const out = visibleSurveys(rows, { personalized: true, branches: ["onkoloji"], city: null });
    expect(out.map((s) => s.id)).toEqual(["s1"]);
  });
});

describe("honorarium yayın kilidi (ödeme kurgusu 👤 parkı)", () => {
  it("honorarium yok/0 → yayınlanabilir; >0 → KİLİTLİ (ödenir vaadi verilmez)", () => {
    expect(canActivateSurvey({ honorarium: null })).toBe(true);
    expect(canActivateSurvey({ honorarium: 0 })).toBe(true);
    expect(canActivateSurvey({ honorarium: 1 })).toBe(false);
    expect(canActivateSurvey({ honorarium: 50000 })).toBe(false);
  });
});

describe("şık ayrıştırma + sabitler", () => {
  it("bozuk JSON şık listesi boş döner (kart çizilmez, akış düşmez)", () => {
    expect(parseOptions("{bozuk")).toEqual([]);
    expect(parseOptions('["Evet","Hayır"]')).toEqual(["Evet", "Hayır"]);
  });

  it("akışta aynı anda tek anket; şık sınırları 2-6", () => {
    expect(MAX_FEED_SURVEYS).toBe(1);
    expect(MIN_OPTIONS).toBe(2);
    expect(MAX_OPTIONS).toBe(6);
  });
});
