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
import { parseViewPrefs, type DoctoriumViewPrefs } from "@/lib/doctorium";

// Bayrak env'i TEK yerden okunur (lib/doctorium-trial-flag — db/auth ağacına dokunmayan saf modül,
// doctor-signup gibi oturumsuz kütüphaneler oradan import eder); buradan yeniden dışa açılır.
export { isTrialEnabled } from "@/lib/doctorium-trial-flag";

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

// Katman select'i — TierStamps ile birebir (trialEndsAt A2 migration'ıyla geldi, alan ZORUNLU).
const TIER_SELECT = {
  diplomaVerifiedAt: true,
  studentVerifiedAt: true,
  doctoriumOptOutAt: true,
  trialEndsAt: true,
} as const;

function trialContextFor(audience: DoctoriumAudience, endsAt: Date | null, now: Date): TrialContext | null {
  if (audience !== "TRIAL" || !endsAt) return null;
  return { endsAt, daysLeft: trialDaysLeft(endsAt, now), endsAtLabel: formatTrialEndsAt(endsAt) };
}

/** Oturum doktorunun GÖRÜNÜM tercihleri (Doctor.doctoriumViewPrefs; Faz B1: raf "TUS sekmesini göster" anahtarı
 *  buradan okunur). Doktor profili yoksa (personel) varsayılanlar. İstek-önbellekli — Shell her sayfada çağırır. */
export const currentDoctorViewPrefs = cache(async (): Promise<DoctoriumViewPrefs> => {
  const ctx = await currentDoctoriumAudience();
  if (!ctx?.doctorId) return parseViewPrefs(null);
  const d = await db.doctor.findUnique({ where: { id: ctx.doctorId }, select: { doctoriumViewPrefs: true } });
  return parseViewPrefs(d?.doctoriumViewPrefs ?? null);
});

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
  return {
    role: "DOCTOR",
    doctorId: me?.doctorId ?? null,
    audience,
    flags: audienceFlags(audience),
    trial: trialContextFor(audience, d.trialEndsAt, now),
  };
});
