// İkinci Görüş (Second Opinion) modülü — durum makinesi + SLA/ücret sabitleri.
// TEK KAYNAK: ücret, süreler ve hasta-yüzü süre metni buradan beslenir (spec §11/§12.3).
// Boundary spec §4 (state machine). İADE POLİTİKASI PARK (§9.1) → ödeme sonrası iptal
// bilinçli olarak modellenmedi; iptal yalnız ödeme öncesi (DRAFT / AWAITING_PAYMENT).
import { secondOpinionDocSpecs, type SoDocType } from "@/data/second-opinion-docs";
import { BRANCHES } from "@/lib/triage";

// SO vakası branşı BRANCHES.key ("onkoloji") saklar; Doctor.branch etiket ("Onkoloji") tutar.
// Doktor-vaka branş karşılaştırması/sorgusu iki biçimi de kapsamalı — tekil karşılaştırma
// sessizce hiç eşleşmiyordu (oto-atama null, havuz boş, accept 403; 2026-07-12 Faz 3'te yakalandı).
export function soBranchVariants(branch: string): string[] {
  const b = BRANCHES.find((x) => x.key === branch || x.label === branch);
  return b ? [...new Set([b.key, b.label])] : [branch];
}

export const SO_STATUSES = [
  "DRAFT",
  "AWAITING_PAYMENT",
  "PENDING_REVIEW",
  "OFFERED",
  "AWAITING_DOCUMENTS",
  "READY_FOR_ASSIGNMENT",
  "ASSIGNED",
  "AWAITING_ADDITIONAL_TESTS",
  "OPINION_DELIVERED",
  "VIDEO_OFFERED",
  "VIDEO_SCHEDULED",
  "VIDEO_COMPLETED",
  "CLOSED",
  "CANCELLED",
] as const;
export type SoStatus = (typeof SO_STATUSES)[number];

// İzin verilen geçişler (§4 tablosu). Tek yönlü ilerler; talep döngüleri (AWAITING_*)
// tamlık/uygunluk sağlanana kadar tekrar edebilir. Ödeme sonrası iptal YOK (iade parked §9.1).
export const SO_TRANSITIONS: Record<SoStatus, SoStatus[]> = {
  DRAFT: ["AWAITING_PAYMENT", "CANCELLED"],
  AWAITING_PAYMENT: ["PENDING_REVIEW", "CANCELLED"],
  PENDING_REVIEW: ["OFFERED", "AWAITING_DOCUMENTS", "READY_FOR_ASSIGNMENT"],
  OFFERED: ["ASSIGNED", "PENDING_REVIEW"],
  AWAITING_DOCUMENTS: ["PENDING_REVIEW"],
  READY_FOR_ASSIGNMENT: ["ASSIGNED"],
  ASSIGNED: ["AWAITING_ADDITIONAL_TESTS", "OPINION_DELIVERED"],
  AWAITING_ADDITIONAL_TESTS: ["ASSIGNED"],
  // Faz 4 (İcapçı deseni): raporu yazan hoca randevu TEKLİF eder → hasta onaylar (VIDEO_SCHEDULED)
  // veya değişiklik ister (OPINION_DELIVERED'a döner; hoca yeni zaman önerir). Koordinatör YOK.
  OPINION_DELIVERED: ["VIDEO_OFFERED"],
  VIDEO_OFFERED: ["VIDEO_SCHEDULED", "OPINION_DELIVERED"],
  VIDEO_SCHEDULED: ["VIDEO_COMPLETED"],
  VIDEO_COMPLETED: ["CLOSED"],
  CLOSED: [],
  CANCELLED: [],
};

export function canTransition(from: SoStatus, to: SoStatus): boolean {
  return (SO_TRANSITIONS[from] ?? []).includes(to);
}

export const SO_STATUS_LABELS: Record<SoStatus, string> = {
  DRAFT: "Taslak — belge hazırlanıyor",
  AWAITING_PAYMENT: "Ödeme bekleniyor",
  PENDING_REVIEW: "Dosyanız incelenmeye alındı",
  OFFERED: "Uzman doktora iletildi — kabul bekleniyor",
  AWAITING_DOCUMENTS: "Eksik belge bekleniyor",
  READY_FOR_ASSIGNMENT: "Doktor ataması bekleniyor",
  ASSIGNED: "Doktor incelemesinde",
  AWAITING_ADDITIONAL_TESTS: "Ek tetkik bekleniyor",
  OPINION_DELIVERED: "Yazılı görüş sunuldu",
  VIDEO_OFFERED: "Video randevu teklif edildi",
  VIDEO_SCHEDULED: "Video randevusu kuruldu",
  VIDEO_COMPLETED: "Görüşme tamamlandı",
  CLOSED: "Kapandı",
  CANCELLED: "İptal edildi",
};

// ── Ücret & SLA (§11) — TEK KAYNAK ──
export const SO_FEE_USD = 600;
export const SO_CURRENCY = "USD";
export const SO_REPORT_SLA_BUSINESS_DAYS = { min: 5, max: 7 };
export const SO_VIDEO_WINDOW_DAYS = 15;

// Hoca dosya kabul penceresi (oto-atama → OFFERED). Süre içinde kabul edilmezse dosya diğer
// branş hocalarına AÇILIR (ilk kabul eden alır — lazy fan-out, accept route). ⚠️ Süre TBD — kullanıcı kararı (placeholder).
export const SO_ACCEPT_WINDOW_HOURS = 24;
export function isOfferExpired(offeredAt: Date | null | undefined): boolean {
  if (!offeredAt) return false;
  return Date.now() - new Date(offeredAt).getTime() > SO_ACCEPT_WINDOW_HOURS * 3_600_000;
}

// §12.2 hasta-yüzü süre metni — SO ön-değerlendirme sayfası + özetler buradan beslenir (§12.3).
export const SO_DURATION_COPY = {
  tr: {
    reportLabel: "Yazılı raporun hazırlanma süresi",
    reportValue: `${SO_REPORT_SLA_BUSINESS_DAYS.min}-${SO_REPORT_SLA_BUSINESS_DAYS.max} iş günü`,
    video: `Uzman doktorla birebir video görüşme ise yazılı raporun tesliminden itibaren ${SO_VIDEO_WINDOW_DAYS} gün içerisinde. Size görüşme günü ve saati için bildirim yapılacaktır.`,
  },
  en: {
    reportLabel: "Written report preparation time",
    reportValue: `${SO_REPORT_SLA_BUSINESS_DAYS.min}-${SO_REPORT_SLA_BUSINESS_DAYS.max} business days`,
    video: `The one-on-one video consultation with the specialist takes place within ${SO_VIDEO_WINDOW_DAYS} days of the written report delivery. You will be notified of the date and time.`,
  },
} as const;

/** İş günü ekleyerek tarih hesapla (hafta sonu atlanır). */
export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d;
}

/** Yazılı rapor teslim hedef aralığı — readyAt (READY_FOR_ASSIGNMENT) başlangıçlı (§11, §7.7). */
export function reportDueRange(readyAt: Date): { min: Date; max: Date } {
  return {
    min: addBusinessDays(readyAt, SO_REPORT_SLA_BUSINESS_DAYS.min),
    max: addBusinessDays(readyAt, SO_REPORT_SLA_BUSINESS_DAYS.max),
  };
}

