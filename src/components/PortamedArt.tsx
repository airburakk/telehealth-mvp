// PortaMed landing illüstrasyonları — fotoğraf yerine marka paletinde (teal/zümrüt/fildişi/altın)
// editorial flat SVG sanatı. Lisanssız, retina-keskin, tema ile bütün.
// Palet: teal #14C3D0 · teal-deep #0EA5B2 · teal-bright #5FD0C7 · emerald #101010 · ivory #F4F1E8 · gold #C6A664

// ── Hero (4:5): "Türkiye'ye açılan kapı" — portal halkası güneş + İstanbul silüeti + Boğaz ──
export function HeroArt() {
  return (
    <svg viewBox="0 0 400 500" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="pm-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#EDF4F0" />
          <stop offset="0.55" stopColor="#DCEAE4" />
          <stop offset="1" stopColor="#C4DCD4" />
        </linearGradient>
        <linearGradient id="pm-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9CCFC6" />
          <stop offset="1" stopColor="#5FB3A8" />
        </linearGradient>
        <radialGradient id="pm-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#7FE9E0" stopOpacity="0.55" />
          <stop offset="1" stopColor="#7FE9E0" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="400" height="500" fill="url(#pm-sky)" />

      {/* Güneş-portal: marka halkası */}
      <circle cx="200" cy="170" r="120" fill="url(#pm-glow)" />
      <ellipse cx="200" cy="168" rx="56" ry="92" transform="rotate(-18 200 168)" fill="none" stroke="#14C3D0" strokeWidth="17" strokeLinecap="round" />
      <ellipse cx="200" cy="168" rx="56" ry="92" transform="rotate(-18 200 168)" fill="#F4F1E8" opacity="0.35" />

      {/* Kuşlar */}
      <path d="M96 96 q7 -7 14 0 M110 96 q7 -7 14 0" stroke="#101010" strokeWidth="2.4" fill="none" strokeLinecap="round" opacity="0.55" />
      <path d="M292 122 q6 -6 12 0 M304 122 q6 -6 12 0" stroke="#101010" strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.4" />

      {/* Arka sıra silüet (uzak yaka) */}
      <g fill="#7AB5AA" opacity="0.7">
        <rect x="14" y="268" width="10" height="54" />
        <rect x="44" y="282" width="26" height="40" />
        <rect x="350" y="270" width="12" height="52" />
        <rect x="312" y="286" width="24" height="36" />
      </g>

      {/* Ana silüet: cami kubbesi + minareler + Galata */}
      <g fill="#101010">
        {/* Galata kulesi */}
        <rect x="58" y="252" width="26" height="92" rx="3" />
        <path d="M52 258 h38 l-6 -12 h-26 z" />
        <path d="M71 222 l13 24 h-26 z" />
        <rect x="63" y="262" width="4" height="7" rx="2" fill="#F4F1E8" opacity="0.85" />
        <rect x="72" y="262" width="4" height="7" rx="2" fill="#F4F1E8" opacity="0.85" />
        <rect x="81" y="262" width="3" height="7" rx="1.5" fill="#F4F1E8" opacity="0.85" />

        {/* Minare sol */}
        <rect x="142" y="216" width="9" height="128" rx="2" />
        <path d="M146.5 196 l9 22 h-18 z" />
        <rect x="138" y="252" width="17" height="5" rx="2.5" />

        {/* Ana kubbe */}
        <path d="M170 344 v-44 a62 62 0 0 1 124 0 v44 z" />
        <circle cx="232" cy="236" r="6" />
        <rect x="230.5" y="218" width="3" height="16" rx="1.5" />
        {/* Yan kubbeler */}
        <path d="M152 344 v-22 a26 26 0 0 1 52 0 v22 z" />
        <path d="M260 344 v-22 a26 26 0 0 1 52 0 v22 z" />

        {/* Minare sağ */}
        <rect x="313" y="216" width="9" height="128" rx="2" />
        <path d="M317.5 196 l9 22 h-18 z" />
        <rect x="309" y="252" width="17" height="5" rx="2.5" />
      </g>
      {/* Kubbe kapı/pencere ışıkları */}
      <g fill="#F4F1E8" opacity="0.9">
        <path d="M222 344 v-26 a10 10 0 0 1 20 0 v26 z" />
        <rect x="186" y="320" width="7" height="11" rx="3.5" />
        <rect x="271" y="320" width="7" height="11" rx="3.5" />
      </g>

      {/* Boğaz */}
      <rect y="344" width="400" height="156" fill="url(#pm-sea)" />
      <g stroke="#F4F1E8" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.7">
        <path d="M28 388 q14 -8 28 0 t28 0" />
        <path d="M212 416 q14 -8 28 0 t28 0" />
        <path d="M96 452 q14 -8 28 0 t28 0" />
        <path d="M300 462 q12 -7 24 0 t24 0" />
      </g>
      {/* Yansıma */}
      <ellipse cx="200" cy="376" rx="74" ry="9" fill="#7FE9E0" opacity="0.4" />

      {/* Vapur */}
      <g transform="translate(284 396)">
        <path d="M0 18 h74 l-10 16 h-54 z" fill="#101010" />
        <rect x="12" y="6" width="44" height="13" rx="3" fill="#F4F1E8" />
        <rect x="20" y="9" width="6" height="6" rx="1.5" fill="#0EA5B2" />
        <rect x="31" y="9" width="6" height="6" rx="1.5" fill="#0EA5B2" />
        <rect x="42" y="9" width="6" height="6" rx="1.5" fill="#0EA5B2" />
        <rect x="50" y="-4" width="5" height="11" rx="2" fill="#C6A664" />
      </g>
    </svg>
  );
}

