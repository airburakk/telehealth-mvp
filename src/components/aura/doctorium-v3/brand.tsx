// V3 wordmark (kullanıcı 2026-08-26: "doctorium logosunun fontunu da değiştir") — Space Grotesk
// (aura-display) yerine gövdeyle AYNI aile: Inter semibold, negatif tracking, cv11/ss01
// (tek-katlı a + açık dijital ayrımlar — brief'in SF-yakınlaştırma reçetesi). Renk düzeni
// AYNEN: "Doctor" mürekkep + "ium" zümrüt (--dl-* → bölüm paletiyle çözülür). Paylaşılan
// DoctoriumWord (doctorium-brand.tsx) DEĞİŞMEDİ — portal/giriş yüzeyleri v2 lockup'ında
// yaşamaya devam eder; v3 kesinleşince takas tek noktadan yapılır.
// 🪤 fontFeatureSettings INLINE: globals.css'e yeni sınıf eklemek Turbopack kısmi CSS
// önbelleğine takılabiliyor ([[turbopack-css-partial-cache]]).
export function DoctoriumWordV3({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-semibold tracking-[-0.02em] text-[var(--dl-ink)] ${className}`.trim()}
      style={{ fontFeatureSettings: '"cv11", "ss01"' }}
    >
      Doctor<span className="text-[var(--dl-emerald)]">ium</span>
    </span>
  );
}
