// Kariyer EDU (E1) + TUS dönem tablosu (T1) VERİ SÖZLEŞMESİ — kaynaksız/doğrulanmamış satır yok, İŞKUR dili yok,
// onaysız satır görünmez (veri fazları planı 2026-09-05, "değişmeyen kurallar"). DB'siz saf modüller.
import { describe, it, expect } from "vitest";
import { EDU_OPPORTUNITIES, approvedEduOpportunities, EDU_KIND_LABEL, eduCountryLabel } from "@/lib/edu-opportunities";
import { TUS_EXAM_PERIODS, tusCalendarItems, TUS_OFFICIAL_LINKS } from "@/lib/tus";
import { formatIsoDayTr } from "@/lib/iso-day";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
// Resmî kaynak alan adları — yeni kayıt eklerken burada yoksa ya alan adını ekle (kurumun kendi sitesi) ya da kaydı alma.
const OFFICIAL_HOSTS = ["tev.org.tr", "vkv.org.tr", "tubitak.gov.tr", "gsb.gov.tr", "vgm.gov.tr", "yok.gov.tr", "ua.gov.tr", "turkmsic.org", "aamc.org", "who.int"];
const host = (u: string) => new URL(u).hostname.replace(/^www\./, "");
const officialHost = (h: string) => OFFICIAL_HOSTS.some((d) => h === d || h.endsWith("." + d));
// ⚖️ İŞKUR sınırı (CareerDisclaimer dili): ilan/işe alım/pozisyon dili yok; terim kuralı: "hekim" yok.
const FORBIDDEN = ["hekim", "ilan", "işe alım", "pozisyon", "kadro", "maaş"];

describe("Kariyer EDU verisi (E1)", () => {
  it("13 kayıt; id benzersiz; tür etiketli; kaynak https + resmî alan adı; verifiedAt ISO", () => {
    expect(EDU_OPPORTUNITIES.length).toBe(13);
    expect(new Set(EDU_OPPORTUNITIES.map((o) => o.id)).size).toBe(EDU_OPPORTUNITIES.length);
    for (const o of EDU_OPPORTUNITIES) {
      expect(EDU_KIND_LABEL[o.kind]).toBeTruthy();
      expect(o.sourceUrl.startsWith("https://"), o.id).toBe(true);
      expect(officialHost(host(o.sourceUrl)), `${o.id}: ${o.sourceUrl}`).toBe(true);
      expect(o.verifiedAt, o.id).toMatch(ISO);
      expect(o.title.length).toBeGreaterThan(8);
      expect(o.eligibility.length).toBeGreaterThan(20);
      expect(o.eligibility.length, o.id).toBeLessThanOrEqual(420);
    }
  });
  it("son başvuru: ISO gün ya da null + deadlineNote (dönemsel kayıt takvime düşmez)", () => {
    for (const o of EDU_OPPORTUNITIES) {
      if (o.deadline === null) expect(o.deadlineNote, o.id).toBeTruthy();
      else expect(o.deadline, o.id).toMatch(ISO);
    }
    expect(EDU_OPPORTUNITIES.filter((o) => o.deadline).length).toBeGreaterThanOrEqual(2);
  });
  it("İŞKUR + terim dili: metinlerde ilan/işe alım/pozisyon/kadro/maaş/hekim geçmez", () => {
    for (const o of EDU_OPPORTUNITIES) {
      const t = `${o.title} ${o.eligibility} ${o.deadlineNote ?? ""}`.toLocaleLowerCase("tr");
      for (const w of FORBIDDEN) expect(t, `${o.id} → ${w}`).not.toContain(w);
    }
  });
  it("onaysız satır GÖRÜNMEZ; onaylılar tarihli-önce sıralanır", () => {
    expect(approvedEduOpportunities(EDU_OPPORTUNITIES.map((o) => ({ ...o, approvedAt: null })))).toEqual([]);
    const sample = EDU_OPPORTUNITIES.map((o, i) => ({ ...o, approvedAt: i % 2 === 0 ? "2026-09-05" : null }));
    const rows = approvedEduOpportunities(sample);
    expect(rows.length).toBe(sample.filter((o) => o.approvedAt).length);
    const dated = rows.filter((o) => o.deadline).map((o) => o.deadline as string);
    expect(dated).toEqual([...dated].sort());
    const firstUndated = rows.findIndex((o) => !o.deadline);
    if (firstUndated >= 0) expect(rows.slice(firstUndated).every((o) => !o.deadline)).toBe(true);
  });
  it("ülke etiketi: TR → Türkiye, null → Çok ülkeli", () => {
    expect(eduCountryLabel("TR")).toBe("Türkiye");
    expect(eduCountryLabel(null)).toBe("Çok ülkeli");
  });
});