// ── Paket görselleri (4:3) ──
export function PackArtHair() {
  return (
    <svg viewBox="0 0 400 300" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="400" height="300" fill="#E8F2EE" />
      <circle cx="330" cy="50" r="90" fill="#D7E9E2" />
      <circle cx="56" cy="252" r="70" fill="#D7E9E2" />
      {/* Profil silüeti */}
      <path d="M150 268 v-36 c-26 -8 -44 -32 -44 -62 0 -38 30 -68 70 -68 38 0 68 27 70 64 1 14 -3 22 7 34 4 5 3 10 -4 12 -5 1 -6 3 -5 9 0 4 -2 7 -6 8 -3 1 -4 3 -3 7 2 8 -3 13 -12 12 l-14 -1 v21 z" fill="#101010" />
      {/* Saç çizgisi + greft noktaları */}
      <path d="M118 130 q24 -44 66 -36" stroke="#5FD0C7" strokeWidth="6" fill="none" strokeLinecap="round" />
      <g fill="#14C3D0">
        <circle cx="128" cy="118" r="5" /><circle cx="146" cy="104" r="5" /><circle cx="166" cy="96" r="5" /><circle cx="186" cy="94" r="5" />
      </g>
      {/* Filiz/büyüme kıvılcımları */}
      <g stroke="#C6A664" strokeWidth="3.4" strokeLinecap="round" fill="none">
        <path d="M226 84 v-16 M218 76 h16" />
        <path d="M254 116 v-12 M248 110 h12" />
      </g>
    </svg>
  );
}

