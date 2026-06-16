// Belirli demo vakalara bağlı DICOM çalışmaları — doktor kokpitinde (vaka detayı) "Görüntüle" ile açılır.
// Gerçek dosya depolama (S3) gelene kadar: çalışmalar public/dicom/ altında statik; vakaya kod ile eşlenir.
// Not: caseId'ler paylaşılan Neon seed'ine göre sabittir; veritabanı yeniden seed edilirse bu eşleme güncellenmeli.
export interface DicomStudy { url: string; label: string; modality: string }

const TORAKS: DicomStudy = { url: "/dicom/toraks-bt.dcm", label: "Toraks BT", modality: "CT" };
const DIZ: DicomStudy = { url: "/dicom/diz-mr.dcm", label: "Diz MR", modality: "MR" };

const BY_CASE: Record<string, DicomStudy[]> = {
  cmqfjlc380000l204t7yd7k5q: [TORAKS], // karim · Kardiyoloji
  cmpzr0k81000vuae4xi6ixjrm: [TORAKS], // Karim B. · Onkoloji (akciğer)
  cmpzr0kfo0013uae46u686s7o: [TORAKS], // Dmitry K. · Kardiyoloji
  cmpzr0ke50011uae4qa2xelrx: [DIZ], // Ahmed M. · Ortopedi
  cmq8c3nux0000l404lyhno2lt: [DIZ], // Kaan · Ortopedi
};

export function caseDicomStudies(caseId: string): DicomStudy[] {
  return BY_CASE[caseId] ?? [];
}
