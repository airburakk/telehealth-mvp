// TUS normalizasyon sözleşmesi (K1, 2026-09-05): ÖSYM PDF satır ayrıştırma · kurum/branş ayracı · kurum türü · Türkçe başlık
// · özetler. Fixture satırları 2025-TUS 2. Dönem PDF'inin unpdf çıktısından (biçim birebir, sayılar örnek).
import { describe, it, expect } from "vitest";
import { parseMinMaxLines, splitProgramName, classifyInstitution, titleCaseTr, parseScore, summarizePeriod } from "@/lib/tus-normalize";

const LINES = [
  "Program Kodu Program Adı Kontenjan", "Türü", "Kontenjan", "Sayısı",
  "111000332 Sağlık Bilimleri Üniversitesi Gülhane Tıp Fakültesi, Gülhane Eğitim ve Araştırma Hastanesi (ANKARA)/KARDİYOLOJİ Yabancı Uyruklu 1 1 0 60,83174 60,83174",
  "707600101 Adli Tıp Kurumu/ADLİ TIP Genel 15 15 0 57,15968 64,04649",
  "111000101 Sağlık Bilimleri Üniversitesi Gülhane Tıp Fakültesi, Jandarma Genel Komutanlığı (ANKARA)/AİLE HEKİMLİĞİ Genel 1 0 1 -- --",
  "101400227 Atatürk Üniversitesi Tıp Fakültesi/İÇ HASTALIKLARI Genel 5 1 4 48,07522 48,07522",
  // sarmış satır: program adı alt satıra taşmış
  "102100305 Ankara Bilkent Şehir Hastanesi, Ankara Yıldırım Beyazıt Üniversitesi Tıp Fakültesi",
  "(ANKARA)/GÖZ HASTALIKLARI Genel 4 4 0 66,12345 71,00001",
  "Sayfa 12 / 62",
];

describe("parseMinMaxLines", () => {
  it("program satırlarını ayırır; başlık/sayfa satırlarını atlar; sarmış satırı birleştirir", () => {
    const { rows, skipped } = parseMinMaxLines(LINES);
    expect(rows.length).toBe(5);
    expect(skipped).toEqual([]);
    const [code, inst, branch, qt, quota, placed, vacant, min, max] = rows[0];
    expect(code).toBe("111000332");
    expect(inst).toBe("Sağlık Bilimleri Üniversitesi Gülhane Tıp Fakültesi, Gülhane Eğitim ve Araştırma Hastanesi (ANKARA)");
    expect(branch).toBe("KARDİYOLOJİ"); expect(qt).toBe("YABANCI");
    expect([quota, placed, vacant]).toEqual([1, 1, 0]); expect(min).toBeCloseTo(60.83174); expect(max).toBeCloseTo(60.83174);
    expect(rows[2].slice(7)).toEqual([null, null]); // "--" → null
    expect(rows[4][1]).toBe("Ankara Bilkent Şehir Hastanesi, Ankara Yıldırım Beyazıt Üniversitesi Tıp Fakültesi (ANKARA)");
    expect(rows[4][2]).toBe("GÖZ HASTALIKLARI");
  });
  it("dar düzen varyantları: 'Yabancı Uyruk' (2022/1–2023/1) ve yıldızlı yerleşen '5*' (2024/2+)", () => {
    const { rows, skipped } = parseMinMaxLines([
      "111000101 SAĞLIK BİLİMLERİ ÜNİVERSİTESİ/GÜLHANE TIP FAKÜLTESİ, GÜLHANE EĞİTİM VE ARAŞTIRMA HASTANESİ (ANKARA)/ACİL TIP Yabancı Uyruk 1 0 1 -- --",
      "109200164 Süleyman Demirel Üniversitesi Tıp Fakültesi/DERİ VE ZÜHREVİ HASTALIKLARI Genel 4 5* 0 72,06605 74,81359",
      "707600101 Adli Tıp Kurumu/Adli Tıp Genel 30 30 0 54,30845 61,80048",
    ]);
    expect(skipped).toEqual([]); expect(rows.length).toBe(3);
    expect(rows[0][3]).toBe("YABANCI"); expect(rows[0][1]).toBe("SAĞLIK BİLİMLERİ ÜNİVERSİTESİ/GÜLHANE TIP FAKÜLTESİ, GÜLHANE EĞİTİM VE ARAŞTIRMA HASTANESİ (ANKARA)");
    expect(rows[1].slice(4, 7)).toEqual([4, 5, 0]);
    expect(rows[2][2]).toBe("ADLİ TIP"); // başlık hâli → kanonik büyük harf
  });
  it("geniş düzen (2021): tek satırda Genel + Yabancı blokları; '--' blok atlanır, sarmış ad birleşir", () => {
    const { rows, skipped } = parseMinMaxLines([
      "200190075 ACIBADEM MEHMET ALİ AYDINLAR ÜNİVERSİTESİ/Tıp Fakültesi/ACİL TIP 2 2 2 0 50,94431 55,88799 -- -- -- -- --",
      "200190076 ACIBADEM MEHMET ALİ AYDINLAR ÜNİVERSİTESİ/Tıp Fakültesi/ACİL TIP 2 -- -- -- -- -- 2 2 0 50,16232 62,79404",
      "200190078 ACIBADEM MEHMET ALİ AYDINLAR ÜNİVERSİTESİ/Tıp Fakültesi/ÇOCUK SAĞLIĞI VE",
      "HASTALIKLARI 2 3 3 0 56,45188 57,62117 1 1 0 60,00000 60,00000",
    ]);
    expect(skipped).toEqual([]);
    expect(rows.map((r) => [r[0], r[3], r[4], r[5], r[6]])).toEqual([
      ["200190075", "GENEL", 2, 2, 0], ["200190076", "YABANCI", 2, 2, 0], ["200190078", "GENEL", 3, 3, 0], ["200190078", "YABANCI", 1, 1, 0],
    ]);
    expect(rows[2][2]).toBe("ÇOCUK SAĞLIĞI VE HASTALIKLARI"); expect(rows[2][1]).toBe("ACIBADEM MEHMET ALİ AYDINLAR ÜNİVERSİTESİ/Tıp Fakültesi");
  });
  it("kuyruğu oturmayan program satırı sessizce veri OLMAZ — skipped'e düşer", () => {
    const { rows, skipped } = parseMinMaxLines(["123456789 Bir Kurum/BRANŞ Genel 3 3", "999999999 Başka/X Genel 1 1 0 50,00000 55,00000"]);
    expect(rows.length).toBe(1); expect(skipped.length).toBe(1);
  });
});

