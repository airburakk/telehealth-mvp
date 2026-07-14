// AURA logosu — kullanıcının GERÇEK logosu. Sembol artık animasyonlu VEKTÖREL inline SVG
// (kullanıcının AURA_logo_animated_web_braille_white_v3.svg dosyasından ayıklandı: yörünge
// halkaları + nefes alan çekirdek + aura nabzı; beyaz zemin/wordmark/braille çıkarıldı →
// şeffaf, her zeminde çalışır). Wordmark hâlâ tema-çift PNG (aura-word-light/dark.png).
// Açık zeminde lacivert wordmark, koyu zeminde beyaz. Landing + iç uygulama Header'ı ortak kullanır.

// Sembol geometrisi — tüm AuraMark/AuraSpinner örneklerinde ortak. Gradient/filter id'leri
// SABİT: aynı sayfada birden çok kez inline edilince çift-id oluşur ama TÜM tanımlar özdeş
// olduğundan her url(#id) referansı geçerli (özdeş) tanıma çözülür → görsel bozulmaz.
// viewBox pulse'ın en geniş halini (scale 1.75) + ışıma payını kapsar (kırpılma yok).
function AuraSymbol({ size, spin = false, className = "" }: { size: number; spin?: boolean; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="236 156 728 728"
      role="img"
      aria-label="AURA"
      className={`${spin ? "aura-sym-fast " : ""}${className}`.trim()}
      style={{ display: "block", overflow: "visible" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="auraCoreGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#8AE6EC" />
          <stop offset="100%" stopColor="#28C8D8" />
        </radialGradient>
        <radialGradient id="auraFillGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#8AE6EC" stopOpacity=".24" />
          <stop offset="55%" stopColor="#4FD6E2" stopOpacity=".07" />
          <stop offset="100%" stopColor="#28C8D8" stopOpacity="0" />
        </radialGradient>
        <filter id="auraSoftGlow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="7" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="auraWideGlow" x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation="20" />
        </filter>
      </defs>
      <circle className="aura-sym-pulse" cx="600" cy="520" r="185" fill="url(#auraFillGrad)" filter="url(#auraWideGlow)" />
      <circle className="aura-sym-pulse two" cx="600" cy="520" r="185" fill="url(#auraFillGrad)" filter="url(#auraWideGlow)" />
      <g transform="translate(160 80) scale(7.3333333333)">
        <circle cx="60" cy="60" r="22" fill="#28C8D8" fillOpacity=".16" />
      </g>
      <g className="aura-sym-orbit">
        <g transform="translate(160 80) scale(7.3333333333)" strokeWidth="6.5" strokeLinecap="round" fill="none">
          <g opacity=".34" filter="url(#auraSoftGlow)">
            <path d="M60 24 A36 36 0 0 1 91 42" stroke="#28C8D8" />
            <path d="M91 78 A36 36 0 0 1 60 96" stroke="#4FD6E2" />
            <path d="M29 78 A36 36 0 0 1 29 42" stroke="#8AE6EC" />
          </g>
          <path d="M60 24 A36 36 0 0 1 91 42" stroke="#28C8D8" />
          <path d="M91 78 A36 36 0 0 1 60 96" stroke="#4FD6E2" />
          <path d="M29 78 A36 36 0 0 1 29 42" stroke="#8AE6EC" />
        </g>
      </g>
      <g className="aura-sym-core">
        <circle cx="600" cy="520" r="73.333333" fill="url(#auraCoreGrad)" filter="url(#auraSoftGlow)" />
      </g>
    </svg>
  );
}

// Yalnız sembol — animasyonlu vektörel AURA amblemi (şeffaf, her zeminde çalışır).
export function AuraMark({ size = 26, className = "" }: { size?: number; className?: string }) {
  return <AuraSymbol size={size} className={className} />;
}

// Dönen AURA sembolü — bekleme göstergesi. Aynı vektörel amblem; yörünge belirgin
// hızlanır (aura-sym-fast). durationMs artık YOK-sayılır (imzada geriye uyumluluk için;
// hız CSS'te .aura-sym-fast ile sabit) — eski PNG animate-spin yaklaşımının yerini aldı.
export function AuraSpinner({ size = 48, className = "" }: { size?: number; durationMs?: number; className?: string }) {
  return <AuraSymbol size={size} spin className={className} />;
}

// AURA Braille (⠁⠥⠗⠁) — kullanıcının logosundaki dokunsal marka detayı. Nokta
// koordinatları orijinal SVG'den (translate(17,0) uygulanmış). fill=currentColor →
// kullanıldığı yerin metin rengini alır (tema-uyumlu: gece açık, gündüz koyu).
// viewBox noktaları r=7 payıyla sarar.
//
// ⚠️ MARKA KURALI (kullanıcı, 2026-07-14): Braille DAİMA "AURA" yazısının (wordmark
// PNG veya WordHeadline letterform) **TAM ALTINDA, hizalı** yerleştirilir — sembolün
// altında veya tek başına ASLA. Yeni bir yere Braille eklerken orada bir "AURA" yazısı
// olmalı ve Braille onun altına ortalanmalı. Küçük yerlerde (nav) okunmaz → hiç konmaz.
// Mevcut yerler: landing footer (closing.tsx, wordmark altı) + giriş kapıları
// (word-headline.tsx braille prop, letterform altı). Detay: [[aura-braille-under-wordmark]].
const BRAILLE_DOTS: ReadonlyArray<readonly [number, number]> = [
  [415, 1178],
  [527, 1178],
  [527, 1228],
  [552, 1228],
  [639, 1178],
  [639, 1203],
  [639, 1228],
  [664, 1203],
  [751, 1178],
];
export function AuraBraille({ height = 11, className = "" }: { height?: number; className?: string }) {
  return (
    <svg
      height={height}
      viewBox="401 1164 364 78"
      role="img"
      aria-label="AURA"
      fill="currentColor"
      className={className}
      style={{ width: "auto", display: "block" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {BRAILLE_DOTS.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="7" />
      ))}
    </svg>
  );
}

// Tema-farkında wordmark: her iki PNG de render edilir, görünürlüğü globals.css'teki
// .theme-* kuralları seçer (gündüz = lacivert light PNG, gece = beyaz dark PNG).
// `ink` prop'u artık YOK-sayılır (geriye uyumluluk için imzada bırakıldı) — tema toggle
// sabit prop ile çözülemezdi (eski onDark anahtarı render-zamanı sabitti).
export function PortamedLogo({ size = 24 }: { size?: number; ink?: string }) {
  const wordH = Math.round(size * 0.6);
  // display INLINE verilmez — görünürlüğü .logo-word-* class'ları yönetir (inline style
  // CSS kuralını ezip her iki wordmark'ı birden gösterirdi).
  const wStyle = { height: wordH, width: "auto", marginLeft: Math.round(size * 0.3) } as const;
  return (
    <span className="inline-flex items-center" style={{ lineHeight: 1 }}>
      <AuraMark size={size} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/aura-word-light.png" alt="AURA" className="logo-word-light" height={wordH} style={wStyle} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/aura-word-dark.png" alt="" aria-hidden className="logo-word-dark" height={wordH} style={wStyle} />
    </span>
  );
}
