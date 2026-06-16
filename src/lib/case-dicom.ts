// Belirli demo vakalara bağlı DICOM çalışmaları — doktor kokpitinde (vaka detayı) "Görüntüle" ile açılır.
// Gerçek dosya depolama (S3) gelene kadar: çalışmalar public/dicom/ altında statik; vakaya kod ile eşlenir.
// Not: caseId'ler paylaşılan Neon seed'ine göre sabittir; veritabanı yeniden seed edilirse bu eşleme güncellenmeli.
export interface DicomStudy { url: string; label: string; modality: string }

const TORAKS: DicomStudy = { url: "/dicom/toraks-bt.dcm", label: "Toraks BT", modality: "CT" };
const DIZ: DicomStudy = { url: "/dicom/diz-mr.dcm", label: "Diz MR", modality: "MR" };
const SINUS: DicomStudy = { url: "/dicom/sinus-bt.dcm", label: "Paranazal Sinüs BT", modality: "CT" };
const BATIN: DicomStudy = { url: "/dicom/batin-bt.dcm", label: "Batın BT", modality: "CT" };
const PELVIK: DicomStudy = { url: "/dicom/pelvik-usg.dcm", label: "Pelvik USG", modality: "US" };

const BY_CASE: Record<string, DicomStudy[]> = {
  cmqfjlc380000l204t7yd7k5q: [TORAKS], // karim · Kardiyoloji
  cmpzr0k81000vuae4xi6ixjrm: [TORAKS, BATIN], // Karim B. · Onkoloji — toraks + batın (evreleme, çoklu çalışma)
  cmpzr0kfo0013uae46u686s7o: [TORAKS], // Dmitry K. · Kardiyoloji
  cmq7akx2f0000ky04yzz9tjgz: [TORAKS], // mustafa · Kardiyoloji
  cmq86sin60000l7044iijnxgu: [TORAKS], // arzu · Kardiyoloji
  cmpzr0ke50011uae4qa2xelrx: [DIZ], // Ahmed M. · Ortopedi
  cmq8c3nux0000l404lyhno2lt: [DIZ], // Kaan · Ortopedi
  cmqe3505c0000l104k3pgmb6v: [SINUS], // Cenk · KBB
  cmqcgjifq001gl4047f6ccg2a: [BATIN], // Ahmet · Gastroenteroloji
  cmpzr0kcm000zuae48qmyyro7: [PELVIK], // Aigerim T. · Tüp Bebek (IVF)
};

export function caseDicomStudies(caseId: string): DicomStudy[] {
  return BY_CASE[caseId] ?? [];
}
