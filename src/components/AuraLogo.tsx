// AURA marka primitifleri — TEK KAYNAK. v6.137 (2026-08-23, kullanıcı kararı): marka seti v2.
//
// ── Sembol = HOLOGRAFİK KÜRE (eski "çekirdek + 3 yay" AuraMark SÜPERSEDE) ──
// Kullanıcının marka seti v2'deki hareketli küre. Kaynak 4,6MB GIF'ti; paketin canlıda uyguladığı
// SVG renk filtresi (hueRotate 276° + lüminans→alfa) karelere PİŞİRİLDİ, gürültü giderildi ve
// alfa kanallı animasyonlu WebP'ye indirildi (160px 352KB / 240px 717KB — public/brand/).
// Zümrüt (Doctorium) varyantı AYNI karelerin yalnız hue'su −30° kaydırılmış hâli (S/V/alfa
// birebir); hedef sitedeki "ium" rengi #34d399 (ölçülen 158,0° / hedef 158,1°).
// Üretim hattı ve tuzakları: hafıza [[gif-alfa-webp-kucultme]].
//
// 🔑 KOYU DİSK (kullanıcı kararı 2026-08-23): küre her zaman #0d0e10 dairesel zemin üstünde
// çizilir. Koyu yüzeylerde görünmez (zeminle aynı), AÇIK zeminlerde (landing açık bölümleri,
// gündüz teması) küreyi yıkanmaktan korur — favicon'la aynı kurgu. Tema algılama YOK → hata yok.
//
// Nabız/hâle katmanları paketin aura-logo.css'inden birebir (::before yayılım + ::after iç
// parlama, CSS'te .aura-sphere). Bekleme göstergesi (AuraSpinner) aynı küre, nabız 1,3s.
// Reduced-motion: CSS küreyi STATİK PNG'ye çevirir (animasyonlu WebP CSS ile durdurulamaz).
//
// 🪤 AuraMark/AuraSpinner HOOK'SUZDUR (v6.7): server component'lerde kullanılır; ekran-dışı
// duraklatma dışarıdan (anim-pause.tsx, .aura-sphere seçicisi) uygulanır.
//
// ── Wordmark = VEKTÖR (PNG çifti ve harf dilimleri SÜPERSEDE) ──
// Kullanıcı bildirimi 2026-08-23: "AURA yazısında pikselleşme var" — hero/kapı letterform'u
// 137×142px harf dilimlerinden (public/assets/letters) büyütülüyordu. Wordmark 3340px HQ PNG'den
// TARANMADI, ÖLÇÜLÜP geometrik olarak kuruldu (A bacakları 23,25°, tepe düz kesik; yatay çizgi
// 56/dikey 61px optik fark; U kâsesi yatay ELİPS; R gövdesiz — üst çubuk → elips kâse → 36,25°
// bacak; ikinci A ilkinden 3px dar, ayrı fit). Doğrulama: yol komutları rasterize edilip HQ
// maskeyle karşılaştırıldı, IoU 0,976 (kalan ~0,5px kıymık). Detay: [[aura-wordmark-svg-geometri]].
// viewBox = TAM HARF SINIRI (sol = ilk A'nın sol bacağı, sağ = son A'nın sağ bacağı, üst = tepe,
// alt = U'nun 8px optik taşması) → GLOBAL CARE alt yazısı kutunun kendisiyle hizalanır.

// ─────────────────────────── Ton paletleri ───────────────────────────
// Marka turkuazı (varsayılan) + Doctorium zümrüdü. Ana tonlar sayfa vurgularıyla aynı
// (#28C8D8 = --c-accent / --aura-accent; #34d399 = "ium").
const TONES = {
  brand: { light: "#8AE6EC", mid: "#4FD6E2", main: "#28C8D8" },
  emerald: { light: "#8beecb", mid: "#5fe3b0", main: "#34d399" },
} as const;
export type AuraTone = keyof typeof TONES;

// Küre varlıkları (public/brand). ≤80px CSS → 160px dosya (2× DPR'de yeterli, küre zaten
// yumuşak); üstü → 240px. Statik PNG'ler reduced-motion (CSS) + favicon üretimi (scripts/gen-icons.py).
const SPHERE = {
  brand: { s160: "/brand/aura-sphere-160.webp", s240: "/brand/aura-sphere-240.webp" },
  emerald: { s160: "/brand/doctorium-sphere-160.webp", s240: "/brand/doctorium-sphere-240.webp" },
} as const;

function AuraSymbol({
  size,
  spin = false,
  className = "",
  tone = "brand",
}: {
  size: number;
  spin?: boolean;
  className?: string;
  tone?: AuraTone;
}) {
  const src = size > 80 ? SPHERE[tone].s240 : SPHERE[tone].s160;
  const cls = ["aura-sphere", tone === "emerald" ? "em" : "", spin ? "aura-sphere-fast" : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <span role="img" aria-label="AURA" className={cls} style={{ width: size, height: size }}>
      <span aria-hidden className="aura-sphere-img" style={{ backgroundImage: `url(${src})` }} />
    </span>
  );
}

