// Üye Analitiği "Tüm üyeler" listesinin e-Devlet + deneme kolonları (👤 istek 2026-10-06) — SAF modül.
//
// Üç soru, üç kolon:
//   1. e-Devlet mezun belgesi paylaşılıp diploma doğrulandı mı?  → diplomaVerifiedAt
//   2. Deneme süresinin bitmesine kaç gün kaldı (bittiyse imhaya kaç gün)? → trialEndsAt (+ LOCKED_PURGE_DAYS)
//   3. Üyeye hangi uyarı gitti?                                    → trialAlertsSent (trial-sweep cron'u yazar)
//
// ⚠️ trialAlertsSent "gönderildi" kümesi DEĞİLDİR: dueTrialAlerts geç kalınmış eşikleri sessizce işaretler
// (2 gün kala ilk koşumda yalnız "3" gider, "7" de işaretlenir). Bu yüzden listeyi saymak yanıltır; dürüst
// gösterim kümedeki EN İLERİ anahtardır — o her zaman gerçekten gönderilmiştir (eşik öncesinde en acil eşik,
// bitişte "ended", sonra "purge-notice"). Gönderim = portal bildirimi + (doğrulanmış adrese) e-posta.
//
// Katman önceliği doctorium-tiers ile aynıdır (optOut > diploma > öğrenci > deneme); `now` dışarıdan gelir.

import {
  doctoriumAudience,
  LOCKED_PURGE_DAYS,
  parseTrialAlerts,
  purgeNoticeSentAt,
  trialDaysLeft,
  type TierStamps,
} from "./doctorium-tiers";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Satır tonu — sayfa bunu tema token'ına çevirir (warning/danger); "muted" = bilgi yok/ilgisiz. */
export type MemberTone = "ok" | "muted" | "warning" | "danger";

export interface MemberCell {
  text: string;
  /** Küçük ikinci satır (tarih vb.); yoksa null. */
  sub: string | null;
  tone: MemberTone;
}

export interface MemberTrialRow {
  diploma: MemberCell;
  trial: MemberCell;
  alert: MemberCell;
  /** Sayfa üstündeki uyarı kutusuna girer mi: denemesi ≤7 gün kalan ya da süresi dolmuş (silinmeyi bekleyen). */
  needsAttention: "ending" | "locked" | null;
}

export type MemberTrialInput = TierStamps & { trialAlertsSent: string | null };

const ALERT_ORDER = ["7", "3", "1", "ended", "purge-notice"] as const;
const ALERT_LABEL: Record<(typeof ALERT_ORDER)[number], string> = {
  "7": "7 gün kala uyarısı",
  "3": "3 gün kala uyarısı",
  "1": "1 gün kala uyarısı",
  ended: "Süre doldu bildirimi",
  "purge-notice": "Silinme bildirimi",
};

const dateTr = (d: Date) =>
  new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Istanbul" }).format(d);

export function memberTrialRow(p: MemberTrialInput, now: Date): MemberTrialRow {
  const audience = doctoriumAudience(p, now);

  const diploma: MemberCell = p.diplomaVerifiedAt
    ? { text: "Onaylı", sub: dateTr(p.diplomaVerifiedAt), tone: "ok" }
    : { text: "Paylaşılmadı", sub: null, tone: "muted" };

  // Deneme kolonu yalnız deneme yolundan gelen hesapta anlamlıdır; doğrulanınca süre ortadan kalkar.
  let trial: MemberCell = { text: "—", sub: null, tone: "muted" };
  let needsAttention: MemberTrialRow["needsAttention"] = null;
  const ends = p.trialEndsAt;
  if (ends) {
    if (audience === "NONE") {
      trial = { text: "Üyelik kapatıldı", sub: null, tone: "muted" };
    } else if (audience === "VERIFIED" || audience === "STUDENT") {
      trial = { text: "Gerek kalmadı", sub: audience === "VERIFIED" ? "diploma doğrulandı" : "öğrenci doğrulandı", tone: "muted" };
    } else if (audience === "TRIAL") {
      const left = trialDaysLeft(ends, now);
      trial = { text: `${left} gün kaldı`, sub: `bitiş ${dateTr(ends)}`, tone: left <= 1 ? "danger" : left <= 7 ? "warning" : "ok" };
      if (left <= 7) needsAttention = "ending";
    } else {
      // LOCKED: portal kapalı; bitimden LOCKED_PURGE_DAYS sonra (bildirim şartıyla) silinir.
      const purgeAt = new Date(ends.getTime() + LOCKED_PURGE_DAYS * DAY_MS);
      const toPurge = Math.max(0, Math.ceil((purgeAt.getTime() - now.getTime()) / DAY_MS));
      trial = {
        text: "Süre doldu",
        sub: toPurge > 0 ? `silinmesine ${toPurge} gün · ${dateTr(purgeAt)}` : "silinme bildirim şartını bekliyor",
        tone: "danger",
      };
      needsAttention = "locked";
    }
  }

  const sent = parseTrialAlerts(p.trialAlertsSent);
  const last = [...ALERT_ORDER].reverse().find((k) => sent.has(k));
  let alert: MemberCell;
  if (!last) {
    alert = { text: ends ? "Henüz gönderilmedi" : "—", sub: null, tone: "muted" };
  } else {
    const noticeAt = last === "purge-notice" ? purgeNoticeSentAt(sent) : null;
    alert = {
      text: ALERT_LABEL[last],
      sub: noticeAt ? `gönderildi ${dateTr(noticeAt)}` : null,
      tone: last === "ended" || last === "purge-notice" ? "danger" : "warning",
    };
  }

  return { diploma, trial, alert, needsAttention };
}
