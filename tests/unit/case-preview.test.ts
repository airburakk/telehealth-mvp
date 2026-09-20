// Birim — lib/case-preview (K06 1C-a, 2026-09-20): havuz vakasının KİMLİKSİZ önizleme DTO'su. Sözleşme: kimlik/telefon/
// belge/triyaj yanıtı/AI gerekçesi/epikriz/sağlık beyanı DTO'da HİÇ yok · şikâyette hastanın tam adı [HASTA] · dosya
// yalnız SAYI (ad kimlik taşıyabilir) · etiket SO havuzuyla aynı "Anonim hasta".
import { describe, it, expect } from "vitest";
import { casePreviewDto, PREVIEW_ANON_LABEL } from "@/lib/case-preview";

const input = {
  id: "c1", branch: "Kardiyoloji", urgency: 4, country: "TR", language: "tr", status: "NEW",
  createdAt: new Date("2026-09-20T10:00:00Z"), durationText: "3 gün",
  symptoms: "Ayşe Yılmaz iki gündür göğüs ağrısı çekiyor. Ayşe Yılmaz nefes darlığı da bildiriyor.",
  patientName: "Ayşe Yılmaz", attachments: "ayse-yilmaz-ekg.pdf,rontgen.jpg",
};

describe("casePreviewDto — kimliksiz havuz önizlemesi", () => {
  it("kimlik ve klinik içerik alanı TAŞIMAZ (tip sınırı çalışma zamanında da kilitli)", () => {
    const dto = casePreviewDto(input) as Record<string, unknown>;
    for (const k of ["patientName", "patientIdentifier", "patientPhone", "userId", "reasoning", "extra", "documents", "attachments", "healthDeclaration", "dischargeReport", "labResults", "symptoms"]) {
      expect(k in dto, k).toBe(false);
    }
    expect(dto.preview).toBe(true);
    expect(Object.keys(dto).sort()).toEqual(["branch", "complaint", "country", "createdAt", "durationText", "fileCount", "id", "language", "preview", "status", "urgency"]);
  });

  it("şikâyette hastanın tam adı [HASTA] ile maskelenir (her geçişte)", () => {
    const dto = casePreviewDto(input);
    expect(dto.complaint).not.toContain("Ayşe Yılmaz");
    expect(dto.complaint.split("[HASTA]").length - 1).toBe(2);
    expect(dto.complaint).toContain("göğüs ağrısı");
  });

  it("dosya adları DTO'ya girmez, yalnız sayı; ek yoksa 0", () => {
    expect(casePreviewDto(input).fileCount).toBe(2);
    expect(JSON.stringify(casePreviewDto(input))).not.toContain("ekg.pdf");
    expect(casePreviewDto({ ...input, attachments: null }).fileCount).toBe(0);
    expect(casePreviewDto({ ...input, attachments: "" }).fileCount).toBe(0);
  });

  it("işletme alanları aynen; createdAt ISO; etiket SO havuzuyla aynı", () => {
    const dto = casePreviewDto(input);
    expect(dto).toMatchObject({ id: "c1", branch: "Kardiyoloji", urgency: 4, country: "TR", language: "tr", status: "NEW", durationText: "3 gün" });
    expect(dto.createdAt).toBe("2026-09-20T10:00:00.000Z");
    expect(PREVIEW_ANON_LABEL).toBe("Anonim hasta");
  });
});