// Yalnız sembol — hareketli küre (koyu disk üstünde; her zeminde çalışır).
// tone="emerald" = Doctorium alt-marka rengi (varsayılan marka turkuazı).
export function AuraMark({ size = 26, className = "", tone }: { size?: number; className?: string; tone?: AuraTone }) {
  return <AuraSymbol size={size} className={className} tone={tone} />;
}

// Bekleme göstergesi — aynı küre, nabız/hâle 1,3s (kullanıcı kararı 2026-08-23: tek amblem).
// durationMs YOK-sayılır (imzada geriye uyumluluk; hız CSS'te .aura-sphere-fast).
export function AuraSpinner({ size = 48, className = "" }: { size?: number; durationMs?: number; className?: string }) {
  return <AuraSymbol size={size} spin className={className} />;
}

// ─────────────────────────── Wordmark (vektör) ───────────────────────────
// viewBox tam harf sınırı: 3112.9 × 604.8 (harf yüksekliği 596.8 + U taşması 8). Oran 5.147.
export const AURA_WORD_VIEWBOX = "125.8 215.6 3112.9 604.8";
export const AURA_WORD_RATIO = 3112.9 / 604.8;
// Eski PNG (835×255, harfler 158px) ile aynı GÖRSEL boyutu korumak için: eski "canvas
// yüksekliği" → yeni svg yüksekliği çarpanı = (158/255) × (604.8/596.8) = 0.628. Çağıranlar
// eski PNG yüksekliklerini veriyorsa bu çarpanla geçir (AuraWordmark/AuraLogo böyle yapar).
export const AURA_WORD_FROM_PNG_HEIGHT = 0.628;
const AURA_WORD_PATHS = [
  "M382.1 215.6 L455.9 215.6 L714.5 812.4 L645.6 812.4 L418.7 282.0 L193.5 812.4 L125.8 812.4 Z",
  "M1043.2 215.6 L1103.5 215.6 L1103.5 595.5 A180.5 168.0 0 0 0 1464.5 595.5 L1464.5 215.6 L1527.5 215.6 L1527.5 606.0 A242.1 214.4 0 0 1 1043.2 606.0 Z",
  "M1876.0 215.6 L2156.2 215.6 A190.7 189.7 0 0 1 2281.9 548.0 Q2254.2 572.1 2184.1 594.0 L2344.9 812.4 L2265.3 812.4 L2067.7 542.5 L2168.0 542.5 Q2187.8 539.2 2212.3 526.0 A125.3 134.5 0 0 0 2156.1 271.3 L1900.0 271.3 Z",
  "M2909.7 215.6 L2981.3 215.6 L3238.7 812.4 L3169.0 812.4 L2944.9 285.9 L2722.8 812.4 L2653.3 812.4 Z",
] as const;

// Ham wordmark SVG'si. Boyut: className/style ile YÜKSEKLİK ver, genişlik orandan gelir
// (aspect-ratio inline → `w-auto` her bağlamda doğru). Renk: `fill` (CSS değişkeni olabilir,
// style.fill'e gider). decorative=true → aria-hidden (yanında görünür "AURA" metni/etiketi varsa).
export function AuraWordSvg({
  className = "",
  style,
  fill = "currentColor",
  label = "AURA",
  decorative = false,
}: {
  className?: string;
  style?: React.CSSProperties;
  fill?: string;
  label?: string;
  decorative?: boolean;
}) {
  return (
    <svg
      viewBox={AURA_WORD_VIEWBOX}
      className={className}
      style={{ display: "block", aspectRatio: "3112.9 / 604.8", fill, ...style }}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      xmlns="http://www.w3.org/2000/svg"
    >
      {AURA_WORD_PATHS.map((d) => (
        <path key={d.slice(0, 12)} d={d} />
      ))}
    </svg>
  );
}

// (v6.138, 2026-08-23 — kullanıcı kararı: Braille ⠁⠥⠗⠁ SİTE GENELİNDEN KALDIRILDI. `AuraBraille`
// bileşeni, nokta geometrisi ve "wordmark'ın tam altında" marka kuralı silindi; geri EKLENMEZ.
// Tarihçe: [[aura-braille-under-wordmark]].)

// Metin İÇİNDE marka olarak AURA wordmark'ı — "AURA" harfleri yazıyla değil LOGOYLA yazılır
// (kullanıcı kararı 2026-08-17). Doctorium lockup'ının AURA tarafındaki eşleniğidir.
// Artık vektör: renk doğrudan fill (varsayılan marka turkuazı #28C8D8 = TONES.brand.main).
// ⚠️ `currentColor` KULLANMA: bu marka rengidir, metin rengini miras almamalı.
// `height` eski PNG-canvas sözleşmesiyle (0.72em varsayılan) — görsel boyut DEĞİŞMEDİ.
export function AuraWordmark({ color = TONES.brand.main, height = "0.72em", className = "" }: { color?: string; height?: string; className?: string }) {
  const h = `calc(${height} * ${AURA_WORD_FROM_PNG_HEIGHT})`;
  return (
    <AuraWordSvg
      fill={color}
      className={`inline-block shrink-0 align-[-0.02em] ${className}`.trim()}
      style={{ display: "inline-block", height: h, width: `calc(${h} * ${AURA_WORD_RATIO})` }}
    />
  );
}

