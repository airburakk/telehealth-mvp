// Doctorium üyelik KATMANLARI — SAF modül (db/env/React YOK; client bileşenleri de import edebilir).
//
// Üç katman (kullanıcı kararı 2026-09-05; plan: .claude/plans/frolicking-knitting-globe.md):
//   VERIFIED — e-Devlet doğrulamalı diploma (diplomaVerifiedAt): her şey açık.
//   STUDENT  — üniversite e-postası doğrulamalı tıp öğrencisi (studentVerifiedAt): içerik açık,
//              pazarlama yüzeyleri (sponsorlu içerik · anket · puan/ödül) KAPALI, öğrenci yüzeyleri açık.
//   TRIAL    — 30 günlük deneme (trialEndsAt gelecekte): içerik açık, pazarlama yüzeyleri KAPALI,
//              Header'da geri sayım rozeti. Süre YALNIZ doğrulama içindir; ücretli üyeliğe DÖNÜŞMEZ.
//   LOCKED   — deneme bitti, doğrulama yok: portal KAPALI (kilit ekranı → e-Devlet mezun belgesi).
//   NONE     — üyelik yok ya da üyelikten çıkılmış (doctoriumOptOutAt).
//
// Öncelik: optOut > diploma > öğrenci > deneme. Diploma doğrulanınca deneme damgaları SİLİNMEZ ama
// baskın katman VERIFIED olur (damgalar tarihsel iz). ⚠️ Eski `isStudentOnly` (studentVerifiedAt ∧
// ¬activatedAt) pazarlama süzgeci olarak ARTIK KULLANILMAZ — tek sözcü `audienceFlags`. Bilinçli kenar:
// diploması doğrulanmış ama klinik aktivasyonu (activatedAt) olmayan eski öğrenci VERIFIED sayılır;
// 2. katmanın tanımı "e-Devlet doğrulamasını yapmış doktora tüm içerik açık"tır.
//
// Sabitler TEK yerde: TRIAL_DAYS · LOCKED_PURGE_DAYS · hatırlatma eşikleri. Tarih hesabı burada, saf ve
// `now` parametreli — bileşen render'ında `new Date()` YOK (React Compiler purity; sunucu çözücü
// lib/doctorium-audience.ts `now`u üretir, bileşenlere hazır sayı/metin iner).

export type DoctoriumAudience = "VERIFIED" | "STUDENT" | "TRIAL" | "LOCKED" | "NONE";

export interface TierStamps {
  diplomaVerifiedAt: Date | null;
  studentVerifiedAt: Date | null;
  doctoriumOptOutAt: Date | null;
  /** Deneme bitişi — A2 migration'ı (v6.234) sonrası ZORUNLU alan: unutulan `select` derlemede patlar,
   *  kapı sessizce yanlış karar vermez (deletionLockedAt/CaseRef deseni). null = deneme yolu değil. */
  trialEndsAt: Date | null;
}

/** Katman çözücü — saf. `now` dışarıdan gelir (test edilebilirlik + render saflığı). */
export function doctoriumAudience(d: TierStamps, now: Date): DoctoriumAudience {
  if (d.doctoriumOptOutAt) return "NONE";
  if (d.diplomaVerifiedAt) return "VERIFIED";
  if (d.studentVerifiedAt) return "STUDENT";
  const ends = d.trialEndsAt;
  if (ends) return ends.getTime() > now.getTime() ? "TRIAL" : "LOCKED";
  return "NONE";
}

/** Portala (içerik) girebilir mi. LOCKED/NONE kapalı. */
export function hasPortalAccess(a: DoctoriumAudience): boolean {
  return a === "VERIFIED" || a === "STUDENT" || a === "TRIAL";
}

export interface AudienceFlags {
  /** Sponsorlu kart · tıklama sayacı · kişiselleştirme rızası (UI + API). */
  canSeeSponsored: boolean;
  /** Anket kartı (COMMUNITY dahil) + POST /api/survey/respond. */
  canSeeSurveys: boolean;
  /** Puan hakedişi — tek kazanma yolu anket yanıtı (awardSurveyPoints aynı işlemde). */
  canEarnPoints: boolean;
  /** /oduller kataloğu + POST /api/rewards/redeem (PATCH iptal/iade HERKESE açık kalır — hak). */
  canRedeem: boolean;
  /** TUS · Kariyer EDU sekmeleri, öğrenci paleti, logo eki. */
  showsStudentSurfaces: boolean;
  /** Header'da deneme geri sayım rozeti. */
  showsTrialBadge: boolean;
}

