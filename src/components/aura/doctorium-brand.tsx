import type { CSSProperties } from "react";
import Link from "next/link";
import { AuraWordSvg } from "@/components/AuraLogo";

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

// Zümrüt DOLGULU CTA lockup'ı — v6.136 (2026-08-23, kullanıcı kararı; axe bulgusu): dolgu
// KOYU ZÜMRÜT `#065f46` (axe ölçümü: #047857'de nane 4.27 — AA altı), "Doctor" BEYAZ (~7:1),
// "ium" NANE `#a7f3d0` (~5.7:1), düğmenin kalan metni beyaz. Eski (2026-08-18) parlak #34d399
// dolgu + beyaz Doctor 1.92:1 ile AA altındaydı (v1'de de aynıydı, v1 hiç taranmamıştı). İki tonlu
// marka vuruşu korunur. Çağıranların dolgusu DOCTORIUM_CTA_FILL ile hizalanır — parlak zümrüt
// üstünde bu bileşen KULLANILMAZ.
export const DOCTORIUM_CTA_FILL = "bg-[#065f46] text-white hover:bg-[#064e3b]";
export function DoctoriumOnEmerald() {
  return (
    <span className="whitespace-nowrap">
      <span className="text-white">Doctor</span><span className="text-[#a7f3d0]">ium</span>
    </span>
  );
}

// "by AURA" imzası (kullanıcı kararı 2026-08-16, 4. tur): "by" düz metin (link DEĞİL); AURA,
// sitenin GERÇEK wordmark'ıdır (AuraLogo ile aynı vektör) ve yalnız O tıklanabilir →
// AURA vitrin ana sayfası (/). `light`: açık bölümde lacivert (beyaz wordmark beyaz zeminde
// görünmez — AuraLogo'nun .logo-word tema ayrımının bölüm karşılığı).
// v6.137: PNG → vektör (AuraWordSvg); görsel boyut korundu (0.95em canvas ≈ 0.6em harf kutusu).
// Yükseklik em-tabanlı: eyebrow/üst bar/footer hangi puntoda kullanırsa oraya ölçeklenir.
const BY_AURA_NAVY = "#08366f"; // eski aura-word-light.png'nin ölçülen rengi (8,54,111)
export function ByAura({ light = false }: { light?: boolean }) {
  return (
    <span className="whitespace-nowrap">
      <span className="text-[var(--dl-ink)]">by</span>{" "}
      <Link
        href="/"
        className="inline-block transition-opacity duration-200 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dl-cyan)]"
      >
        {/* Erişilebilir ad METİN olarak (sr-only) — SVG dekoratif. QA bulgusu 2026-08-23: metin
            çıkarımı "Doctorium by" diye yarım okuyordu (aria-label'ı her araç okumaz). */}
        <span className="sr-only">AURA</span>
        <AuraWordSvg
          decorative
          fill={light ? BY_AURA_NAVY : "var(--dl-ink)"}
          className="inline-block h-[0.6em] w-auto align-[-0.02em]"
          style={{ display: "inline-block" }}
        />
      </Link>
    </span>
  );
}
