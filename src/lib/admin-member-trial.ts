// Üye Analitiği "Tüm üyeler" listesinin e-Devlet · deneme · branş · uyarı hücreleri — SAF hesap (db/React YOK).
// v6.326 (👤 2026-10-06) + revizyon v6.329 (👤 aynı gün: "renkli uyarı yok, satır uzadığı için durum belli değil,
// kaç gün kaldığı belli değil, branşı sınıflandırılmamış olanlar belli değil").
//
// Dört soru:
//   1. e-Devlet mezun belgesi paylaşılıp diploma doğrulandı mı?  → diplomaVerifiedAt
//   2. Deneme süresinin bitmesine kaç gün kaldı (bittiyse imhaya kaç gün)? → trialEndsAt (+ LOCKED_PURGE_DAYS)
//   3. Branş sınıflandırılmış mı?                                  → branch (lib/procedures branchKeyFromLabel)
//   4. Üyeye hangi uyarı gitti, sıradaki ne zaman gidecek?         → trialAlertsSent (trial-sweep cron'u yazar)
//
// ⚠️ trialAlertsSent "gönderildi" kümesi DEĞİLDİR: dueTrialAlerts geç kalınmış eşikleri sessizce işaretler
// (2 gün kala ilk koşumda yalnız "3" gider, "7" de işaretlenir). Dürüst gösterim kümedeki EN İLERİ anahtardır —
// o her zaman gerçekten gönderilmiştir. Gönderim = portal bildirimi + (doğrulanmış adrese) e-posta.
//
// ⚠️ Branş uyarısı yalnız PANODA bir işarettir: "Diğer (Sınıflandırılmamış)" kayıt formlarında seçilebilen geçerli bir
// seçenektir ve 2026-10-06 itibarıyla bu üyelere OTOMATİK bir uyarı GÖNDERİLMEZ (canlıda ölçüldü: "branş" içeren
// bildirim 0). Metin bunu açıkça söyler; gönderim mekanizması kurulursa bu not ve hücre metni birlikte güncellenir.
//
// Katman önceliği doctorium-tiers ile aynıdır (optOut > diploma > öğrenci > deneme); `now` dışarıdan gelir.

import {
  doctoriumAudience,
  LOCKED_PURGE_DAYS,
  parseTrialAlerts,
  purgeNoticeSentAt,
  TRIAL_ALERT_THRESHOLDS,
  TRIAL_PURGE_NOTICE_DAYS,
  trialDaysLeft,
  type TierStamps,
} from "./doctorium-tiers";
import { branchKeyFromLabel } from "./procedures";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Hücre tonu — sayfa tema token'ına çevirir. "info" = süre işliyor (marka aksanı), "muted" = bilgi yok/ilgisiz. */
export type MemberTone = "ok" | "info" | "muted" | "warning" | "danger";

export interface MemberCell {
  text: string;
  /** Küçük ikinci satır (tarih vb.); yoksa null. */
  sub: string | null;
  tone: MemberTone;
}

export type AttentionReason = "trial" | "ending" | "locked" | "branch";

export interface MemberTrialRow {
  diploma: MemberCell;
  trial: MemberCell;
  /** null = branş sınıflandırılmış (sorun yok). */
  branch: MemberCell | null;
  /** Deneme uyarısı: gönderilen son uyarı ya da sıradakinin tarihi. */
  alert: MemberCell;
  /** Sayfa üstündeki "Dikkat" kutusuna hangi gerekçelerle girer (boş = girmez). */
  reasons: AttentionReason[];
  /** Deneme kalan günü (yalnız işleyen denemede) — kutuda sıralama için. */
  daysLeft: number | null;
}

export type MemberTrialInput = TierStamps & { trialAlertsSent: string | null; branch: string | null };

const ALERT_ORDER = ["7", "3", "1", "ended", "purge-notice"] as const;
const ALERT_LABEL: Record<(typeof ALERT_ORDER)[number], string> = {
  "7": "7 gün kala uyarısı gitti",
  "3": "3 gün kala uyarısı gitti",
  "1": "1 gün kala uyarısı gitti",
  ended: "Süre doldu bildirimi gitti",
  "purge-notice": "Silinme bildirimi gitti",
};

const dateTr = (d: Date) =>
  new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Istanbul" }).format(d);

/** Branş sınıflandırması: boş · listede yok · "others" (Diğer / Sınıflandırılmamış) → işaret; aksi null. */
export function branchIssue(branch: string | null): MemberCell | null {
  const raw = (branch ?? "").trim();
  if (!raw) return { text: "Branş seçilmemiş", sub: null, tone: "warning" };
  const key = branchKeyFromLabel(raw);
  if (key === "others") return { text: "Branş sınıflandırılmamış", sub: raw, tone: "warning" };
  if (!key) return { text: "Branş listede yok", sub: raw, tone: "warning" };
  return null;
}

