// Landing öğrenci hunisi — /admin/landing-analitik "Öğrenci hunisi" paneli (2026-09-19).
//
// Neden: 09 Öğrenciler bölümü (v6.262, 10 Eyl 2026) için "yerleşim sinyal üretiyor mu, düğmeye tıklanıyor mu" gözlemi
// her seferinde prod'a salt-okur betik koşmayı gerektiriyordu (scripts/probe-membership-stamps SORU 3; vault log 2026-09-12 ·
// 2026-09-19). Aynı ölçüler artık yönetim panelinde. Saf hesap: LandingEvent agregat satırları (name, placement, day, count)
// → huni; kişisel veri yok (lib/doctorium-landing/events.ts ilkesi). Örneklem küçükken oranlar yorumlanmaz — panel bunu yazar.

/** v6.262 (Öğrenciler bölümü) canlıya çıkış günü — scripts/probe-membership-stamps.ts LANDING_SINCE ile aynı. */
export const STUDENT_FUNNEL_SINCE = new Date("2026-09-10T00:00:00Z");
/** student_click atan CtaLink yerleşimleri: sections/Students (ogrenci) · FinalCta (final) · Identity (identity). */
export const STUDENT_CLICK_PLACEMENTS = ["ogrenci", "final", "identity"] as const;
/** Bu sayının altında bölüm görüntülenmesiyle oranlar yorumlanmaz (panel uyarı yazar). */
export const STUDENT_FUNNEL_MIN_SAMPLE = 30;

export interface LandingEventRow {
  name: string;
  placement: string;
  day: Date;
  count: number;
}

export interface StudentFunnelDay {
  /** YYYY-MM-DD (UTC gün kovası — LandingEvent.day @db.Date) */
  day: string;
  landingViews: number;
  sectionViews: number;
  clicks: number;
}

export interface StudentFunnel {
  since: Date;
  /** Ziyaret tabanı: landing_view */
  landingViews: number;
  /** section_view/hero — sayfanın tepesini görenler */
  heroViews: number;
  /** section_view/ogrenci — Öğrenciler bölümünü %50 görünürlükte görenler */
  sectionViews: number;
  /** student_click — tüm yerleşimler */
  clicks: number;
  clicksByPlacement: Record<string, number>;
  /** sectionViews / heroViews — hero sonrası bölüme ulaşan pay (payda 0 → null) */
  reachShare: number | null;
  /** clicks / sectionViews — bölümü görenlerden tıklayan pay (payda 0 → null) */
  clickRate: number | null;
  /** sectionViews < STUDENT_FUNNEL_MIN_SAMPLE → oranlar yorumlanmaz */
  smallSample: boolean;
  /** Hareket olan günler (ziyaret · bölüm · tıklama), artan tarih */
  days: StudentFunnelDay[];
}

const ratio = (n: number, d: number): number | null => (d > 0 ? n / d : null);
const dayKey = (d: Date): string => d.toISOString().slice(0, 10);

export function studentFunnel(rows: LandingEventRow[], since: Date = STUDENT_FUNNEL_SINCE): StudentFunnel {
  const f: StudentFunnel = {
    since, landingViews: 0, heroViews: 0, sectionViews: 0, clicks: 0, clicksByPlacement: {},
    reachShare: null, clickRate: null, smallSample: true, days: [],
  };
  const byDay = new Map<string, StudentFunnelDay>();
  const dayOf = (d: Date): StudentFunnelDay => {
    const k = dayKey(d);
    let e = byDay.get(k);
    if (!e) {
      e = { day: k, landingViews: 0, sectionViews: 0, clicks: 0 };
      byDay.set(k, e);
    }
    return e;
  };

  for (const r of rows) {
    if (r.day < since || r.count <= 0) continue;
    if (r.name === "landing_view") {
      f.landingViews += r.count;
      dayOf(r.day).landingViews += r.count;
    } else if (r.name === "section_view" && r.placement === "hero") {
      f.heroViews += r.count;
    } else if (r.name === "section_view" && r.placement === "ogrenci") {
      f.sectionViews += r.count;
      dayOf(r.day).sectionViews += r.count;
    } else if (r.name === "student_click") {
      f.clicks += r.count;
      f.clicksByPlacement[r.placement] = (f.clicksByPlacement[r.placement] ?? 0) + r.count;
      dayOf(r.day).clicks += r.count;
    }
  }

  f.reachShare = ratio(f.sectionViews, f.heroViews);
  f.clickRate = ratio(f.clicks, f.sectionViews);
  f.smallSample = f.sectionViews < STUDENT_FUNNEL_MIN_SAMPLE;
  f.days = [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : 1));
  return f;
}
