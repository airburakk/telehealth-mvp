// Kariyer EDU — son başvurusu geçen fırsat (2026-10-02, 👤 karar: "sona al, 'başvuru kapandı' yaz").
//
// Bulgu: liste tarihli kayıtları artan sırada ÖNE alıyor ve geçmiş tarihi ayıklamıyordu → TEV (son başvuru 8 Ekim) ve VKV
// (9 Ekim) süresi dolunca landing "Öğrenciler" penceresinin ve portal Fırsatlar listesinin EN ÜSTÜNDE kalacaktı.
// Kilitlenenler:
//   1) "geçti" Türkiye takvim gününe göredir; son başvuru GÜNÜ dahil açıktır; tarihsiz kayıt kapanmaz,
//   2) sıra: açık tarihliler → dönemsel → kapananlar (en son kapanan üstte); kapanan kayıt GİZLENMEZ,
//   3) satır "başvuru kapandı" yazar ve takip düğmesi almaz,
//   4) yönetim listesi eski sırada kalır (süresi geçen üstte = güncelleme sinyali).
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { EDU_OPPORTUNITIES, approvedEduOpportunities, isEduClosed, orderEduOpportunities } from "@/lib/edu-opportunities";
import { todayIsoTr } from "@/lib/iso-day";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("todayIsoTr: Türkiye takvim günü", () => {
  it("UTC 20:59 → aynı gün; UTC 21:00 → Türkiye'de ertesi gün (UTC+3)", () => {
    expect(todayIsoTr(new Date("2026-10-08T20:59:59Z"))).toBe("2026-10-08");
    expect(todayIsoTr(new Date("2026-10-08T21:00:00Z"))).toBe("2026-10-09");
    expect(todayIsoTr(new Date("2026-12-31T21:30:00Z"))).toBe("2027-01-01");
  });
});

describe("isEduClosed: son başvuru günü dahil açık", () => {
  it("son gün açık, ertesi gün kapalı, tarihsiz kayıt hiç kapanmaz", () => {
    expect(isEduClosed({ deadline: "2026-10-08" }, "2026-10-07")).toBe(false);
    expect(isEduClosed({ deadline: "2026-10-08" }, "2026-10-08")).toBe(false);
    expect(isEduClosed({ deadline: "2026-10-08" }, "2026-10-09")).toBe(true);
    expect(isEduClosed({ deadline: null }, "2099-01-01")).toBe(false);
  });
  it("TEV son başvurusu 8 Ekim TSİ gün sonuna dek açıktır (UTC 20:59), gece yarısı kapanır", () => {
    const tev = EDU_OPPORTUNITIES.find((o) => o.id === "tev-universite-2026")!;
    expect(isEduClosed(tev, todayIsoTr(new Date("2026-10-08T20:59:00Z")))).toBe(false);
    expect(isEduClosed(tev, todayIsoTr(new Date("2026-10-08T21:00:00Z")))).toBe(true);
  });
});

describe("orderEduOpportunities: açık tarihli → dönemsel → kapanan", () => {
  const rows = [
    { id: "kapandi-eski", deadline: "2026-09-01" },
    { id: "acik-yakin", deadline: "2026-10-09" },
    { id: "donemsel-1", deadline: null },
    { id: "kapandi-yeni", deadline: "2026-10-08" },
    { id: "acik-uzak", deadline: "2026-11-15" },
    { id: "donemsel-2", deadline: null },
  ];
  it("kapananlar sona iner (en son kapanan üstte); açıklar ve dönemseller giriş sırasını korur", () => {
    expect(orderEduOpportunities(rows, "2026-10-09").map((r) => r.id)).toEqual([
      "acik-yakin", "acik-uzak", "donemsel-1", "donemsel-2", "kapandi-yeni", "kapandi-eski",
    ]);
  });
  it("hiçbir kayıt düşmez — kapanan GİZLENMEZ", () => {
    expect(orderEduOpportunities(rows, "2030-01-01")).toHaveLength(rows.length);
    expect(orderEduOpportunities(rows, "2030-01-01").slice(0, 2).map((r) => r.id)).toEqual(["donemsel-1", "donemsel-2"]);
  });
});

describe("approvedEduOpportunities: gün verilince kapananlar sona iner", () => {
  it("5 Ekim: TEV ve VKV en üstte (açık); 10 Ekim: ikisi de en sonda, VKV (son kapanan) önce", () => {
    const before = approvedEduOpportunities(EDU_OPPORTUNITIES, "2026-10-05").map((o) => o.id);
    expect(before.slice(0, 2)).toEqual(["tev-universite-2026", "vkv-universite-2026"]);
    const after = approvedEduOpportunities(EDU_OPPORTUNITIES, "2026-10-10").map((o) => o.id);
    expect(after.slice(-2)).toEqual(["vkv-universite-2026", "tev-universite-2026"]);
    expect(after).toHaveLength(before.length);
    // En üstte artık süresi geçmiş kayıt yok.
    const first = EDU_OPPORTUNITIES.find((o) => o.id === after[0])!;
    expect(isEduClosed(first, "2026-10-10")).toBe(false);
  });
  it("gün verilmezse eski (zamansız) sıra: tarihli önce — saf modül saat okumaz", () => {
    const rows = approvedEduOpportunities(EDU_OPPORTUNITIES);
    expect(rows[0].id).toBe("tev-universite-2026");
    expect(read("src/lib/edu-opportunities.ts")).not.toMatch(/new Date\(|Date\.now\(/);
  });
});

describe("yüzey ve veri katmanı (kaynak kilitleri)", () => {
  it("satır kapanan kayıtta 'başvuru kapandı' yazar; takip düğmesi yalnız açık tarihli kayıtta", () => {
    const row = read("src/app/doktor/doctorium/CareerEduSections.tsx");
    expect(row).toMatch(/o\.closed \? \(\s*<span>başvuru kapandı · \{formatIsoDayTr\(o\.deadline\)\}<\/span>/);
    expect(row).toMatch(/canFollow && o\.deadline && !o\.closed \? <EduFollowButton/);
  });
  it("onaylı liste kapananları sona alır; yönetim listesi eski sırada kalır; 'bugün' veri katmanında hesaplanır", () => {
    const store = read("src/lib/edu-store.ts");
    expect(store).toMatch(/return orderEduOpportunities\(rows\.map\(\(r\) => toView\(r, today\)\)\.sort\(order\), today\);/);
    expect(store).toMatch(/followers: cnt\.get\(r\.id\) \?\? 0 \}\)\)\.sort\(order\);/);
    expect(store).toMatch(/closed: isEduClosed\(\{ deadline: day\(r\.deadline\) \}, today\)/);
    const feed = read("src/lib/doctorium-landing/landing-feed.ts");
    expect(feed).toMatch(/approvedEduOpportunities\(undefined, today\)\.map\(\(o\) => \(\{ \.\.\.o, closed: isEduClosed\(o, today\) \}\)\)/);
  });
  it("AAMC kaynağı ölü adres değil (2026-10-02: eski 'article/global-network' 404)", () => {
    const aamc = EDU_OPPORTUNITIES.find((o) => o.id === "aamc-vslo")!;
    expect(aamc.sourceUrl).not.toContain("/article/global-network");
    expect(aamc.sourceUrl).toBe("https://students-residents.aamc.org/visiting-student-learning-opportunities/seeking-global-opportunity");
    expect(aamc.verifiedAt).toBe("2026-10-02");
  });
});
