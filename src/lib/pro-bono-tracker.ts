import type { TrackerState } from "@/components/ProcessTracker";

// Pro Bono (ücretsiz gönüllü konsültasyon) süreç takibi — Case.proBonoStatus → faz + alt-durum.
// 4 faz: Başvuru · Gönüllü doktor · Görüşme · Sonuç. ProcessTracker'a beslenir. so-tracker.ts deseni.
export interface ProBonoTrackerPhase {
  key: "apply" | "match" | "consult" | "outcome";
  label: string;
  state: TrackerState;
  sub: string;
}

const PHASES = [
  { key: "apply", label: "Başvuru", done: "Başvurunuz alındı", pending: "Başvuru bekleniyor" },
  { key: "match", label: "Gönüllü doktor", done: "Gönüllü doktorunuzle eşleştiniz", pending: "Eşleşme bekleniyor" },
  { key: "consult", label: "Görüşme", done: "Görüşmeniz tamamlandı", pending: "Görüşme bekleniyor" },
  { key: "outcome", label: "Sonuç", done: "Süreç tamamlandı", pending: "Sonuç bekleniyor" },
] as const;

// Aktif faz + o fazın alt-durumu (proBonoStatus bazlı). Faz < aktif → done, = aktif → active, > aktif → pending.
const MAP: Record<string, { phase: number; sub: string }> = {
  WAITING: { phase: 1, sub: "Gönüllü doktor aranıyor…" },
  MATCHED: { phase: 2, sub: "Görüşmeniz başlıyor" },
  IN_CONSULT: { phase: 2, sub: "Görüşmeniz sürüyor" },
  CONSULT_DONE: { phase: 3, sub: "Görüşmeniz tamamlandı" },
  TREATMENT_NEEDED: { phase: 3, sub: "Tedavi uygunluğunuz değerlendiriliyor" },
  ETHICS_REVIEW: { phase: 3, sub: "Tedavi uygunluğunuz değerlendiriliyor" },
  ETHICS_APPROVED: { phase: 3, sub: "Tedaviniz onaylandı" },
  ETHICS_REJECTED: { phase: 3, sub: "Değerlendirme tamamlandı" },
  COMPLETED: { phase: 3, sub: "Süreç tamamlandı" },
};

export function proBonoTrackerPhases(status: string): ProBonoTrackerPhase[] {
  const m = MAP[status] ?? { phase: 1, sub: PHASES[1].pending };
  const allDone = status === "COMPLETED";
  return PHASES.map((p, i) => {
    const state: TrackerState = allDone || i < m.phase ? "done" : i === m.phase ? "active" : "pending";
    const sub = state === "active" ? m.sub : state === "done" ? p.done : p.pending;
    return { key: p.key, label: p.label, state, sub };
  });
}

// i18n: bekleme sayfası bunları useT'ye besler → çok dilli (8+ dil) + RTL (v2.91).
export const PRO_BONO_TRACKER_TEXTS: string[] = [
  ...PHASES.flatMap((p) => [p.label, p.done, p.pending]),
  ...Object.values(MAP).map((m) => m.sub),
];
