import type { CSSProperties } from "react";
import Link from "next/link";

// Doctorium marka primitifleri — TEK KAYNAK (2026-08-18).
//
// Neden ayrı modül: bu üç bileşen (+ palet) doctorium-landing.tsx içinde YEREL fonksiyon
// olarak yaşıyordu; footer'ı landing dışına (giriş kapısı + iç portal) taşımak için dışa
// açılmaları gerekti. Kopyalamak yerine buraya alındılar — chrome-routes.ts'in başındaki
// ders aynen geçerli: kopya liste/kopya bileşen = kaçınılmaz drift (2026-08-17'de iki
// footer'ın üst üste binmesi tam olarak bu yüzden olmuştu).

// Codex taslağının paleti; CoverArt plaka koyusu (#0d0e10) zemin olarak korunur.
// --dl-body: bölüm gövde grisi — landing'in açık/koyu almaşığında (LIGHT) yeniden bağlanır,
// bu yüzden gövde metinleri sabit hex DEĞİL bu değişkeni kullanır.
// ⚠️ Landing DIŞINDAKİ yüzeylerde (giriş kapısı, iç portal) bu değişkenler tanımlı değil —
// DoctoriumFooter bu yüzden paleti kendi köküne uygular; renk "sadece landing'de doğru"
// olmaz.
export const DOCTORIUM_PALETTE = {
  "--dl-bg": "#0d0e10",
  "--dl-panel": "#161719",
  "--dl-ink": "#f4f5f3",
  "--dl-muted": "#9da1a6",
  "--dl-body": "#aeb2b6",
  "--dl-line": "rgba(255,255,255,.12)",
  "--dl-emerald": "#34d399",
  "--dl-rose": "#fb7185",
  "--dl-amber": "#c6a664",
  // AURA marka turkuazı — AuraLogo TONES.brand.main ile aynı ton ("by AURA" imzası).
  "--dl-cyan": "#28C8D8",
} as CSSProperties;

export function DoctoriumWord({ className = "" }: { className?: string }) {
  return (
    <span className={`aura-display font-medium tracking-tight text-[var(--dl-ink)] ${className}`}>
      Doctor<span className="text-[var(--dl-emerald)]">ium</span>
    </span>
  );
}

// Metin içi marka lockup'ı (kullanıcı kuralı 2026-08-16): "Doctorium" geçen her metinde
// Doctor beyaz(ink) + ium zümrüt. İSTİSNA: zümrüt zeminli CTA butonları — orada ium zümrüt
// olamaz (zemin=ium rengi); CTA varyantı DoctoriumOnEmerald'dır, tek ton koyu DEĞİL.
export function DoctoriumInline() {
  return (
    <span className="whitespace-nowrap">
      <span className="text-[var(--dl-ink)]">Doctor</span>
      <span className="text-[var(--dl-emerald)]">ium</span>
    </span>
  );
}

// Zümrüt DOLGULU CTA lockup'ı (kullanıcı kararı 2026-08-18): "Doctor" BEYAZ, "ium" düğme
// metninin koyusunda kalır — iki tonlu marka vuruşu zümrüt zeminde de yaşar. Eski istisna
// ("buton metni tek ton koyu") SÜPERSEDE. Düğmenin kalan metni ("'a katıl") bileşen DIŞINDA
// ve düğme renginde; yalnız marka adı buradan geçer.
export function DoctoriumOnEmerald() {
  return (
    <span className="whitespace-nowrap">
      <span className="text-white">Doctor</span>ium
    </span>
  );
}

// "by AURA" imzası (kullanıcı kararı 2026-08-16, 4. tur): "by" düz metin (link DEĞİL); AURA,
// sitenin GERÇEK wordmark PNG'sidir (AuraLogo ile aynı varlıklar) ve yalnız O tıklanabilir →
// AURA vitrin ana sayfası (/). `light`: açık bölümde lacivert wordmark varyantı (beyaz PNG
// beyaz zeminde görünmez — AuraLogo'nun logo-word-light/dark ayrımının bölüm karşılığı).
// Yükseklik em-tabanlı: eyebrow/üst bar/footer hangi puntoda kullanırsa oraya ölçeklenir.
export function ByAura({ light = false }: { light?: boolean }) {
  return (
    <span className="whitespace-nowrap">
      <span className="text-[var(--dl-ink)]">by</span>{" "}
      <Link
        href="/"
        className="inline-block transition-opacity duration-200 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dl-cyan)]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={light ? "/aura-word-light.png" : "/aura-word-dark.png"}
          alt="AURA"
          className="inline-block h-[0.95em] w-auto align-[-0.12em]"
        />
      </Link>
    </span>
  );
}
