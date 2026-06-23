// Denetim kaydı etiketleri (TR) — hasta-yüzü (/erisim-kaydi) + denetçi-yüzü (/denetim) paylaşır.
// Saf sabitler (client-safe; db/crypto import etmez). Yeni AuditAction eklenince buraya da etiket ekle.

export const ACTION_TR: Record<string, string> = {
  CASE_VIEW: "Vaka görüntülendi",
  CONSULT_WRITE: "Klinik not yazıldı",
  CONSULT_END: "Görüşme kapatıldı",
  FHIR_EXPORT: "FHIR dışa aktarım",
  DOCUMENT_VIEW: "Belge görüntülendi",
  CODING_WRITE: "Klinik kodlama yazıldı",
  LABS_WRITE: "Laboratuvar sonucu yazıldı",
  DOCUMENT_ANALYZE: "Belgeler AI ile değerlendirildi",
  DISCHARGE_GENERATE: "Epikriz oluşturuldu",
};

export const RES_TR: Record<string, string> = {
  CASE: "Vaka",
  CONSULTATION: "Görüşme",
  FHIR_COMPOSITION: "Epikriz (FHIR)",
  FHIR_CONSENT: "Paylaşım izni (FHIR)",
  CASE_DOCUMENT: "Belge",
};

export const ROLE_TR: Record<string, string> = {
  DOCTOR: "Doktor",
  COORDINATOR: "Koordinatör",
  ADMIN: "Yönetici",
  PATIENT: "Hasta",
  ETHICS: "Etik Kurul",
};
