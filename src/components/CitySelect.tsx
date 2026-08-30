"use client";

import { TR_PROVINCES, KKTC_CITIES, CITY_ABROAD } from "@/lib/cities";

// Kapalı şehir listesi <select>'i (lib/cities.ts) — üç kayıt formunun ortak alanı
// (DoctorSignupForm · StudentGateForm · CompleteProfileForm). Görünüm sınıfı çağırandan
// gelir: her form kendi INPUT sabitini geçirir, böylece bileşen stil dayatmaz.
// Veri lib/cities.ts'te kalır ("use client" modülünden veri export edilmez —
// sunucu uçları isAllowedCity'yi oradan alır).
export function CitySelect({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={className} required>
      <option value="" disabled>
        Seçin…
      </option>
      <optgroup label="Türkiye">
        {TR_PROVINCES.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </optgroup>
      <optgroup label="KKTC">
        {KKTC_CITIES.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </optgroup>
      <optgroup label="Diğer">
        <option value={CITY_ABROAD}>{CITY_ABROAD}</option>
      </optgroup>
    </select>
  );
}
