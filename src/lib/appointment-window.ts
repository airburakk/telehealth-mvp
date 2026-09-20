// Randevu penceresi sözlüğü (kontrol raporu 2026-09-17 H03, v6.283) — İkinci Görüş video randevusu.
//
// Eskiden geçmiş bir randevu da "kurulmuş" görünüyor ve "katıl" düğmesi sunuluyordu. Artık randevunun ÜÇ evresi var:
//   upcoming → saatten 15 dk öncesine kadar (düğme kapalı) · open → −15 dk … +60 dk (katılın) · past → pencere geçti.
// Saat her zaman Türkiye saatiyle (TSİ) gösterilir; tarayıcı dilimi farklıysa yerel saat ayrıca yazılır (yurtdışı hasta).
// Saf modül (tarayıcı/sunucu); "şimdi" değeri dışarıdan gelir (render'da Date.now() yok — lib/use-now).
export const APPT_OPEN_BEFORE_MIN = 15;
export const APPT_OPEN_AFTER_MIN = 60;
export const TR_TZ = "Europe/Istanbul";

export type ApptPhase = "upcoming" | "open" | "past";

export function appointmentPhase(scheduledAt: string | Date, now: number): ApptPhase {
  const t = typeof scheduledAt === "string" ? Date.parse(scheduledAt) : scheduledAt.getTime();
  if (now < t - APPT_OPEN_BEFORE_MIN * 60_000) return "upcoming";
  if (now > t + APPT_OPEN_AFTER_MIN * 60_000) return "past";
  return "open";
}

/** TR kanonik evre cümleleri — useT çevirir. */
export const APPT_PHASE_TEXT: Record<ApptPhase, string> = {
  upcoming: "Randevu kuruldu · katılım düğmesi görüşme saatinden 15 dk önce açılır.",
  open: "Görüşme penceresi açık — katılın.",
  past: "Randevu saati geçti — doktorunuz görüşmeyi tamamlanmış işaretleyecek ya da yeni zaman önerecek.",
};
export const APPT_LOCAL_TIME_LABEL = "yerel saatiniz";
export const APPT_TZ_SUFFIX = "(TSİ)";

/** "20 Eylül 2026 14:30 (TSİ)" — dilim sabit Türkiye; locale yalnız ay adı/biçim içindir. */
export function formatApptTr(iso: string | Date, locale: string = "tr-TR"): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  try {
    return `${new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short", timeZone: TR_TZ }).format(d)} ${APPT_TZ_SUFFIX}`;
  } catch {
    return `${new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeStyle: "short", timeZone: TR_TZ }).format(d)} ${APPT_TZ_SUFFIX}`;
  }
}

/** Tarayıcı dilimi Türkiye değilse yerel saat parçası; aynıysa/bilinmiyorsa null. */
export function localTimePart(iso: string | Date, tz: string | null | undefined, locale: string = "tr-TR"): { time: string; tz: string } | null {
  if (!tz || tz === TR_TZ) return null;
  const d = typeof iso === "string" ? new Date(iso) : iso;
  try {
    return { time: new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: tz }).format(d), tz };
  } catch {
    return null;
  }
}