export function PackArtSmile() {
  return (
    <svg viewBox="0 0 400 300" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="400" height="300" fill="#EAF1EC" />
      <circle cx="64" cy="56" r="84" fill="#DCEAE2" />
      <circle cx="348" cy="248" r="76" fill="#DCEAE2" />
      {/* Diş */}
      <path d="M158 86 c-26 0 -42 20 -40 46 2 24 10 34 12 56 1 13 6 26 16 26 9 0 10 -11 12 -22 2 -12 4 -18 12 -18 8 0 10 6 12 18 2 11 3 22 12 22 10 0 15 -13 16 -26 2 -22 10 -32 12 -56 2 -26 -14 -46 -40 -46 -7 0 -17 4 -12 4 5 0 -5 -4 -12 -4 z" fill="#FDFCF8" stroke="#101010" strokeWidth="7" strokeLinejoin="round" transform="translate(28 0)" />
      {/* Parlama */}
      <path d="M180 124 q10 -12 24 -10" stroke="#5FD0C7" strokeWidth="6" fill="none" strokeLinecap="round" transform="translate(28 0)" />
      {/* Altın kıvılcımlar */}
      <g fill="#C6A664">
        <path d="M286 78 l5 12 12 5 -12 5 -5 12 -5 -12 -12 -5 12 -5 z" />
        <path d="M104 196 l4 9 9 4 -9 4 -4 9 -4 -9 -9 -4 9 -4 z" />
      </g>
      {/* Gülüş yayı */}
      <path d="M132 238 q84 36 164 -10" stroke="#14C3D0" strokeWidth="7" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function PackArtIvf() {
  return (
    <svg viewBox="0 0 400 300" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="400" height="300" fill="#E9F1EF" />
      <circle cx="350" cy="58" r="86" fill="#DAE9E4" />
      <circle cx="44" cy="246" r="64" fill="#DAE9E4" />
      {/* Embriyo: bölünen hücreler */}
      <circle cx="200" cy="150" r="86" fill="none" stroke="#101010" strokeWidth="7" />
      <circle cx="200" cy="150" r="86" fill="#F4F1E8" opacity="0.5" />
      <g fill="#14C3D0" opacity="0.92">
        <circle cx="172" cy="124" r="30" />
        <circle cx="230" cy="126" r="28" />
        <circle cx="174" cy="180" r="28" />
        <circle cx="228" cy="178" r="30" />
      </g>
      <g fill="#F4F1E8">
        <circle cx="172" cy="124" r="9" /><circle cx="230" cy="126" r="8" /><circle cx="174" cy="180" r="8" /><circle cx="228" cy="178" r="9" />
      </g>
      {/* Kalp */}
      <path d="M306 212 c-6 -10 -22 -8 -22 6 0 10 12 16 22 24 10 -8 22 -14 22 -24 0 -14 -16 -16 -22 -6 z" fill="#C6A664" />
      {/* Yörünge kıvılcımı */}
      <circle cx="118" cy="84 " r="6" fill="#5FD0C7" />
    </svg>
  );
}

// ── Hekim avatarları (kare) — GERÇEK profil fotoğrafı ──
// Öncelik: doktorun kendi fotoğrafı (photo, ör. /photos/pool/p07.jpg) → yoksa cinsiyet-fallback
// (/photos/doctor-female.jpg · doctor-male.jpg). Parent yuvarlatır + kırpar (object-cover).
export function DoctorArt({ i = 0, female, photo }: { i?: number; female?: boolean; photo?: string | null }) {
  const isF = female ?? (i % 3 !== 0); // explicit cinsiyet verilmezse landing sırası heuristiği
  const src = photo || (isF ? "/photos/doctor-female.jpg" : "/photos/doctor-male.jpg");
  // eslint-disable-next-line @next/next/no-img-element -- statik yerel görsel; next/image fill için ekstra sarmalayıcı gerekir
  return <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />;
}

// ── Referans portresi (kare, zümrüt panel üstünde) ──
export function TestimonialArt() {
  return (
    <svg viewBox="0 0 240 240" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="240" height="240" fill="#0C4A43" />
      <circle cx="120" cy="104" r="78" fill="#7FE9E0" opacity="0.14" />
      <circle cx="120" cy="100" r="58" fill="none" stroke="#C6A664" strokeWidth="3" opacity="0.7" />
      {/* Omuz + ceket */}
      <path d="M36 240 c6 -52 38 -74 84 -74 s78 22 84 74 z" fill="#F4F1E8" />
      <path d="M120 170 l-17 16 17 34 17 -34 z" fill="#14C3D0" />
      {/* Boyun + baş */}
      <rect x="106" y="128" width="28" height="30" rx="12" fill="#E9C29B" />
      <circle cx="120" cy="100" r="40" fill="#E9C29B" />
      {/* Saç (kısa, hafif kır) */}
      <path d="M80 96 c0 -30 19 -44 40 -44 s40 14 40 44 c0 4 -1 8 -2 11 -5 -24 -17 -33 -38 -33 s-33 9 -38 33 c-1 -3 -2 -7 -2 -11 z" fill="#5C5448" />
      {/* Yüz */}
      <g fill="#243530">
        <circle cx="106" cy="102" r="3.8" />
        <circle cx="134" cy="102" r="3.8" />
      </g>
      <path d="M110 118 q10 9 20 0" stroke="#243530" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      {/* Hafif sakal gölgesi */}
      <path d="M96 120 q24 26 48 0 q-6 18 -24 18 t-24 -18 z" fill="#5C5448" opacity="0.18" />
    </svg>
  );
}
