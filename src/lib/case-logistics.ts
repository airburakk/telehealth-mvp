// Lojistik DTO (K06 1C-b, 2026-09-21) — personel metni A09 madde 10.2 (Koordinatör: süreç, lojistik ve rezervasyon; hasta kimlik
// ve iletişim bilgisi yalnız süreç yönetimi amacıyla; klinik kayıt içeriğine erişim YOK) ve 10.4 (Yönetici: klinik kayıt içeriğine
// doğrudan erişim YOK). Koordinatör/yönetici bir vakayı bu DTO ile görür (doktor/vaka/[id] lojistik görünümü + GET api/cases/[id]).
//
// SAF (DB/crypto yok): kimlik alanları ÇÖZÜLMÜŞ gelir (çağıran decryptField ile çözer). Tip sınırı bilinçli:
//   İÇERİR — ad, telefon, iletişim tercihi, ülke/dil, branş, aciliyet (planlama), durum, tarih, kulvar, atanan doktor, ödeme durumu/
//            ücret/yöntem, turizm planı (hasta tercihleri JSON — tier/gece/ülke/branş), hastane adı + tedavi süresi, acente gönderim
//            damgası, bekleyen belge ETİKETLERİ (requiredDocs kataloğu — PHI değil), dosya SAYISI.
//   İÇERMEZ — şikâyet/süre, triyaj yanıtları (extra), AI gerekçesi, belge adı/içeriği (ad kimlik taşıyabilir), lab, epikriz,
//            önerilen işlemler, sağlık beyanı (ham beyan personele/acenteye gitmez — CLAUDE.md), görüşme notları, kimlik numarası.
// Yeni alan eklerken bu sınırı koru; birim testi anahtar listesini kilitler.
import { caseLaneOf, type CaseLane } from "./case-access";

export type CaseLogisticsInput = {
  id: string;
  /** ÇÖZÜLMÜŞ ad */
  patientName: string;
  /** ÇÖZÜLMÜŞ telefon */
  patientPhone: string | null;
  contactPreference: string | null;
  country: string;
  language: string;
  branch: string;
  urgency: number;
  status: string;
  createdAt: Date;
  consultFee: number | null;
  payMethod: string | null;
  payStatus: string;
  freeCare: boolean | null;
  freeCareStatus: string | null;
  tourismPlan: string | null;
  hospitalName: string | null;
  treatmentDaysMin: number | null;
  treatmentDaysMax: number | null;
  agencySentAt: Date | null;
  /** requiredDocs etiketlerinin JSON dizisi (PHI değil) */
  pendingDocs: string | null;
  /** CSV dosya adları — yalnız SAYI türetilir */
  attachments: string | null;
  doctor: { id: string; title: string; name: string; branch: string } | null;
};

export type CaseLogisticsDto = {
  logistics: true;
  id: string;
  patientName: string;
  patientPhone: string | null;
  contactPreference: string | null;
  country: string;
  language: string;
  branch: string;
  urgency: number;
  status: string;
  createdAt: string;
  lane: CaseLane;
  consultFee: number | null;
  payMethod: string | null;
  payStatus: string;
  freeCare: boolean;
  freeCareStatus: string | null;
  tourismPlan: string | null;
  hospitalName: string | null;
  treatmentDaysMin: number | null;
  treatmentDaysMax: number | null;
  agencySentAt: string | null;
  pendingDocs: string[];
  fileCount: number;
  doctor: { id: string; title: string; name: string; branch: string } | null;
};

export function caseLogisticsDto(c: CaseLogisticsInput): CaseLogisticsDto {
  let pendingDocs: string[] = [];
  try {
    const p = c.pendingDocs ? JSON.parse(c.pendingDocs) : [];
    if (Array.isArray(p)) pendingDocs = p.filter((x): x is string => typeof x === "string");
  } catch {
    pendingDocs = [];
  }
  return {
    logistics: true,
    id: c.id,
    patientName: c.patientName,
    patientPhone: c.patientPhone,
    contactPreference: c.contactPreference,
    country: c.country,
    language: c.language,
    branch: c.branch,
    urgency: c.urgency,
    status: c.status,
    createdAt: c.createdAt.toISOString(),
    lane: caseLaneOf({ tourismPlan: c.tourismPlan, freeCare: c.freeCare }),
    consultFee: c.consultFee,
    payMethod: c.payMethod,
    payStatus: c.payStatus,
    freeCare: !!c.freeCare,
    freeCareStatus: c.freeCareStatus,
    tourismPlan: c.tourismPlan,
    hospitalName: c.hospitalName,
    treatmentDaysMin: c.treatmentDaysMin,
    treatmentDaysMax: c.treatmentDaysMax,
    agencySentAt: c.agencySentAt ? c.agencySentAt.toISOString() : null,
    pendingDocs,
    fileCount: c.attachments ? c.attachments.split(",").filter(Boolean).length : 0,
    doctor: c.doctor ? { id: c.doctor.id, title: c.doctor.title, name: c.doctor.name, branch: c.doctor.branch } : null,
  };
}
