"use client";

// Profil hafızası — prefill (basitleştirme Faz 1, 2026-07-12). "Bir kez sor, her yerde kullan":
// 4 intake ekranı, hastanın önceki başvurularından dolan profili (/api/patient/profile) çeker;
// profil YETERLİYSE alanlar yerine kompakt "kayıtlı bilgiler" şeridi gösterilir, "Değiştir" ile
// alanlar açılır. Çeviri her formun kendi useT'siyle yapılır (t prop) — metinler
// PROFILE_STRIP_TEXTS ile formun texts listesine eklenir ([[uset-unstable-texts-race]] uyumlu).
import { useEffect, useState } from "react";
import { Pencil, UserRound, Bell, MessageSquare, Mail } from "lucide-react";
import { countryFlag, countryName } from "@/lib/constants";
import type { ContactPref } from "@/components/ContactPrefFields";

export interface PatientProfile {
  name: string;
  country: string | null;
  language: string | null;
  phone: string | null;
  contactPref: ContactPref | null;
}

export const PROFILE_STRIP_TEXTS = [
  "Kayıtlı bilgileriniz",
  "Değiştir",
  "Uygulama üzerinden mesaj",
  "Telefon üzerinden mesaj",
  "E-posta",
] as const;

const PREF_META: Record<ContactPref, { label: string; icon: typeof Bell }> = {
  APP: { label: "Uygulama üzerinden mesaj", icon: Bell },
  SMS: { label: "Telefon üzerinden mesaj", icon: MessageSquare },
  EMAIL: { label: "E-posta", icon: Mail },
};

// Profili bir kez çeker; hasta değilse / hata olursa null kalır (formlar bugünkü gibi boş açılır).
export function usePatientProfile(): { profile: PatientProfile | null; loaded: boolean } {
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/patient/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive) { setProfile(d); setLoaded(true); } })
      .catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);
  return { profile, loaded };
}

// Şerit gösterim eşiği: iletişim kurulabilir profil (telefon + tercih). Ülke/dil varsa gösterilir.
export function profileComplete(p: PatientProfile | null, fields: "full" | "contact"): boolean {
  if (!p) return false;
  if (fields === "contact") return !!(p.phone && p.contactPref);
  return !!(p.phone && p.contactPref && p.country);
}

// Kompakt kimlik/iletişim şeridi — alanların yerine geçer; "Değiştir" alanları geri açar.
// fields="full": ad · ülke · telefon · tercih (triyaj/ücretsiz/SO) · "contact": telefon · tercih (turizm).
export function ProfileStrip({
  profile, fields, onEdit, t,
}: {
  profile: PatientProfile;
  fields: "full" | "contact";
  onEdit: () => void;
  t: (s: string) => string;
}) {
  const pref = profile.contactPref ? PREF_META[profile.contactPref] : null;
  const PrefIcon = pref?.icon ?? Bell;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl border border-[var(--c-accent)]/25 bg-[var(--c-accent)]/[0.06] px-4 py-3">
      <span className="inline-flex items-center gap-1.5 aura-mono text-[11px] uppercase tracking-[0.2em] text-[var(--c-accent-stronger)]">
        <UserRound size={14} /> {t("Kayıtlı bilgileriniz")}
      </span>
      <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-[var(--c-ink)]">
        {fields === "full" && <span className="font-medium text-[var(--c-ink)]">{profile.name}</span>}
        {fields === "full" && profile.country && (
          <span>{countryFlag(profile.country)} {t(countryName(profile.country))}</span>
        )}
        {profile.phone && <span dir="ltr">{profile.phone}</span>}
        {pref && (
          <span className="inline-flex items-center gap-1 text-[var(--c-ink-2)]">
            <PrefIcon size={13} /> {t(pref.label)}
          </span>
        )}
      </span>
      <button
        type="button"
        onClick={onEdit}
        className="ms-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[var(--c-accent)] hover:bg-[var(--c-accent)]/10"
      >
        <Pencil size={12} /> {t("Değiştir")}
      </button>
    </div>
  );
}
