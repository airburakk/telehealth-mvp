// Doktor-only branş sözleşmesi (v6.119, 2026-08-19).
//
// NEDEN VAR: kullanıcının 30 branşlık kongre rehberi sistemde OLMAYAN 5 dal taşıyordu
// (acil-tip · radyoloji · anesteziyoloji · patoloji · tibbi-genetik). Bunları tanımsız slug
// olarak yazmak SESSİZ kayıp demekti — `upcomingCongresses` branş süzgeci ve `parseBranchPrefs`
// bilinmeyen slug'ı atar: kayıt DB'de durur, hiçbir doktora görünmez, hata da vermez.
// Çözüm `doctorOnly` bayrağı oldu; bu dosya o bayrağın İKİ YÖNÜNÜ birden kilitler:
//   (a) doktor-only branş HASTA yüzeyine SIZMAZ (yanlış klinik yönlendirme),
//   (b) doktor-only branş doktor yüzeyinde SESSİZCE BOŞ KALMAZ (renk/ikon/haber/dergi eşleniği).
//
// (b) özellikle önemli: eşlenik haritalar geri düşüşlü (fallback) olduğu için eksiklik derleme
// hatası vermez — modül yalnızca boş görünür. Bu testler o boşluğu görünür kılar.
import { describe, it, expect } from "vitest";
import { BRANCHES, PATIENT_BRANCHES, analyzeTriage } from "@/lib/triage";
import { BRANCH_COLORS, DEFAULT_BRANCH_COLOR } from "@/lib/branch-visuals";
import { BRANCH_ICONS } from "@/components/branch-icons";
import { NEWS_QUERIES } from "@/lib/medical-news";
import { BRANCH_JOURNALS } from "@/lib/academic-journals";
import { BRANCH_OPTIONS, parseBranchPrefs } from "@/lib/doctorium";

const DOCTOR_ONLY = BRANCHES.filter((b) => b.doctorOnly);

describe("doctorOnly branşlar — küme bütünlüğü", () => {
  it("beklenen 5 dal doctorOnly işaretli", () => {
    expect(DOCTOR_ONLY.map((b) => b.key).sort()).toEqual(
      ["acil-tip", "anesteziyoloji", "patoloji", "radyoloji", "tibbi-genetik"],
    );
  });

  it("PATIENT_BRANCHES = BRANCHES eksi doctorOnly (kayıp/fazla branş yok)", () => {
    expect(PATIENT_BRANCHES).toHaveLength(BRANCHES.length - DOCTOR_ONLY.length);
    expect(PATIENT_BRANCHES.some((b) => b.doctorOnly)).toBe(false);
  });

  it("doctorOnly branşların keywords'ü BOŞ — kural motoru oraya düşemez", () => {
    for (const b of DOCTOR_ONLY) expect(b.keywords, b.key).toEqual([]);
  });
});

describe("(a) hasta yüzeyine sızmama", () => {
  it("semptom metni doctorOnly branşa yönlenmez — 'acil' geçse bile", () => {
    for (const text of ["acil durum nefes darlığı", "radyoloji raporu istiyorum", "patoloji sonucum", "anestezi öncesi kontrol", "genetik test istiyorum"]) {
      const out = analyzeTriage({ symptoms: text });
      expect(DOCTOR_ONLY.map((b) => b.key), text).not.toContain(out.branchKey);
    }
  });

  it("forceBranchKey ile doctorOnly slug POST edilse bile sabitlenmez (fail-safe)", () => {
    for (const b of DOCTOR_ONLY) {
      const out = analyzeTriage({ symptoms: "genel kontrol", forceBranchKey: b.key });
      expect(out.branchKey, b.key).not.toBe(b.key);
    }
  });

  it("geçerli bir hasta branşı zorlanınca hâlâ sabitlenir (daraltma fazla kesmedi)", () => {
    expect(analyzeTriage({ symptoms: "genel kontrol", forceBranchKey: "kardiyoloji" }).branchKey).toBe("kardiyoloji");
  });
});

describe("(b) doktor yüzeyinde sessizce boş kalmama", () => {
  it("Doctorium branş seçicisi TAM kümeyi sunar (doktor radyoloji seçebilmeli)", () => {
    expect(BRANCH_OPTIONS).toHaveLength(BRANCHES.length);
    for (const b of DOCTOR_ONLY) expect(BRANCH_OPTIONS.map((o) => o.slug), b.key).toContain(b.key);
  });

  it("parseBranchPrefs doctorOnly slug'ı ATMAZ (kongre süzgeci çalışsın)", () => {
    const slugs = DOCTOR_ONLY.map((b) => b.key);
    expect(parseBranchPrefs(JSON.stringify(slugs))).toEqual(slugs);
  });

  it("her branşın rengi var ve nötr geri düşüşe düşmüyor", () => {
    for (const b of BRANCHES) {
      expect(BRANCH_COLORS[b.key], b.key).toBeTruthy();
      expect(BRANCH_COLORS[b.key], b.key).not.toBe(DEFAULT_BRANCH_COLOR);
    }
  });

  it("her branşın ikonu var ve ikonlar benzersiz", () => {
    for (const b of BRANCHES) expect(BRANCH_ICONS[b.key], b.key).toBeTruthy();
    const icons = BRANCHES.map((b) => BRANCH_ICONS[b.key]);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it("her branşın PubMed sorgusu var (Akışım/Akademik boş kalmasın)", () => {
    for (const b of BRANCHES) {
      expect(NEWS_QUERIES[b.label], b.label).toBeTruthy();
      expect(NEWS_QUERIES[b.label], b.label).toMatch(/\[(mh|tiab|sh)\]/);
    }
  });

  it("her branşın dergi listesi var", () => {
    for (const b of BRANCHES) expect(BRANCH_JOURNALS[b.key]?.length, b.key).toBeGreaterThan(0);
  });
});