describe("TUS dönemleri (T1)", () => {
  it("6 dönem (2024/1 → 2026/2), kronolojik, (yıl, dönem) benzersiz, ÖSYM kaynaklı, ISO günler", () => {
    expect(TUS_EXAM_PERIODS.length).toBe(6);
    const keys = TUS_EXAM_PERIODS.map((p) => `${p.year}-${p.term}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(["2024-1", "2024-2", "2025-1", "2025-2", "2026-1", "2026-2"]);
    for (const p of TUS_EXAM_PERIODS) {
      expect(host(p.sourceUrl)).toBe("osym.gov.tr");
      expect(p.examDate).toMatch(ISO);
      expect(p.resultDate).toMatch(ISO);
      expect(p.verifiedAt).toMatch(ISO);
      if (p.applicationStart) expect(p.applicationEnd).toMatch(ISO);
      expect(p.examDate! < p.resultDate!, `${p.year}/${p.term}`).toBe(true);
    }
    expect(TUS_OFFICIAL_LINKS.every((l) => host(l.href).endsWith("osym.gov.tr"))).toBe(true);
  });
  it("2026-TUS: 1. dönem 15 Mart / 15 Nisan, 2. dönem 23 Ağustos / 17 Eylül (ÖSYM sınav takvimi)", () => {
    const t1 = TUS_EXAM_PERIODS.find((p) => p.year === 2026 && p.term === 1)!;
    const t2 = TUS_EXAM_PERIODS.find((p) => p.year === 2026 && p.term === 2)!;
    expect([t1.examDate, t1.resultDate]).toEqual(["2026-03-15", "2026-04-15"]);
    expect([t2.applicationStart, t2.applicationEnd, t2.examDate, t2.resultDate]).toEqual(["2026-07-08", "2026-07-16", "2026-08-23", "2026-09-17"]);
  });
  it("tusCalendarItems: Ağustos 2026 penceresi 2026/2 sınavını içerir, Temmuz başvuru aralığını, Eylül sonucu; Ocak 2020 boş", () => {
    const aug = tusCalendarItems("2026-08-01", "2026-09-01");
    expect(aug.some((i) => i.title.includes("2026-TUS 2. Dönem") && i.title.includes("sınav") && i.start === "2026-08-23")).toBe(true);
    const jul = tusCalendarItems("2026-07-01", "2026-08-01");
    expect(jul.some((i) => i.title.includes("başvuru") && i.start === "2026-07-08" && i.end === "2026-07-16")).toBe(true);
    const sep = tusCalendarItems("2026-09-01", "2026-10-01");
    expect(sep.some((i) => i.title.includes("sonuç") && i.start === "2026-09-17")).toBe(true);
    expect(tusCalendarItems("2020-01-01", "2020-02-01")).toEqual([]);
    for (const i of [...aug, ...jul, ...sep]) { expect(i.kind).toBe("tus"); expect(i.href).toBe("/doktor/doctorium/tus"); }
  });
  it("formatIsoDayTr: UTC eksen, Türkçe uzun tarih", () => {
    expect(formatIsoDayTr("2026-10-08")).toBe("8 Ekim 2026");
    expect(formatIsoDayTr("2026-03-15")).toBe("15 Mart 2026");
  });
});
