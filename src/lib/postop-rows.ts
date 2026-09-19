// Hasta Post-Op listesi satır türetimi — SAF (birim testlenebilir; DB yok).
//
// Kontrol raporu 2026-09-17 H02: liste (/takip) yalnız `Recovery.status === "COMPLETED"`e bakıyordu, detay
// (/takip/[caseId]) ise `recoveryClosed` (manuel VEYA süre dolumu) kullanıyordu → aynı kayıt listede "Aktif",
// detayda "tamamlandı" görünüyor, hasta izlenmeye devam ettiğini sanabiliyordu. Artık liste de AYNI kapanış
// kararını kullanır; kapanış nedeni ve tarihi satırda taşınır.
//
// D01 (19 Eylül eki): satır, klinik şiddetten (severity) AYRI olarak ölçüm güncelliğini de taşır — hiç kontrol
// yoksa ya da son kontrol eskiyse "Stabil" yazılmaz (postop.ts measurementState).
import { recoveryClosed, type CloseReason } from "./postop-access";
import { measurementAgeDays, measurementState, type MeasurementState } from "./postop";

export interface TakipRow {
  caseId: string;
  branch: string;
  /** Kapanış kararı — detay sayfasıyla AYNI kaynak (recoveryClosed). */
  closed: boolean;
  closeReason: CloseReason | null;
  startedAt: string; // ISO
  completedAt: string | null; // ISO — yalnız manuel kapanışta dolu; otomatik kapanış hesaplanır (null kalır)
  /** Son kontrolün klinik şiddeti (NONE/WATCH/RED) — ölçüm yoksa NONE ama `measurement` bunu ayırır. */
  severity: string;
  measurement: MeasurementState;
  lastCheckAt: string | null; // ISO
  ageDays: number | null; // son kontrolün yaşı (gün) — NO_DATA'da null
}

export type TakipSource = {
  id: string;
  branch: string;
  recovery: {
    status: string;
    startedAt: Date;
    completedAt: Date | null;
    reopenedAt: Date | null;
    branch: string;
    checkIns: { severity: string; createdAt: Date }[]; // en yeni önde, en fazla 1
  } | null;
};

export function takipRowFor(c: TakipSource, now: Date = new Date()): TakipRow {
  const r = c.recovery;
  const closed = r ? recoveryClosed(r) : { closed: false, reason: null };
  const last = r?.checkIns[0] ?? null;
  return {
    caseId: c.id,
    branch: c.branch,
    closed: closed.closed,
    closeReason: closed.reason,
    startedAt: r?.startedAt.toISOString() ?? "",
    completedAt: r?.completedAt?.toISOString() ?? null,
    severity: last?.severity ?? "NONE",
    measurement: measurementState(last?.createdAt ?? null, now),
    lastCheckAt: last ? last.createdAt.toISOString() : null,
    ageDays: last ? measurementAgeDays(last.createdAt, now) : null,
  };
}
