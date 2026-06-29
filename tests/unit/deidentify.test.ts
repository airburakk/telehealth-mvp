// Birim testleri — lib/deidentify.ts (Partner havuzu de-identification). Saf (decryptField düz metni passthrough).
// T7 regresyon korumaları: e-posta domain sızması, DOB maskeleme, lab/ICD/tansiyon yanlış-pozitif olmaması.
import { describe, it, expect } from "vitest";
import { scrubText, deidentifyCase } from "@/lib/deidentify";

describe("scrubText — satır-içi tanımlayıcılar", () => {
  it("e-posta tamamen maskelenir, DOMAIN SIZMAZ (T7)", () => {
    const out = scrubText("İletişim: ahmet@example.com", ["ahmet"]);
    expect(out).toContain("[e-posta]");
    expect(out).not.toContain("example.com");
    expect(out).not.toContain("ahmet@");
  });

  it("TC kimlik (11 hane) maskelenir", () => {
    expect(scrubText("TC: 12345678901")).toContain("[kimlik no]");
  });

  it("tam tarih (DOB) maskelenir", () => {
    expect(scrubText("Doğum: 13.08.1990")).toContain("[tarih]");
  });

  it("tek-ayraçlı sayılar YANLIŞ-POZİTİF değildir (lab/ICD/tansiyon korunur)", () => {
    // 120/80 tansiyon, C34.1 ICD, 13.8 lab değeri — DATE_RE iki ayraç ister → tetiklenmez
    const out = scrubText("Tansiyon 120/80, ICD C34.1, Hgb 13.8");
    expect(out).toContain("120/80");
    expect(out).toContain("C34.1");
    expect(out).toContain("13.8");
  });

  it("telefon benzeri uzun rakam dizisi maskelenir", () => {
    expect(scrubText("Tel: +90 532 123 45 67")).toContain("[telefon]");
  });

  it("isim ve parçaları maskelenir", () => {
    const out = scrubText("Hasta Ahmet Yılmaz başvurdu", ["Ahmet Yılmaz"]);
    expect(out).not.toContain("Ahmet");
    expect(out).not.toContain("Yılmaz");
    expect(out).toContain("[ad]");
  });

  it("2 harften kısa isim parçası maskelemez (gürültü önleme)", () => {
    const out = scrubText("Al geldi", ["Al"]);
    expect(out).toBe("Al geldi"); // "Al" < 3 harf → korunur
  });
});

describe("deidentifyCase", () => {
  it("klinik özet kimlikten arındırılır, klinik içerik korunur", () => {
    const r = deidentifyCase({
      patientName: "Ahmet Yılmaz",
      patientIdentifier: "12345678901",
      country: "TR",
      language: "Türkçe",
      symptoms: "Ahmet 3 gündür baş ağrısı çekiyor, tel 0532 123 45 67",
      branch: "Nöroşirürji",
      urgency: 3,
      icd10Code: "G43.9",
    });
    expect(r.clinicalSummary).not.toContain("Ahmet");
    expect(r.clinicalSummary).not.toContain("0532");
    expect(r.clinicalSummary).toContain("baş ağrısı"); // klinik içerik korunur
    expect(r.branch).toBe("Nöroşirürji");
    expect(r.icd10Code).toBe("G43.9");
    expect(r.urgency).toBe(3);
  });

  it("redactedFields düşürülen alanları şeffaf raporlar", () => {
    const r = deidentifyCase({
      patientName: "Test",
      country: "DE",
      language: "Almanca",
      symptoms: "Ağrı",
      branch: "Ortopedi",
      urgency: 1,
    });
    expect(r.redactedFields).toContain("patientName");
    expect(r.redactedFields).toContain("attachments/DICOM");
    expect(r.region).toBeTruthy();
  });

  it("klinik içerik yoksa güvenli fallback döner", () => {
    const r = deidentifyCase({
      patientName: "",
      country: "TR",
      language: "Türkçe",
      symptoms: "",
      branch: "Diş",
      urgency: 1,
    });
    expect(r.clinicalSummary).toBe("(klinik özet yok)");
  });
});