describe("normalizasyon yardımcıları", () => {
  it("splitProgramName son '/'tan ayırır (kurum adında '/' olabilir)", () => {
    expect(splitProgramName("A/B Hastanesi/ÇOCUK SAĞLIĞI VE HASTALIKLARI")).toEqual({ institution: "A/B Hastanesi", branch: "ÇOCUK SAĞLIĞI VE HASTALIKLARI" });
  });
  it("classifyInstitution: SBÜ EAH üniversiteden ÖNCE; şehir hastanesi; ATK; diğer", () => {
    expect(classifyInstitution("Sağlık Bilimleri Üniversitesi Ankara Eğitim ve Araştırma Hastanesi")).toBe("SBU_EAH");
    expect(classifyInstitution("Ankara Bilkent Şehir Hastanesi, Ankara Yıldırım Beyazıt Üniversitesi Tıp Fakültesi (ANKARA)")).toBe("SEHIR_HASTANESI");
    expect(classifyInstitution("Atatürk Üniversitesi Tıp Fakültesi")).toBe("UNIVERSITE");
    expect(classifyInstitution("Adli Tıp Kurumu")).toBe("ADLI_TIP");
    expect(classifyInstitution("Sağlık Bakanlığı Bir Kurum")).toBe("DIGER");
  });
  it("titleCaseTr Türkçe I/İ kuralına uyar", () => {
    expect(titleCaseTr("İÇ HASTALIKLARI")).toBe("İç Hastalıkları");
    expect(titleCaseTr("ÇOCUK SAĞLIĞI VE HASTALIKLARI")).toBe("Çocuk Sağlığı ve Hastalıkları");
    expect(titleCaseTr("KADIN HASTALIKLARI VE DOĞUM")).toBe("Kadın Hastalıkları ve Doğum");
  });
  it("parseScore virgüllü ondalık ve '--'", () => {
    expect(parseScore("60,83174")).toBeCloseTo(60.83174); expect(parseScore("--")).toBeNull();
  });
});

describe("summarizePeriod", () => {
  it("GENEL/YABANCI toplamları, kurum türü ve branş özetleri, medyan ve histogram", () => {
    const { rows } = parseMinMaxLines(LINES);
    const s = summarizePeriod(2025, 2, rows);
    expect(s.rows).toBe(5);
    expect(s.totals.foreign).toEqual({ quota: 1, placed: 1, vacant: 0 });
    expect(s.totals.general).toEqual({ quota: 25, placed: 20, vacant: 5 });
    const ich = s.byBranch.find((b) => b.branch === "İÇ HASTALIKLARI")!;
    expect(ich.branchLabel).toBe("İç Hastalıkları"); expect(ich.minScore).toBeCloseTo(48.07522); expect(ich.vacant).toBe(4);
    const aile = s.byBranch.find((b) => b.branch === "AİLE HEKİMLİĞİ")!;
    expect(aile.minScore).toBeNull(); // yerleşen 0 → puan yok
    expect(s.byType.find((t) => t.type === "ADLI_TIP")?.quota).toBe(15);
    expect(s.minScoreHistogram.map(([b]) => b)).toEqual([45, 55, 65]);
  });
});
