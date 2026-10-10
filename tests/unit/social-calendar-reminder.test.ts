// İçerik takvimi — rubrik hatırlatması (v6.345). SAF karar + e-posta metni; DB/Resend yok.
import { describe, expect, it } from "vitest";
import { gununRubrigi, hatirlatmaEpostasi, hatirlatmaMaddeleri, yuvaNedeni, type YuvaDurumu } from "@/lib/social-calendar/reminder";

// 2026-10-12 Pzt (Etkinlik radarı) · 13 Sal · 14 Çar (Karar masası) · 15 Per · 16 Cum (Öğrenci köşesi) · 17 Cmt · 18 Paz
const PANEL = "https://doctorium.tr/admin/icerik-takvimi";
const bos = (): YuvaDurumu => null;
const hepsi = (y: YuvaDurumu) => () => y;

describe("yuvaNedeni", () => {
  it("hazır olmayan durumlar neden döndürür", () => {
    expect(yuvaNedeni(null)).toMatch(/açılmamış/);
    expect(yuvaNedeni({ status: "PLANNED", intact: false })).toMatch(/taslak yok/);
    expect(yuvaNedeni({ status: "DRAFT", intact: false })).toMatch(/ONAYLANMADI/);
    expect(yuvaNedeni({ status: "APPROVED", intact: false })).toMatch(/onay düştü/);
    expect(yuvaNedeni({ status: "FAILED", intact: false })).toMatch(/yeniden dene/);
    expect(yuvaNedeni({ status: "TUHAF", intact: false })).toMatch(/bilinmeyen/);
  });
  it("hazır ya da bilinçli kararlar SESSİZ", () => {
    expect(yuvaNedeni({ status: "APPROVED", intact: true })).toBeNull();
    for (const s of ["SKIPPED", "PUBLISHING", "PUBLISHED"]) expect(yuvaNedeni({ status: s, intact: false })).toBeNull();
  });
});

describe("gununRubrigi (series.ts takvimi)", () => {
  it("Pzt/Çar/Cum rubrik, diğer günler yok", () => {
    expect(gununRubrigi("2026-10-12")?.key).toBe("etkinlik-radari");
    expect(gununRubrigi("2026-10-14")?.key).toBe("karar-masasi");
    expect(gununRubrigi("2026-10-16")?.key).toBe("ogrenci-kosesi");
    for (const g of ["2026-10-13", "2026-10-15", "2026-10-17", "2026-10-18"]) expect(gununRubrigi(g)).toBeNull();
  });
});

describe("hatirlatmaMaddeleri", () => {
  it("Çarşamba sabahı: bugün (acil) Karar masası; yarın (Per) rubrik yok", () => {
    const m = hatirlatmaMaddeleri("2026-10-14", bos);
    expect(m).toEqual([expect.objectContaining({ seviye: "acil", seriesKey: "karar-masasi", slotDay: "2026-10-14" })]);
  });
  it("Salı sabahı: bugün rubrik yok; yarın (Çar) hazırlık", () => {
    const m = hatirlatmaMaddeleri("2026-10-13", bos);
    expect(m).toEqual([expect.objectContaining({ seviye: "hazirlik", seriesKey: "karar-masasi", slotDay: "2026-10-14" })]);
  });
  it("Pazar sabahı: yarın (Pzt) Etkinlik radarı hazırlık · Cumartesi sabahı: hiçbir şey", () => {
    expect(hatirlatmaMaddeleri("2026-10-18", bos)).toEqual([expect.objectContaining({ seviye: "hazirlik", seriesKey: "etkinlik-radari", slotDay: "2026-10-19" })]);
    expect(hatirlatmaMaddeleri("2026-10-17", bos)).toEqual([]);
  });
  it("hazır yuva (onaylı + mühür sağlam) ya da atlanmış yuva → hatırlatma YOK", () => {
    expect(hatirlatmaMaddeleri("2026-10-14", hepsi({ status: "APPROVED", intact: true }))).toEqual([]);
    expect(hatirlatmaMaddeleri("2026-10-14", hepsi({ status: "SKIPPED", intact: false }))).toEqual([]);
  });
  it("durum sorgusu doğru (rubrik, gün) çiftiyle çağrılır", () => {
    const sorulan: string[] = [];
    hatirlatmaMaddeleri("2026-10-13", (k, g) => { sorulan.push(`${k}@${g}`); return null; });
    expect(sorulan).toEqual(["karar-masasi@2026-10-14"]);
  });
});

describe("hatirlatmaEpostasi", () => {
  it("madde yoksa e-posta yok", () => {
    expect(hatirlatmaEpostasi([], PANEL)).toBeNull();
  });
  it("acil: konu 'BUGÜN 12:00', gövdede durum + o haftanın panel bağlantısı + atla ipucu + çıkarım notu", () => {
    const e = hatirlatmaEpostasi(hatirlatmaMaddeleri("2026-10-14", hepsi({ status: "DRAFT", intact: false })), PANEL)!;
    expect(e.subject).toBe("[DOCTORIUM İÇERİK TAKVİMİ] BUGÜN 12:00 — Karar masası (14 Ekim 2026) onay bekliyor");
    expect(e.text).toContain("ONAYLANMADI");
    expect(e.text).toContain(`${PANEL}?hafta=2026-10-14`);
    expect(e.text).toContain("'Atla'");
    expect(e.text).toContain("Doktor için çıkarım");
  });
  it("hazırlık: konu 'Yarın 12:00'; Karar masası değilse çıkarım notu yok", () => {
    const e = hatirlatmaEpostasi(hatirlatmaMaddeleri("2026-10-15", bos), PANEL)!;
    expect(e.subject).toBe("[DOCTORIUM İÇERİK TAKVİMİ] Yarın 12:00 — Öğrenci köşesi (16 Ekim 2026) onay bekliyor");
    expect(e.text).not.toContain("Doktor için çıkarım");
  });
  it("metinde 'hekim' YOK (terim kuralı) ve gövde PHI taşımaz (yalnız rubrik/gün/durum)", () => {
    const e = hatirlatmaEpostasi(hatirlatmaMaddeleri("2026-10-14", bos), PANEL)!;
    expect(`${e.subject} ${e.text}`).not.toMatch(/hekim/i);
  });
});
