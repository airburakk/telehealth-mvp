// İçerik hattı sessiz kuruma nöbeti — saf mantık sözleşmeleri (v6.337, 2026-10-07).
//
// Kilitlenenler:
//   1) İlk hata metni audit detail'ine tek satır, kısa ve segment ayracını (" · ") bozmadan girer.
//   2) "Kuru" = iş çöktü (`hata:`) YA DA hiçbir şey bulamayıp hata verdi (`yeni=0/0 sorun=N`).
//      Hatasız 0/0 ve kısmi bulgu (0/60 sorun=4) kuru DEĞİLDİR — alarm sessiz hatayı hedefler.
//   3) Seri, en yeni satırdan başlayıp ilk kuru-olmayan satırda kesilir; ESKİ biçimli satırlar
//      (v6.337 öncesi, `ilk=` etiketsiz) da sayılır → ilk koşuda geçmiş seri görünür.
//   4) Alarm eşikte bir kez + haftalık hatırlatma (üretimde e-posta açık — her gün değil).
// Fikstür satırları PROD audit zincirinden alınmış GERÇEK biçimlerdir (2026-09/10).
import { describe, it, expect } from "vitest";
import {
  dryStreak, firstErrorTag, isDrySegment, shouldAlertStreak, DRY_STREAK_THRESHOLD, DRY_STREAK_REMIND_EVERY,
} from "@/lib/ingest-streak";

const KURU_ESKI = "ictihat yeni=0/0 sorun=1 · doktrin yeni=0/32 · ttb atlandi(haftalik)";
const KURU_YENI = 'ictihat yeni=0/0 sorun=1 ilk="arama \'hekimin hukuki sorumluluğu\': HTTP 403" · doktrin yeni=0/32 · ttb atlandi(haftalik)';
const KISMI = "ictihat yeni=0/60 sorun=4 · doktrin yeni=0/33 · ttb atlandi(haftalik)";
const HATASIZ_BOS = "ictihat yeni=0/21 · doktrin yeni=0/0 · ttb atlandi(haftalik)";
const COKTU = "ictihat hata: fetch failed · doktrin hata: içerik okunamadı · ttb atlandi(haftalik)";
const DOKTRIN_KURU = "ictihat yeni=0/0 sorun=1 · doktrin yeni=0/0 sorun=1 · ttb yeni=1 guncel=29 devir=3/33";

describe("firstErrorTag: ilk hata metni audit satırına", () => {
  it("hata yoksa boş dize — detail biçimi değişmez", () => {
    expect(firstErrorTag([])).toBe("");
    expect(firstErrorTag(["  "])).toBe("");
  });

  it("ilk dolu hata tek satır, tırnaklı etiket olur", () => {
    expect(firstErrorTag(['arama "tıbbi hata": HTTP 403', "karar 12: metin boş"])).toBe(` ilk="arama 'tıbbi hata': HTTP 403"`);
  });

  it("segment ayracı ve satır kırığı ayıklanır — detail bölünebilir kalır", () => {
    const tag = firstErrorTag(["a · b\n  c"]);
    expect(tag).toBe(' ilk="a - b c"');
    expect(`ictihat yeni=0/0 sorun=1${tag} · doktrin yeni=0/1`.split(" · ")).toHaveLength(2);
  });

  it("120 karakterde kırpılır", () => {
    const tag = firstErrorTag(["x".repeat(500)]);
    expect(tag).toBe(` ilk="${"x".repeat(120)}"`);
  });
});

describe("isDrySegment: kuru koşu tanımı", () => {
  it("hiçbir şey bulunamadı + hata = kuru (eski ve yeni biçim)", () => {
    expect(isDrySegment(KURU_ESKI, "ictihat")).toBe(true);
    expect(isDrySegment(KURU_YENI, "ictihat")).toBe(true);
  });

  it("iş tamamen çöktü (`hata:`) = kuru", () => {
    expect(isDrySegment(COKTU, "ictihat")).toBe(true);
    expect(isDrySegment(COKTU, "doktrin")).toBe(true);
  });

  it("kısmi bulgu ve hatasız boşluk kuru DEĞİLDİR", () => {
    expect(isDrySegment(KISMI, "ictihat")).toBe(false);
    expect(isDrySegment(HATASIZ_BOS, "ictihat")).toBe(false);
    expect(isDrySegment(HATASIZ_BOS, "doktrin")).toBe(false);
  });

  it("segmentler birbirine karışmaz", () => {
    expect(isDrySegment(KURU_ESKI, "doktrin")).toBe(false); // doktrin 0/32, hatasız
    expect(isDrySegment(DOKTRIN_KURU, "doktrin")).toBe(true);
  });

  it("boş/ilgisiz satır kuru değildir", () => {
    expect(isDrySegment(null, "ictihat")).toBe(false);
    expect(isDrySegment("purge ok", "ictihat")).toBe(false);
  });
});

describe("dryStreak: ardışık kuru koşu sayısı", () => {
  it("en yeniden başlar, ilk kuru-olmayan satırda kesilir", () => {
    expect(dryStreak([KURU_YENI, KURU_ESKI, KURU_ESKI, KISMI, KURU_ESKI], "ictihat")).toBe(3);
  });

  it("en yeni satır kuru değilse seri 0", () => {
    expect(dryStreak([KISMI, KURU_ESKI, KURU_ESKI], "ictihat")).toBe(0);
  });

  it("segment başına ayrı sayılır", () => {
    expect(dryStreak([DOKTRIN_KURU, KURU_ESKI], "ictihat")).toBe(2);
    expect(dryStreak([DOKTRIN_KURU, KURU_ESKI], "doktrin")).toBe(1);
  });
});

describe("shouldAlertStreak: eşikte bir kez + haftalık hatırlatma", () => {
  it("eşiğin altında alarm yok", () => {
    for (let n = 0; n < DRY_STREAK_THRESHOLD; n++) expect(shouldAlertStreak(n)).toBe(false);
  });

  it("eşikte ve sonra her DRY_STREAK_REMIND_EVERY koşuda bir", () => {
    const fired = Array.from({ length: 30 }, (_, n) => n).filter(shouldAlertStreak);
    expect(fired).toEqual([
      DRY_STREAK_THRESHOLD,
      DRY_STREAK_THRESHOLD + DRY_STREAK_REMIND_EVERY,
      DRY_STREAK_THRESHOLD + 2 * DRY_STREAK_REMIND_EVERY,
      DRY_STREAK_THRESHOLD + 3 * DRY_STREAK_REMIND_EVERY,
    ]);
  });
});
