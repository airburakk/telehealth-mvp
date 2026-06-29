import type { TrackerState } from "@/components/ProcessTracker";

// Talk to Doctor (genel triyaj) süreç takibi — vaka durumu + rezervasyon + post-op varlığına göre
// faz + güncel alt-durum eşlemesi. 4 faz: Vaka · Görüşme · Tedavi & Paket · Takip.
// ProcessTracker'a beslenir; metinler TR kanonik (useT/getTranslations ile çevrilir). so-tracker.ts deseni.
export interface TalkTrackerPhase {
  key: "case" | "consult" | "treatment" | "followup";
  label: string;
  state: TrackerState;
  sub: string;
}

const PHASES = [
  { key: "case", label: "Vaka oluşturuldu", done: "Vakanız oluşturuldu", pending: "Vaka bekleniyor" },
  { key: "consult", label: "Doktor görüşmesi", done: "Görüşme tamamlandı", pending: "Doktor görüşmesi bekleniyor" },
  { key: "treatment", label: "Tedavi & paket", done: "Paketiniz onaylandı", pending: "Tedavi planı bekleniyor" },
  { key: "followup", label: "Post-op takip", done: "Takip tamamlandı", pending: "Post-op takip bekleniyor" },
] as const;

// Aktif fazın alt-durum metinleri (TR kanonik)
const SUB = {
  followup: "İyileşme takibiniz sürüyor",
  bookingConfirmed: "Paketiniz onaylandı — seyahat planlanıyor",
  bookingDraft: "Paket teklifiniz hazır — onayınızı bekliyor",
  planPrep: "Tedavi planınız hazırlanıyor",
  inConsult: "Video görüşmeniz sürüyor",
  inReview: "Uzman doktor vakanızı inceliyor",
  queued: "Uzman doktor kuyruğuna eklendiniz",
} as const;

export interface TalkCaseState {
  status: string; // NEW | IN_REVIEW | IN_CONSULT | DONE
  bookingStatus: string | null; // ulaşılan en ileri booking durumu: CONFIRMED | DRAFT | ...
  hasRecovery: boolean; // post-op takip başladı mı
}

// Aktif faz = ulaşılan EN İLERİ kilometre taşı (post-op > paket > görüşme bitti > görüşme).
// Faz < aktif → done, = aktif → active (SUB metni), > aktif → pending.
export function talkTrackerPhases(s: TalkCaseState): TalkTrackerPhase[] {
  let phase: number;
  let sub: string;
  if (s.hasRecovery) {
    phase = 3;
    sub = SUB.followup;
  } else if (s.bookingStatus === "CONFIRMED") {
    phase = 2;
    sub = SUB.bookingConfirmed;
  } else if (s.bookingStatus === "DRAFT") {
    phase = 2;
    sub = SUB.bookingDraft;
  } else if (s.status === "DONE") {
    phase = 2;
    sub = SUB.planPrep;
  } else if (s.status === "IN_CONSULT") {
    phase = 1;
    sub = SUB.inConsult;
  } else if (s.status === "IN_REVIEW") {
    phase = 1;
    sub = SUB.inReview;
  } else {
    phase = 1;
    sub = SUB.queued;
  }
  return PHASES.map((p, i) => {
    const state: TrackerState = i < phase ? "done" : i === phase ? "active" : "pending";
    const subText = state === "active" ? sub : state === "done" ? p.done : p.pending;
    return { key: p.key, label: p.label, state, sub: subText };
  });
}

// i18n: getTranslations/useT'ye eklenecek tüm TR kanonik metinler.
export const TALK_TRACKER_TEXTS: string[] = [
  ...PHASES.flatMap((p) => [p.label, p.done, p.pending]),
  ...Object.values(SUB),
];
