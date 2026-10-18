// Yönetim panosu (/admin/pano) üye hesapları — SAF modül (db/env/React YOK; `now` dışarıdan gelir).
// 👤 2026-10-17: "en üstte Doctorium üye analitiği, yeni üyeler ve onaylanma durumları, altta sosyal medya hesapları".
//
// Üye TANIMI /admin/uyeler ile AYNIDIR (o sayfanın başındaki üç tasarım notunu oku): üye = User satırı OLAN Doctor
// profili; öğrenci `studentTrack` ile ayrılır. Sorgu ve join sayfada yapılır, buraya hazır `DashboardMember[]` iner.
//
// ⚠️ Doğrulama ölçüleri İÇ İÇE AŞAMA DEĞİL, BAĞIMSIZ EKSENLERDİR (uyeler/page.tsx aynı uyarıyı taşır): her eksen kendi
// tabanına oranlanır ve "huni" diye çizilmez — admin onayı diploma damgasından ayrı işler, alttaki sayı büyük çıkabilir.
//
// Gün kovaları Türkiye takvim günüdür (lib/iso-day todayIsoTr) — UTC'de 21:00'den sonraki kayıt ertesi güne düşmesin.

import { doctoriumAudience, trialDaysLeft, LOCKED_PURGE_DAYS, type DoctoriumAudience, type TierStamps } from "./doctorium-tiers";
import { todayIsoTr } from "./iso-day";

const HOUR = 3600_000;
const DAY = 24 * HOUR;

export interface DashboardMember {
  userId: string;
  name: string | null;
  createdAt: Date;
  p: TierStamps & {
    studentTrack: boolean;
    verified: boolean;
    activatedAt: Date | null;
    branch: string | null;
    city: string | null;
    studentUniversity: string | null;
  };
}

/** Bileşim dilimi — kitle çözücünün sonucu; NONE ikiye ayrılır (üyelikten çıkan ≠ hiç doğrulanmamış). */
export type CompositionKey = "VERIFIED" | "STUDENT" | "TRIAL" | "LOCKED" | "UNVERIFIED" | "OPTED_OUT";

export const COMPOSITION_LABEL: Record<CompositionKey, string> = {
  VERIFIED: "Doğrulanmış doktor",
  STUDENT: "Tıp öğrencisi",
  TRIAL: "Deneme",
  LOCKED: "Deneme doldu",
  UNVERIFIED: "Doğrulama yok",
  OPTED_OUT: "Üyelikten çıktı",
};

export function compositionKey(m: DashboardMember, now: Date): CompositionKey {
  const a: DoctoriumAudience = doctoriumAudience(m.p, now);
  if (a !== "NONE") return a;
  return m.p.doctoriumOptOutAt ? "OPTED_OUT" : "UNVERIFIED";
}

export interface WindowStat {
  label: string;
  total: number;
  doctors: number;
  students: number;
  /** Bir önceki eşit uzunluktaki pencere (ör. 7 gün için 14–7 gün önce). */
  previous: number;
}

export interface DailyBucket {
  /** Türkiye takvim günü, "2026-10-17". */
  day: string;
  doctors: number;
  students: number;
}

export interface Axis {
  label: string;
  value: number;
  base: number;
  note: string;
}

export type WaitingKind = "trial" | "locked" | "student-email";

export interface WaitingRow {
  userId: string;
  name: string;
  detail: string;
  kind: WaitingKind;
  /** Sıralama/ton anahtarı: denemede kalan gün, öğrencide bekleme günü (negatif = gecikmiş), kilitte imhaya kalan gün. */
  days: number;
}

export interface RecentRow {
  userId: string;
  name: string;
  student: boolean;
  where: string;
  composition: CompositionKey;
  createdAt: Date;
}

export interface DashboardSummary {
  total: number;
  doctors: number;
  students: number;
  composition: { key: CompositionKey; value: number }[];
  windows: WindowStat[];
  daily: DailyBucket[];
  axes: Axis[];
  waiting: { rows: WaitingRow[]; trial: number; locked: number; studentEmail: number };
  recent: RecentRow[];
}

const COMPOSITION_ORDER: CompositionKey[] = ["VERIFIED", "STUDENT", "TRIAL", "LOCKED", "UNVERIFIED", "OPTED_OUT"];

/** Görünen ad — boşsa e-postaya düşmeyiz (pano kimlik değil durum gösterir); "Adsız üye". */
const displayName = (n: string | null) => (n && n.trim()) || "Adsız üye";

