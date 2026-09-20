// Erişim Kaydım sunum sözlüğü (kontrol raporu 2026-09-17 H12, v6.283) — saf modül (client + test).
//
// Eskiden liste ham olayları (LOGIN vb.) klinik erişimlerle aynı tabloda gösteriyordu ve "kim, ne zaman, neden" özeti
// yoktu. Artık: (1) üstte sade özet (son 30 gün: toplam · doktor · siz), (2) klinik erişimler ana listede, (3) teknik
// olaylar (giriş, onam zinciri, teknik denetim) "Teknik olaylar" açılır bölümünde. Zincir/doğrulama sütunu korunur.
import { ACTION_TR } from "@/lib/audit-labels";
import type { AccessLogEntry } from "@/lib/audit";

/** Ana listede kalan (hastanın verisine dokunan) olaylar — audit-labels sözlüğü + klinik yaşam döngüsü olayları. */
export const CLINICAL_ACTION_TR: Record<string, string> = {
  ...ACTION_TR,
  CONSULT_START: "Görüşme başlatıldı",
  RECOVERY_COMPLETE: "Takip tamamlandı — personel erişimi kapandı",
  RECOVERY_REOPEN: "Takip yeniden açıldı",
  POSTOP_ACCESS_DENIED: "Kapalı takibe erişim denemesi reddedildi",
  DELETION_ACCESS_DENIED: "Silme kilidindeki kayda erişim reddedildi",
  ACCOUNT_DELETE: "Hesap silindi",
  RECORD_PURGE: "Klinik kayıt saklama süresi sonunda imha edildi",
};

/** Teknik olaylar için okunur etiket; bilinmeyen olay ham adıyla kalır (yeni olay eklenince burada patlamaz). */
export const TECH_ACTION_TR: Record<string, string> = {
  LOGIN: "Hesaba giriş",
  IMPERSONATE_START: "Yönetici bürünme başladı",
  IMPERSONATE_END: "Yönetici bürünme bitti",
  DEFENSE_REQUEST: "Etik kurul bilgi talebi",
  DEFENSE_REPLY: "Etik kurul yanıtı",
};

export function actionLabel(action: string): string {
  return CLINICAL_ACTION_TR[action] ?? TECH_ACTION_TR[action] ?? action;
}
export function isClinicalAction(action: string): boolean {
  return action in CLINICAL_ACTION_TR;
}

export function splitAccessLog<T extends { action: string }>(entries: readonly T[]): { clinical: T[]; technical: T[] } {
  const clinical: T[] = [];
  const technical: T[] = [];
  for (const e of entries) (isClinicalAction(e.action) ? clinical : technical).push(e);
  return { clinical, technical };
}

export type AccessSummary = { days: number; total: number; doctor: number; you: number; other: number };

/** Son N günün klinik erişim özeti — "kim" kırılımı: doktor · siz · diğer (koordinatör/sistem…). */
export function summarizeAccessLog(entries: readonly Pick<AccessLogEntry, "action" | "actorRole" | "actorIsYou" | "createdAt">[], now: number, days: number = 30): AccessSummary {
  const since = now - days * 86_400_000;
  const s: AccessSummary = { days, total: 0, doctor: 0, you: 0, other: 0 };
  for (const e of entries) {
    if (!isClinicalAction(e.action) || Date.parse(e.createdAt) < since) continue;
    s.total += 1;
    if (e.actorIsYou) s.you += 1;
    else if (e.actorRole === "DOCTOR") s.doctor += 1;
    else s.other += 1;
  }
  return s;
}

/** useT metin listesi — sözlük değerleri (sabit). */
export const ACCESS_LOG_LABEL_TEXTS: readonly string[] = [...Object.values(CLINICAL_ACTION_TR), ...Object.values(TECH_ACTION_TR)];
