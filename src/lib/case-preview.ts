// Kimliksiz havuz önizlemesi DTO'su (K06 1C-a, 2026-09-20) — personel metni A09 madde 10.1: "Uzman havuzunda atanmamış
// başvuruları yalnız kimliksiz önizlemeyle görürsünüz." Aynı branştaki atanmamış vakayı doktor KABUL etmeden önce görür.
//
// SAF (DB/crypto yok): girdiler ÇÖZÜLMÜŞ metindir (çağıran decryptField ile çözer). Kimlik alanları (ad, kimlik no,
// telefon, hasta userId), belge listesi/içeriği, triyaj yanıtları (extra), AI gerekçesi (reasoning), epikriz ve sağlık
// beyanı DTO'ya HİÇ GİRMEZ — tip düzeyinde de yoktur (yeni alan eklerken bu sınırı koru; birim testi kilitler).
// Şikâyet metninde hastanın TAM adı [HASTA] ile maskelenir (lib/ai-minimize redactName — AI/çeviri yoluyla aynı kural;
// kısmi/ilk-ad geçişleri kapsam dışıdır, sınır orada da aynıdır). Etiket SO havuzunun "Anonim hasta"sıyla aynı.
import { redactName } from "./ai-minimize";

export const PREVIEW_ANON_LABEL = "Anonim hasta";

export type CasePreviewInput = {
  id: string;
  branch: string;
  urgency: number;
  country: string;
  language: string;
  status: string;
  createdAt: Date;
  durationText: string | null;
  /** ÇÖZÜLMÜŞ şikâyet metni */
  symptoms: string;
  /** ÇÖZÜLMÜŞ hasta adı — yalnız maskeleme için; DTO'ya girmez */
  patientName: string;
  /** CSV dosya adları — yalnız SAYI türetilir, adlar DTO'ya girmez (dosya adı kimlik taşıyabilir) */
  attachments: string | null;
};

export type CasePreviewDto = {
  preview: true;
  id: string;
  branch: string;
  urgency: number;
  country: string;
  language: string;
  status: string;
  createdAt: string;
  durationText: string | null;
  /** adı maskelenmiş şikâyet */
  complaint: string;
  fileCount: number;
};

export function casePreviewDto(c: CasePreviewInput): CasePreviewDto {
  const fileCount = c.attachments ? c.attachments.split(",").filter(Boolean).length : 0;
  return {
    preview: true,
    id: c.id,
    branch: c.branch,
    urgency: c.urgency,
    country: c.country,
    language: c.language,
    status: c.status,
    createdAt: c.createdAt.toISOString(),
    durationText: c.durationText,
    complaint: redactName(c.symptoms, c.patientName),
    fileCount,
  };
}