export function memberTrialRow(p: MemberTrialInput, now: Date): MemberTrialRow {
  const audience = doctoriumAudience(p, now);
  const reasons: AttentionReason[] = [];
  let daysLeft: number | null = null;

  const diploma: MemberCell = p.diplomaVerifiedAt
    ? { text: "Onaylı", sub: dateTr(p.diplomaVerifiedAt), tone: "ok" }
    : { text: "Paylaşılmadı", sub: null, tone: "danger" };

  // Deneme hücresi yalnız deneme yolundan gelen hesapta anlamlıdır; doğrulanınca süre ortadan kalkar.
  let trial: MemberCell = { text: "Deneme yok", sub: null, tone: "muted" };
  const ends = p.trialEndsAt;
  if (ends) {
    if (audience === "NONE") {
      trial = { text: "Üyelik kapatıldı", sub: null, tone: "muted" };
    } else if (audience === "VERIFIED" || audience === "STUDENT") {
      trial = { text: "Süre durdu", sub: audience === "VERIFIED" ? "diploma doğrulandı" : "öğrenci doğrulandı", tone: "ok" };
    } else if (audience === "TRIAL") {
      daysLeft = trialDaysLeft(ends, now);
      trial = {
        text: `${daysLeft} gün kaldı`,
        sub: `bitiş ${dateTr(ends)}`,
        tone: daysLeft <= 1 ? "danger" : daysLeft <= 7 ? "warning" : "info",
      };
      reasons.push(daysLeft <= 7 ? "ending" : "trial");
    } else {
      // LOCKED: portal kapalı; bitimden LOCKED_PURGE_DAYS sonra (bildirim şartıyla) silinir.
      const purgeAt = new Date(ends.getTime() + LOCKED_PURGE_DAYS * DAY_MS);
      const toPurge = Math.max(0, Math.ceil((purgeAt.getTime() - now.getTime()) / DAY_MS));
      trial = {
        text: "Süre doldu · portal kapalı",
        sub: toPurge > 0 ? `silinmesine ${toPurge} gün (${dateTr(purgeAt)})` : "silinme bildirim şartını bekliyor",
        tone: "danger",
      };
      reasons.push("locked");
    }
  }

  const branch = branchIssue(p.branch);
  if (branch) reasons.push("branch");

  const alert = alertCell(p, audience, now);
  return { diploma, trial, branch, alert, reasons, daysLeft };
}

/** Son giden deneme uyarısı; yoksa sıradakinin tarihi (trial-sweep her gün 10:20 TR'de koşar). */
function alertCell(p: MemberTrialInput, audience: ReturnType<typeof doctoriumAudience>, now: Date): MemberCell {
  const ends = p.trialEndsAt;
  if (!ends || audience === "VERIFIED" || audience === "STUDENT" || audience === "NONE") {
    return { text: "—", sub: null, tone: "muted" };
  }
  const sent = parseTrialAlerts(p.trialAlertsSent);
  const last = [...ALERT_ORDER].reverse().find((k) => sent.has(k));
  const next = nextAlert(ends, sent, now);
  if (last) {
    const noticeAt = last === "purge-notice" ? purgeNoticeSentAt(sent) : null;
    return {
      text: ALERT_LABEL[last],
      sub: noticeAt ? dateTr(noticeAt) : next ? `sıradaki: ${next}` : null,
      tone: last === "ended" || last === "purge-notice" ? "danger" : "warning",
    };
  }
  return { text: "Henüz uyarı gitmedi", sub: next ? `sıradaki: ${next}` : null, tone: "muted" };
}

function nextAlert(ends: Date, sent: ReadonlySet<string>, now: Date): string | null {
  if (ends.getTime() > now.getTime()) {
    const daysLeft = trialDaysLeft(ends, now);
    // Bir sonraki eşik: henüz işaretlenmemiş ve kalan günün ALTINDA kalan en büyük eşik.
    const upcoming = TRIAL_ALERT_THRESHOLDS.filter((t) => t < daysLeft && !sent.has(String(t)));
    if (upcoming.length === 0) return sent.has("ended") ? null : `süre doldu bildirimi · ${dateTr(ends)}`;
    const t = Math.max(...upcoming);
    return `${t} gün kala uyarısı · ${dateTr(new Date(ends.getTime() - t * DAY_MS))}`;
  }
  if (!sent.has("ended")) return "süre doldu bildirimi · bugün";
  if (!sent.has("purge-notice")) {
    const at = new Date(ends.getTime() + (LOCKED_PURGE_DAYS - TRIAL_PURGE_NOTICE_DAYS) * DAY_MS);
    return `silinme bildirimi · ${dateTr(at)}`;
  }
  return null;
}
