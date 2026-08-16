// AURA logosu — kullanıcının GERÇEK logosu. Sembol artık animasyonlu VEKTÖREL inline SVG
// (kullanıcının AURA_logo_animated_web_braille_white_v3.svg dosyasından ayıklandı: yörünge
// halkaları + nefes alan çekirdek + aura nabzı; beyaz zemin/wordmark/braille çıkarıldı →
// şeffaf, her zeminde çalışır). Wordmark hâlâ tema-çift PNG (aura-word-light/dark.png).
// Açık zeminde lacivert wordmark, koyu zeminde beyaz. Landing + iç uygulama Header'ı ortak kullanır.

// Sembol geometrisi — tüm AuraMark/AuraSpinner örneklerinde ortak. Gradient id'leri TON-BAŞINA
// SABİT: aynı sayfada aynı ton birden çok kez inline edilince çift-id oluşur ama o tonun TÜM
// tanımları özdeş olduğundan her url(#id) referansı geçerli tanıma çözülür → görsel bozulmaz.
// Farklı tonlar AYNI id'yi PAYLAŞAMAZ (DOM'da önce gelen tanım kazanır, sembol yanlış renge
// boyanır) → her tonun kendi gradient id seti var. Filter'lar (salt blur, renksiz) ortak.
// viewBox pulse'ın en geniş halini (scale 1.75) + ışıma payını kapsar (kırpılma yok).

// Ton paletleri: marka turkuazı (varsayılan) + Doctorium zümrüdü (hekim bilgi portalı alt-markası).
// Zümrüt set turkuaz gradyanın hue-shift karşılığı; ana ton sayfadaki "ium" vurgusuyla aynı (#34d399).
const TONES = {
  brand: { light: "#8AE6EC", mid: "#4FD6E2", main: "#28C8D8", coreId: "auraCoreGrad", fillId: "auraFillGrad" },
  emerald: { light: "#8beecb", mid: "#5fe3b0", main: "#34d399", coreId: "auraCoreGradEm", fillId: "auraFillGradEm" },
} as const;
export type AuraTone = keyof typeof TONES;

