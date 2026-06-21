import type { SoStatus } from "./second-opinion";
import type { TrackerState } from "@/components/ProcessTracker";

// İkinci Görüş süreç takibi — durum → faz + güncel alt-durum eşlemesi. 4 faz: Ödeme · Belgeler ·
// Uzman Hekim · Video. ProcessTracker'a beslenir; metinler TR kanonik (useT ile çevrilir).
export interface SoTrackerPhase {
  key: "payment" | "docs" | "doctor" | "video";
  label: string;
  state: TrackerState;
  sub: string;
}

const PHASES = [
  { key: "payment", label: "Ödeme", done: "Ödeme alındı", pending: "Ödeme bekleniyor" },
  { key: "docs", label: "Belgeler", done: "Belge süreci tamamlandı", pending: "Belgeler bekleniyor" },
  { key: "doctor", label: "Uzman hekim", done: "Yazılı görüşünüz sunuldu", pending: "Uzman hekim aşaması bekleniyor" },
  { key: "video", label: "Video görüşme", done: "Görüşme tamamlandı", pending: "Video görüşme bekleniyor" },
] as const;

// Aktif faz + o fazın alt-durumu (durum bazlı). Faz < aktif → done, = aktif → active, > aktif → pending.
const MAP: Partial<Record<SoStatus, { phase: number; sub: string }>> = {
  DRAFT: { phase: 0, sub: "Belgelerinizi yükleyip ödemeyi tamamlayın" },
  AWAITING_PAYMENT: { phase: 0, sub: "Ödemeniz bekleniyor" },
  AWAITING_DOCUMENTS: { phase: 1, sub: "Eksik belge yüklemeniz bekleniyor" },
  PENDING_REVIEW: { phase: 2, sub: "Dosyanız sisteme aktarıldı" },
  OFFERED: { phase: 2, sub: "Dosyanız uzman hekime iletildi — onay bekleniyor" },
  ASSIGNED: { phase: 2, sub: "Dosyanız branş doktoruna atandı — inceleniyor" },
  AWAITING_ADDITIONAL_TESTS: { phase: 2, sub: "Hekim ek tetkik talep etti" },
  OPINION_DELIVERED: { phase: 3, sub: "Video görüşme randevunuz bekleniyor" },
  VIDEO_SCHEDULED: { phase: 3, sub: "Video görüşme randevunuz kuruldu" },
  VIDEO_COMPLETED: { phase: 3, sub: "Görüşmeniz tamamlandı" },
  CLOSED: { phase: 3, sub: "Süreç tamamlandı" },
  CANCELLED: { phase: 0, sub: "Başvuru iptal edildi" },
};

export function soTrackerPhases(status: SoStatus): SoTrackerPhase[] {
  const m = MAP[status] ?? { phase: 0, sub: PHASES[0].pending };
  const allDone = status === "CLOSED" || status === "VIDEO_COMPLETED";
  return PHASES.map((p, i) => {
    const state: TrackerState = allDone || i < m.phase ? "done" : i === m.phase ? "active" : "pending";
    const sub = state === "active" ? m.sub : state === "done" ? p.done : p.pending;
    return { key: p.key, label: p.label, state, sub };
  });
}

// i18n: useT texts dizisine eklenecek tüm TR kanonik metinler.
export const SO_TRACKER_TEXTS: string[] = [
  ...PHASES.flatMap((p) => [p.label, p.done, p.pending]),
  ...Object.values(MAP).map((m) => m.sub),
];
