// Doctorium KİTLE BAĞLAMI — sunucu tarafı (db okur). Saf mantık lib/doctorium-tiers.ts'te.
//
// Tek sözcü (2026-09-05): eskiden `isStudentOnly` 11 yerde ad-hoc tekrarlanıyordu ve iki API
// (sponsor/click, doctor/sponsor-consent) hiç kapısızdı. Artık her yüzey/route BURADAN
// `flags` okur; yeni bir katman (deneme) eklemek yalnız doctorium-tiers.ts'i değiştirir.
//
// `cache()` (getCurrentUser deseni, lib/auth.ts): aynı istekte layout + page + Shell + route
// çağrıları TEK doktor sorgusuna iner. `new Date()` YALNIZ burada üretilir — bileşenlere hazır
// sayı/metin iner (React Compiler purity: render'da saat okunmaz).
import { cache } from "react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  audienceFlags, doctoriumAudience, formatTrialEndsAt, trialDaysLeft,
  type AudienceFlags, type DoctoriumAudience,
} from "@/lib/doctorium-tiers";

/** Deneme üyeliği bayrağı — 🔴 İKİ Vercel projesine AYRI girilir (BRAND_MODE dersi, .env.example).
 *  Yalnız ÜÇ yerde okunur: hesap oluşturmada damga · /doctorium/kayit form seçimi · POST
 *  /api/auth/signup-trial. Çözücü/kapı/rozet/cron damga-güdümlüdür (bayrak kapansa da başlamış
 *  denemeler biter ve imha edilir). */
export function isTrialEnabled(): boolean {
  return process.env.DOCTORIUM_TRIAL_ENABLED === "1";
}

export interface TrialContext {
  endsAt: Date;
  daysLeft: number;
  /** tr-TR, Türkiye saati — bileşen render'ında tarih biçimlenmez. */
  endsAtLabel: string;
}

export interface AudienceContext {
  role: string;
  doctorId: string | null;
  /** null = doktor profili olmayan gözetim rolü (COORDINATOR/ADMIN). */
  audience: DoctoriumAudience | null;
  flags: AudienceFlags;
  trial: TrialContext | null;
}

// Gözetim rolleri Doctorium ÜYESİ değildir ama portala girer: sponsor kartını bağlamsal
// (hedefsiz) görür — bugünkü davranış aynen korunur; anket/puan/ödül doktor-yalnız ürünlerdir.
const STAFF_FLAGS: AudienceFlags = {
  canSeeSponsored: true,
  canSeeSurveys: false,
  canEarnPoints: false,
  canRedeem: false,
  showsStudentSurfaces: false,
  showsTrialBadge: false,
};

// A2 migration'ı `trialEndsAt` kolonunu getirince bu select'e eklenir ve TierStamps'te alan
// ZORUNLU yapılır (doctorium-tiers.ts notu) — o gün derleyici eksik select'leri listeler.
const TIER_SELECT = {
  diplomaVerifiedAt: true,
  studentVerifiedAt: true,
  doctoriumOptOutAt: true,
} as const;

function trialContextFor(audience: DoctoriumAudience, endsAt: Date | null, now: Date): TrialContext | null {
  if (audience !== "TRIAL" || !endsAt) return null;
  return { endsAt, daysLeft: trialDaysLeft(endsAt, now), endsAtLabel: formatTrialEndsAt(endsAt) };
}

/** Oturum kullanıcısının Doctorium kitle bağlamı. null = oturum yok. */
export const currentDoctoriumAudience = cache(async (): Promise<AudienceContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== "DOCTOR") {
    return { role: user.role, doctorId: null, audience: null, flags: STAFF_FLAGS, trial: null };
  }
  const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  const d = me?.doctorId
    ? await db.doctor.findUnique({ where: { id: me.doctorId }, select: TIER_SELECT })
    : null;
  if (!d) {
    return { role: "DOCTOR", doctorId: me?.doctorId ?? null, audience: "NONE", flags: audienceFlags("NONE"), trial: null };
  }
  const now = new Date();
  const audience = doctoriumAudience(d, now);
  const trialEndsAt: Date | null = null; // A2 sonrası: d.trialEndsAt
  return {
    role: "DOCTOR",
    doctorId: me?.doctorId ?? null,
    audience,
    flags: audienceFlags(audience),
    trial: trialContextFor(audience, trialEndsAt, now),
  };
});