/** Katman → yüzey bayrakları. Pazarlama yüzeyleri YALNIZ VERIFIED'a açık: tıp öğrencisi ve
 *  doğrulanmamış deneme üyesi sağlık meslek mensubu sayılamaz → meslek-mensubuna-tanıtım rejimi
 *  onlara uygulanamaz (kullanıcı kararları 2026-08-14 ve 2026-09-05). */
export function audienceFlags(a: DoctoriumAudience): AudienceFlags {
  const verified = a === "VERIFIED";
  return {
    canSeeSponsored: verified,
    canSeeSurveys: verified,
    canEarnPoints: verified,
    canRedeem: verified,
    showsStudentSurfaces: a === "STUDENT",
    showsTrialBadge: a === "TRIAL",
  };
}

/** Kullanıcı-yüzü katman etiketi (Hesabım "Üyelik" alanı, admin üye listesi). */
export function audienceLabel(a: DoctoriumAudience): string {
  switch (a) {
    case "VERIFIED": return "Doğrulanmış doktor";
    case "STUDENT": return "Tıp öğrencisi";
    case "TRIAL": return "Deneme üyeliği";
    case "LOCKED": return "Deneme süresi doldu";
    default: return "Üyelik yok";
  }
}

// ── Deneme penceresi sabitleri ────────────────────────────────────────────────────────────────
const DAY_MS = 24 * 60 * 60 * 1000;

/** Deneme süresi (gün). Kullanıcı kararı 2026-09-05: 30. */
export const TRIAL_DAYS = 30;
/** Süresi dolan ve doğrulanmayan hesap, bitimden bu kadar gün sonra silinir (👤 2026-09-05: 90 —
 *  reddedilen belge için verilen 90 gün emsaliyle uyumlu; 01 Aydınlatma madde 8'e satır gerekir). */
export const LOCKED_PURGE_DAYS = 90;
/** İmha bildirimi, imhadan bu kadar gün ÖNCE gider (aydınlatma "30 gün önce bildirim" deseni). */
export const TRIAL_PURGE_NOTICE_DAYS = 30;
/** Bitişe kalan gün eşikleri — hatırlatma (büyükten küçüğe). */
export const TRIAL_ALERT_THRESHOLDS = [7, 3, 1] as const;
export type TrialAlertKey = "7" | "3" | "1" | "ended" | "purge-notice";

/** Deneme ünvanı: doğrulanmamış deneme doktoru için dürüst varsayılan (uzmanlık iddiası YOK). */
export const TRIAL_TITLE = "Dr.";
/** Öğrenci yüzeyi logo eki — TEK sabit; mockup sonrası kullanıcı değiştirebilir (EDU/STU). */
export const DOCTORIUM_STUDENT_SUFFIX = "EDU";

export function trialWindow(now: Date): { trialStartedAt: Date; trialEndsAt: Date } {
  return { trialStartedAt: now, trialEndsAt: new Date(now.getTime() + TRIAL_DAYS * DAY_MS) };
}

/** Kalan gün — yukarı yuvarlanır (bitişe 1 ms kala hâlâ "1 gün"), bitince 0. */
export function trialDaysLeft(endsAt: Date, now: Date): number {
  return Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / DAY_MS));
}

/** Gönderilen uyarılar JSON string[] olarak Doctor.trialAlertsSent'te (CongressFollow.sentAlerts deseni). */
export function parseTrialAlerts(raw: string | null | undefined): Set<string> {
  if (!raw) return new Set();
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? new Set(v.filter((x): x is string => typeof x === "string")) : new Set();
  } catch {
    return new Set();
  }
}
export function serializeTrialAlerts(sent: ReadonlySet<string>): string {
  return JSON.stringify([...sent].sort());
}