function AuraSymbol({ size, spin = false, className = "", tone = "brand" }: { size: number; spin?: boolean; className?: string; tone?: AuraTone }) {
  const t = TONES[tone];
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
        <radialGradient id={t.coreId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={t.light} />
          <stop offset="100%" stopColor={t.main} />
        </radialGradient>
        <radialGradient id={t.fillId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={t.light} stopOpacity=".24" />
          <stop offset="55%" stopColor={t.mid} stopOpacity=".07" />
          <stop offset="100%" stopColor={t.main} stopOpacity="0" />
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
      <circle className="aura-sym-pulse" cx="600" cy="520" r="185" fill={`url(#${t.fillId})`} filter="url(#auraWideGlow)" />
      <circle className="aura-sym-pulse two" cx="600" cy="520" r="185" fill={`url(#${t.fillId})`} filter="url(#auraWideGlow)" />
      <g transform="translate(160 80) scale(7.3333333333)">
        <circle cx="60" cy="60" r="22" fill={t.main} fillOpacity=".16" />
      </g>
      <g className="aura-sym-orbit">
        <g transform="translate(160 80) scale(7.3333333333)" strokeWidth="6.5" strokeLinecap="round" fill="none">
          <g opacity=".34" filter="url(#auraSoftGlow)">
            <path d="M60 24 A36 36 0 0 1 91 42" stroke={t.main} />
            <path d="M91 78 A36 36 0 0 1 60 96" stroke={t.mid} />
            <path d="M29 78 A36 36 0 0 1 29 42" stroke={t.light} />
          </g>
          <path d="M60 24 A36 36 0 0 1 91 42" stroke={t.main} />
          <path d="M91 78 A36 36 0 0 1 60 96" stroke={t.mid} />
          <path d="M29 78 A36 36 0 0 1 29 42" stroke={t.light} />
        </g>
      </g>
      <g className="aura-sym-core">
        <circle cx="600" cy="520" r="73.333333" fill={`url(#${t.coreId})`} filter="url(#auraSoftGlow)" />
      </g>
    </svg>
  );
}

// Yalnız sembol — animasyonlu vektörel AURA amblemi (şeffaf, her zeminde çalışır).
// tone="emerald" = Doctorium alt-marka rengi (varsayılan marka turkuazı).
export function AuraMark({ size = 26, className = "", tone }: { size?: number; className?: string; tone?: AuraTone }) {
  return <AuraSymbol size={size} className={className} tone={tone} />;
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
//
// ⚠️ MİN-GENİŞLİK (v6.9): height*4.67 < 56px ise AuraBraille null döner — "yeterli
// netlikle çizilemiyorsa kaldır" kuralı artık kodda zorunlu, yorumla değil. İkisi de
// height=12 (56px) kullanır; küçültmek Braille'i sessizce YOK EDER (kasıtlı).
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
// Braille viewBox'ı 364×78 → çizilen genişlik = height × 364/78 (≈ 4.67 kat).
const BRAILLE_VB_W = 364;
const BRAILLE_VB_H = 78;
// ⚠️ MİN-GENİŞLİK EŞİĞİ (marka kuralı: "yeterli boşluk ve netlikle çizilemiyorsa Braille
// kaldırılır"). 56px = giriş kapılarındaki mevcut boyut → nokta çapı ~2.15px, noktalar
// birbirinden ayırt edilebilir. Altında Braille okunaksız lekeye döner → HİÇ çizilmez
// (bozuk çizmektense yok say). Ölçüldü 2026-07-15: nokta çapı ≈ genişlik × 0.0385.
const BRAILLE_MIN_WIDTH = 56;

// Varsayılan 12 = eşiğin tam karşılığı (56px): parametresiz <AuraBraille /> çizer.
// (Eski varsayılan 11 → 51.3px, eşiğin ALTINDA kalıp sessizce hiçbir şey çizmezdi.)
export function AuraBraille({ height = 12, className = "" }: { height?: number; className?: string }) {
  // Eşiğin altındaki her çağrı sessizce boş döner — çağıranın koşul yazması gerekmez.
  // Çarpma BÖLMEDEN önce: height=12 tam sınırdadır (12×364/78 = 56) ve `h*(364/78)`
  // kayan-nokta yuvarlamasıyla 55.999… verip Braille'i sessizce yok edebilirdi.
  if ((height * BRAILLE_VB_W) / BRAILLE_VB_H < BRAILLE_MIN_WIDTH) return null;
  return (
    <svg
      height={height}
      viewBox={`401 1164 ${BRAILLE_VB_W} ${BRAILLE_VB_H}`}
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

// Doctorium Braille (⠙⠕⠉⠞⠕⠗⠊⠥⠍ — "doctorium", Grade 1) — AuraBraille'in alt-marka
// eşleniği. ⚠️ MARKA KURALI GÜNCELLENDİ (kullanıcı, 2026-08-16): Braille artık iki
// wordmark'ta da yaşar — AURA braille'i "AURA" yazısının, Doctorium braille'i
// "Doctorium" lockup'ının TAM ALTINDA ortalı. Üst bar/nav gibi küçük yerlere KONMAZ
// (AURA kuralıyla aynı: yeterli netlikle çizilemiyorsa hiç çizilmez). Görsel marka
// detayıdır, erişilebilirlik kanıtı değil — [[aura-braille-under-wordmark]].
//
// Geometri AuraBraille ile birebir (hücre aralığı 112 · sütun/satır adımı 25 · r=7 ·
// kenar payı 14) → iki marka yan yana geldiğinde nokta dokusu özdeş. Fark: AURA'nın
// noktaları orijinal SVG varlığından ayıklanmış sabit liste; burada hücreler standart
// braille nokta numaralarından türetilir (1-2-3 sol sütun, 4-5-6 sağ sütun).
const DOCTORIUM_CELLS: ReadonlyArray<readonly number[]> = [
  [1, 4, 5], // d
  [1, 3, 5], // o
  [1, 4], // c
  [2, 3, 4, 5], // t
  [1, 3, 5], // o
  [1, 2, 3, 5], // r
  [2, 4], // i
  [1, 3, 6], // u
  [1, 3, 4], // m
];
const DOCTORIUM_DOTS: ReadonlyArray<readonly [number, number]> = DOCTORIUM_CELLS.flatMap(
  (cell, i) => cell.map((dot) => [i * 112 + (dot > 3 ? 25 : 0), ((dot - 1) % 3) * 25] as const)
);
// 9 hücre: son nokta x = 8×112+25 = 921; ±14 pay → viewBox 949×78 (AURA ile aynı yükseklik).
const DOCTORIUM_VB_W = 949;
const DOCTORIUM_VB_H = 78;
// ⚠️ MİN-GENİŞLİK: AuraBraille'in 56px eşiğiyle AYNI nokta çapı (~2.15px) 9 hücrede
// 146px'e denk gelir (height=12 karşılığı; 78×146 = 12×949 = 11388 → sınır TAM, kayan
// nokta payı yok). Altında noktalar okunaksız lekeye döner → HİÇ çizilmez (AURA kuralı).
const DOCTORIUM_BRAILLE_MIN_WIDTH = 146;

// Varsayılan 12 = eşiğin tam karşılığı (146px) — AuraBraille ile aynı height ölçeği,
// yani ikisi yan yana kullanılırsa nokta boyutları eşleşir.
export function DoctoriumBraille({ height = 12, className = "" }: { height?: number; className?: string }) {
  if ((height * DOCTORIUM_VB_W) / DOCTORIUM_VB_H < DOCTORIUM_BRAILLE_MIN_WIDTH) return null;
  return (
    <svg
      height={height}
      viewBox={`-14 -14 ${DOCTORIUM_VB_W} ${DOCTORIUM_VB_H}`}
      role="img"
      aria-label="Doctorium"
      fill="currentColor"
      className={className}
      style={{ width: "auto", display: "block" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {DOCTORIUM_DOTS.map(([cx, cy], i) => (
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