export function summarizeMembers(members: readonly DashboardMember[], now: Date, opts: { days?: number; waitingLimit?: number; recentLimit?: number } = {}): DashboardSummary {
  const days = opts.days ?? 30;
  const t = now.getTime();
  const doctors = members.filter((m) => !m.p.studentTrack);
  const students = members.filter((m) => m.p.studentTrack);

  // ── Bileşim (sıfır dilimler düşer; sıra sabittir — renk varlığı izler, sırayı değil) ──
  const counts = new Map<CompositionKey, number>();
  for (const m of members) {
    const k = compositionKey(m, now);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const composition = COMPOSITION_ORDER.flatMap((key) => (counts.get(key) ? [{ key, value: counts.get(key)! }] : []));

  // ── Zaman pencereleri: [now-span, now] ve bir önceki [now-2span, now-span) ──
  const inRange = (m: DashboardMember, from: number, to: number) => {
    const c = m.createdAt.getTime();
    return c >= from && c < to;
  };
  const windows = ([["Son 24 saat", DAY], ["Son 7 gün", 7 * DAY], ["Son 30 gün", 30 * DAY]] as const).map(([label, span]) => {
    const from = t - span;
    const cur = members.filter((m) => inRange(m, from, t + 1));
    return {
      label,
      total: cur.length,
      doctors: cur.filter((m) => !m.p.studentTrack).length,
      students: cur.filter((m) => m.p.studentTrack).length,
      previous: members.filter((m) => inRange(m, from - span, from)).length,
    };
  });

  // ── Günlük kovalar (eskiden yeniye). TR UTC+3 sabit (yaz saati yok, 2016) → gün adımı 24 saat güvenli. ──
  const keys = Array.from({ length: days }, (_, i) => todayIsoTr(new Date(t - (days - 1 - i) * DAY)));
  const byDay = new Map(keys.map((k) => [k, { day: k, doctors: 0, students: 0 }]));
  for (const m of members) {
    const b = byDay.get(todayIsoTr(m.createdAt));
    if (!b) continue;
    if (m.p.studentTrack) b.students++;
    else b.doctors++;
  }
  const daily = keys.map((k) => byDay.get(k)!);

  // ── Bağımsız doğrulama eksenleri ──
  const axes: Axis[] = [
    { label: "Diploması doğrulanmış", value: doctors.filter((m) => m.p.diplomaVerifiedAt).length, base: doctors.length, note: "e-Devlet mezun belgesi · tam erişim" },
    { label: "Klinik olarak aktif", value: doctors.filter((m) => m.p.activatedAt).length, base: doctors.length, note: "Aşama 2 belgeleri tamam" },
    { label: "Admin onaylı", value: doctors.filter((m) => m.p.verified).length, base: doctors.length, note: "hasta havuzuna çıkabilir" },
    { label: "Öğrenci e-postası doğrulanmış", value: students.filter((m) => m.p.studentVerifiedAt).length, base: students.length, note: "üniversite adresi" },
  ];

  // ── Doğrulama bekleyenler: deneme (kalan gün) · e-postasını doğrulamamış öğrenci · süresi dolmuş deneme ──
  const rows: WaitingRow[] = [];
  for (const m of members) {
    const k = compositionKey(m, now);
    if (k === "TRIAL" && m.p.trialEndsAt) {
      const left = trialDaysLeft(m.p.trialEndsAt, now);
      rows.push({ userId: m.userId, name: displayName(m.name), kind: "trial", days: left, detail: `Deneme · ${left} gün kaldı` });
    } else if (k === "LOCKED" && m.p.trialEndsAt) {
      const purgeIn = Math.max(0, LOCKED_PURGE_DAYS - Math.floor((t - m.p.trialEndsAt.getTime()) / DAY));
      rows.push({ userId: m.userId, name: displayName(m.name), kind: "locked", days: purgeIn, detail: `Deneme doldu · imhaya ${purgeIn} gün` });
    } else if (k === "UNVERIFIED" && m.p.studentTrack) {
      const waited = Math.floor((t - m.createdAt.getTime()) / DAY);
      rows.push({ userId: m.userId, name: displayName(m.name), kind: "student-email", days: -waited, detail: `Öğrenci e-postası · ${waited} gündür bekliyor` });
    }
  }
  // En acil önde: az günü kalan deneme, imhası yaklaşan kilit, en uzun bekleyen öğrenci — ortak eksen `days` küçükten büyüğe.
  rows.sort((a, b) => a.days - b.days || a.name.localeCompare(b.name, "tr"));
  const waiting = {
    rows: rows.slice(0, opts.waitingLimit ?? 4),
    trial: rows.filter((r) => r.kind === "trial").length,
    locked: rows.filter((r) => r.kind === "locked").length,
    studentEmail: rows.filter((r) => r.kind === "student-email").length,
  };

  const recent = [...members]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, opts.recentLimit ?? 7)
    .map((m) => ({
      userId: m.userId,
      name: displayName(m.name),
      student: m.p.studentTrack,
      where: [m.p.studentTrack ? m.p.studentUniversity : m.p.branch, m.p.city].map((s) => s?.trim()).filter(Boolean).join(" · "),
      composition: compositionKey(m, now),
      createdAt: m.createdAt,
    }));

  return { total: members.length, doctors: doctors.length, students: students.length, composition, windows, daily, axes, waiting, recent };
}

/** Değişim yüzdesi — önceki 0 ise null (sonsuz/yanıltıcı yüzde gösterilmez). */
export function changePct(cur: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((cur - prev) / prev) * 100);
}

/** "3 dk" · "5 sa" · "2 gün" — katılım zamanı için kısa göreli süre. */
export function relativeShort(d: Date, now: Date): string {
  const ms = Math.max(0, now.getTime() - d.getTime());
  if (ms < HOUR) return `${Math.max(1, Math.round(ms / 60_000))} dk`;
  if (ms < DAY) return `${Math.round(ms / HOUR)} sa`;
  return `${Math.floor(ms / DAY)} gün`;
}
