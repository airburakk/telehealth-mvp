// Birim — lib/case-logistics (K06 1C-b, 2026-09-21): koordinatör/yönetici LOJİSTİK DTO'su (A09 madde 10.2/10.4).
// Sözleşme: kimlik+iletişim+ülke/dil+branş/aciliyet+durum+kulvar+doktor+ödeme+turizm/rezervasyon+bekleyen belge ETİKETLERİ+dosya SAYISI
// var; şikâyet/süre/triyaj yanıtı/AI gerekçesi/belge adı-içeriği/lab/epikriz/sağlık beyanı/görüşme notu/kimlik no YOK.
import { describe, it, expect } from "vitest";
import { caseLogisticsDto } from "@/lib/case-logistics";

const input = {
  id: "c1", patientName: "Ayşe Yılmaz", patientPhone: "+90 555 000 00 00", contactPreference: "phone", country: "TR", language: "tr",
  branch: "Kardiyoloji", urgency: 4, status: "NEW", createdAt: new Date("2026-09-21T10:00:00Z"), consultFee: 60, payMethod: "card",
  payStatus: "PENDING", freeCare: false, freeCareStatus: null, tourismPlan: null, hospitalName: null, treatmentDaysMin: null,
  treatmentDaysMax: null, agencySentAt: null, pendingDocs: JSON.stringify(["Patoloji raporu", "Görüntüleme"]),
  attachments: "ayse-yilmaz-ekg.pdf,rontgen.jpg", doctor: { id: "d1", title: "Prof. Dr.", name: "Mehmet Yıldız", branch: "Kardiyoloji" },
};

describe("caseLogisticsDto — lojistik görünüm", () => {
  it("klinik içerik anahtarı TAŞIMAZ; anahtar kümesi kilitli", () => {
    const dto = caseLogisticsDto(input) as Record<string, unknown>;
    for (const k of ["symptoms", "durationText", "extra", "reasoning", "documents", "attachments", "labResults", "dischargeReport", "dischargeStructured", "healthDeclaration", "recommendedProcedures", "consultations", "patientIdentifier", "userId"]) {
      expect(k in dto, k).toBe(false);
    }
    expect(dto.logistics).toBe(true);
    expect(Object.keys(dto).sort()).toEqual([
      "agencySentAt", "branch", "consultFee", "contactPreference", "country", "createdAt", "doctor", "fileCount", "freeCare", "freeCareStatus",
      "hospitalName", "id", "lane", "language", "logistics", "patientName", "patientPhone", "payMethod", "payStatus", "pendingDocs", "status",
      "tourismPlan", "treatmentDaysMax", "treatmentDaysMin", "urgency",
    ]);
  });

  it("kimlik + iletişim + doktor + ödeme aynen (10.2 süreç amacıyla)", () => {
    const dto = caseLogisticsDto(input);
    expect(dto).toMatchObject({ patientName: "Ayşe Yılmaz", patientPhone: "+90 555 000 00 00", contactPreference: "phone", payStatus: "PENDING", consultFee: 60 });
    expect(dto.doctor).toEqual({ id: "d1", title: "Prof. Dr.", name: "Mehmet Yıldız", branch: "Kardiyoloji" });
    expect(dto.createdAt).toBe("2026-09-21T10:00:00.000Z");
  });

  it("dosya adı DTO'ya girmez, yalnız sayı; bekleyen belge etiketleri dizi; bozuk JSON → boş", () => {
    const dto = caseLogisticsDto(input);
    expect(dto.fileCount).toBe(2);
    expect(JSON.stringify(dto)).not.toContain("ekg.pdf");
    expect(dto.pendingDocs).toEqual(["Patoloji raporu", "Görüntüleme"]);
    expect(caseLogisticsDto({ ...input, pendingDocs: "{bozuk", attachments: null }).pendingDocs).toEqual([]);
    expect(caseLogisticsDto({ ...input, pendingDocs: null, attachments: "" }).fileCount).toBe(0);
  });

  it("kulvar türetimi hasta tarafıyla aynı: turizm > ücretsiz > uzaktan sağlık", () => {
    expect(caseLogisticsDto(input).lane).toBe("telehealth");
    expect(caseLogisticsDto({ ...input, freeCare: true }).lane).toBe("free");
    expect(caseLogisticsDto({ ...input, freeCare: true, tourismPlan: "{\"tier\":\"standart\"}" }).lane).toBe("tourism");
    expect(caseLogisticsDto({ ...input, doctor: null }).doctor).toBeNull();
  });
});