/**
 * Bugün hangi uyarılar gönderilmeli. Saf; cron her gün çağırır, kaçırılan gün telafi edilir:
 *  · Bitiş öncesi: kalan güne göre EN YAKIN eşik gönderilir (ör. 2 gün kala hiç uyarı gitmemişse
 *    yalnız "3" gider, "7" da gönderilmiş sayılır — bayat "7 gün kaldı" mesajı atılmaz).
 *  · Bitiş sonrası: "ended" bir kez; imhadan TRIAL_PURGE_NOTICE_DAYS önce "purge-notice" bir kez.
 * `markSent` gönderilenler + sessizce geçilen eşikler; çağıran hepsini `trialAlertsSent`e yazar.
 */
export function dueTrialAlerts(p: { endsAt: Date; sent: ReadonlySet<string>; now: Date }): {
  send: TrialAlertKey[];
  markSent: TrialAlertKey[];
} {
  const send: TrialAlertKey[] = [];
  const markSent: TrialAlertKey[] = [];
  const msLeft = p.endsAt.getTime() - p.now.getTime();

  if (msLeft <= 0) {
    for (const t of TRIAL_ALERT_THRESHOLDS) {
      const k = String(t) as TrialAlertKey;
      if (!p.sent.has(k)) markSent.push(k); // bitmiş denemeye "N gün kaldı" gitmez
    }
    if (!p.sent.has("ended")) { send.push("ended"); markSent.push("ended"); }
    const noticeAt = p.endsAt.getTime() + (LOCKED_PURGE_DAYS - TRIAL_PURGE_NOTICE_DAYS) * DAY_MS;
    if (p.now.getTime() >= noticeAt && !p.sent.has("purge-notice")) {
      send.push("purge-notice"); markSent.push("purge-notice");
    }
    return { send, markSent };
  }

  const daysLeft = trialDaysLeft(p.endsAt, p.now);
  const due = TRIAL_ALERT_THRESHOLDS.filter((t) => daysLeft <= t);
  if (due.length === 0) return { send, markSent };
  const mostUrgent = String(Math.min(...due)) as TrialAlertKey;
  for (const t of due) {
    const k = String(t) as TrialAlertKey;
    if (!p.sent.has(k)) markSent.push(k);
  }
  if (!p.sent.has(mostUrgent)) send.push(mostUrgent);
  return { send, markSent };
}

/** İmha bildiriminin GÖNDERİLDİĞİ GÜN işareti — "purge-notice@YYYY-MM-DD" (sweep, bildirimi gönderdiği turda
 *  "purge-notice" anahtarının yanına bunu da yazar). İmha, bildirimden en az TRIAL_PURGE_NOTICE_DAYS sonra. */
export const PURGE_NOTICE_DATE_PREFIX = "purge-notice@";
export function purgeNoticeMarker(now: Date): string {
  return PURGE_NOTICE_DATE_PREFIX + now.toISOString().slice(0, 10);
}
export function purgeNoticeSentAt(sent: ReadonlySet<string>): Date | null {
  for (const k of sent) {
    if (!k.startsWith(PURGE_NOTICE_DATE_PREFIX)) continue;
    const d = new Date(`${k.slice(PURGE_NOTICE_DATE_PREFIX.length)}T00:00:00.000Z`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

/** İmha kararı — FAIL-CLOSED: (1) bitimden LOCKED_PURGE_DAYS geçmiş, (2) imha bildirimi GÖNDERİLMİŞ ve (3) bildirim
 *  günü biliniyorsa üzerinden en az TRIAL_PURGE_NOTICE_DAYS geçmiş olmalı (cron uzun süre koşmadıysa bildirim geç
 *  gider; kişiye yine 30 gün tanınır). Bildirimsiz ASLA silinmez — bir sonraki koşumda bildirim gider, imha sonraya kalır. */
export function shouldPurgeLockedTrial(p: { endsAt: Date; sent: ReadonlySet<string>; now: Date }): boolean {
  const purgeAt = p.endsAt.getTime() + LOCKED_PURGE_DAYS * DAY_MS;
  if (p.now.getTime() < purgeAt) return false;
  if (!p.sent.has("purge-notice")) return false;
  const noticeAt = purgeNoticeSentAt(p.sent);
  if (noticeAt && p.now.getTime() - noticeAt.getTime() < TRIAL_PURGE_NOTICE_DAYS * DAY_MS) return false;
  return true;
}

/** Bitiş tarihi etiketi — tr-TR, Türkiye saati (sunucuda hesaplanır, bileşene metin iner). */
export function formatTrialEndsAt(endsAt: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul",
  }).format(endsAt);
}