// Tema-farkında logo: küre + wordmark. Wordmark rengi globals.css `.logo-word` kuralıyla
// (gündüz lacivert, gece beyaz — .theme-dark). `ink` prop'u YOK-sayılır (geriye uyumluluk).
export function AuraLogo({ size = 24 }: { size?: number; ink?: string }) {
  const wordH = Math.round(size * 0.6 * AURA_WORD_FROM_PNG_HEIGHT * 10) / 10;
  return (
    <span className="inline-flex items-center" style={{ lineHeight: 1 }}>
      <AuraMark size={size} />
      <AuraWordSvg className="logo-word" style={{ height: wordH, marginLeft: Math.round(size * 0.3) }} />
    </span>
  );
}

// ─────────────────────────── Tam lockup ───────────────────────────
// Küre + AURA + "GLOBAL CARE". Kullanıcı kararı 2026-08-23: footer'da. (Giriş kapılarında
// KULLANILMAZ — v6.138: kapılar logosuz, GLOBAL CARE orada WordHeadline'ın AURA'sının altında.)
// Birim H = AURA harf yüksekliği (px). Oranlar ÖLÇÜLDÜ (tahmin değil):
//   • küre 2.65H, küre↔yazı boşluğu .39H — paketin kendi aura-logo.css'i (236px küre ↔ 470px wordmark)
//   • GLOBAL CARE harf yüksekliği .235H, AURA→GLOBAL CARE boşluğu .215H — kullanıcının referans
//     görselinden; Inter cap-height .727 → font-size .323H, line-height .727 (kutu = harf yüksekliği),
//     margin .215H − taşma payı (U'nun 8px'i = .0134H) = .2016H
//   • harfler wordmark kutusuna (ilk A'nın sol bacağı ↔ son A'nın sağ bacağı) space-between ile
//     yayılır; GLOBAL ile CARE arasında .85em ek boşluk
//   • küre, AURA + GLOBAL CARE bloğunun TOPLAM yüksekliğine göre dikey ortalanır
// Renk: wordmark + alt yazı `--aura-ink` (landing/kapı token'ı) → koyu yüzeyde beyaz.
// GLOBAL CARE alt yazısı tek kaynak: `GlobalCareLine` (WordHeadline de kullanır).
export const GLOBAL_CARE = ["G", "L", "O", "B", "A", "L", "C", "A", "R", "E"] as const;

// "GLOBAL CARE" satırı — wordmark kutusunun TAM genişliğine yayılır (flex-col ebeveynde
// stretch). `wordHeight` = AURA harf yüksekliği; px sayı ya da CSS uzunluğu (em) olabilir.
// Oranlar referanstan: font .323H (cap .235H), üst boşluk .2016H (= .215H − U taşması .0134H).
// Stil INLINE: Turbopack'in kısmi CSS önbelleği yeni sınıfı dev'de düşürebiliyor.
export function GlobalCareLine({ wordHeight, color = "var(--aura-ink)" }: { wordHeight: number | string; color?: string }) {
  const px = typeof wordHeight === "number";
  // 🪤 em tuzağı: `font-size`'daki em EBEVEYNİN puntosuna, `margin`daki em elemanın KENDİ
  // puntosuna göre çözülür. Bu yüzden em modunda üst boşluk alt yazının kendi em'iyle verilir:
  // .2016H / .323H = 0.624em (ölçüldü — aksi hâlde boşluk ~3× küçük çıkıp AURA'ya yapışıyordu).
  return (
    <span
      aria-hidden
      style={{
        display: "flex",
        justifyContent: "space-between",
        lineHeight: 0.727,
        fontWeight: 500,
        whiteSpace: "nowrap",
        color,
        fontSize: px ? wordHeight * 0.323 : `calc(${wordHeight} * 0.323)`,
        marginTop: px ? wordHeight * 0.2016 : "0.624em",
      }}
    >
      {GLOBAL_CARE.map((ch, i) => (
        <span key={i} className={i === 6 ? "ml-[.85em]" : undefined}>
          {ch}
        </span>
      ))}
    </span>
  );
}

export function AuraLockup({
  wordHeight = 32,
  tone,
  className = "",
}: {
  wordHeight?: number;
  tone?: AuraTone;
  className?: string;
}) {
  const H = wordHeight;
  return (
    <span
      role="img"
      aria-label="AURA Global Care"
      className={`aura-lockup inline-flex items-center ${className}`.trim()}
      style={{ gap: Math.round(H * 0.39) }}
    >
      <AuraMark size={Math.round(H * 2.65)} tone={tone} />
      <span aria-hidden className="inline-flex flex-col items-stretch">
        <AuraWordSvg decorative fill="var(--aura-ink)" style={{ height: H * 1.0134, width: H * 5.216 }} />
        <GlobalCareLine wordHeight={H} />
      </span>
    </span>
  );
}
