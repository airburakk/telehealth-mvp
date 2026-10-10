import { useId } from "react";

// Doctorium sosyal hesapları — TEK KAYNAK (2026-09-04, kullanıcı isteği). Instagram + X canlı
// hesaplarla doğrulandı: @doctoriumtr / @Doctoriumtr — marka İngilizce yazımını korur (Doctorium,
// "Doktorium" DEĞİL; "doktor" yazım refleksiyle karışmasın). LinkedIn şirket sayfası 2026-09-06'da
// açıldı (kullanıcı verdi: linkedin.com/company/doctoriumtr). Facebook Sayfası kullanıcı adı
// (`doctoriumtr`, 2026-10-09 alındı — öncesinde adres `facebook.com/people/Doctorium/61595183512706/`
// idi ve kişisel profil gibi görünüyordu) + YouTube kanalı `@doctoriumtr` 2026-10-09'da eklendi.
// Bu liste footer ikon satırını VE /doctorium JSON-LD'sindeki Organization.sameAs'i besler
// (`doctoriumSameAs()`) — hesap eklenince/kalkınca ikisi birlikte değişir.
export const DOCTORIUM_SOCIAL_LINKS = [
  { key: "instagram", label: "Instagram'da Doctorium", href: "https://www.instagram.com/doctoriumtr/" },
  { key: "x", label: "X'te Doctorium", href: "https://x.com/doctoriumtr" },
  { key: "linkedin", label: "LinkedIn'de Doctorium", href: "https://www.linkedin.com/company/doctoriumtr/" },
  { key: "facebook", label: "Facebook'ta Doctorium", href: "https://www.facebook.com/doctoriumtr" },
  { key: "youtube", label: "YouTube'da Doctorium", href: "https://www.youtube.com/@doctoriumtr" },
] as const satisfies readonly { key: string; label: string; href: string }[];

export type DoctoriumSocialKey = (typeof DOCTORIUM_SOCIAL_LINKS)[number]["key"];

/** schema.org `sameAs` — kurumun resmî hesap adresleri (JSON-LD). */
export function doctoriumSameAs(): string[] {
  return DOCTORIUM_SOCIAL_LINKS.map((s) => s.href);
}

// ── Resmî logolar, marka renkli ortak kutuda (2026-10-09, kullanıcı isteği: "orijinal logoları bul,
// tek ölçüye getir; hepsi tek bir dış formun içine otursun; logoların kendi renklerini kullan") ──
// Kaynak: Simple Icons (CC0 1.0) — Instagram · X · Facebook · YouTube `simple-icons@16.34.0`;
// LinkedIn `simple-icons@10.4.0` (LinkedIn'in talebiyle sonraki sürümlerden çıkarıldı; çizim
// LinkedIn'in kendi "in" işaretidir). Logolar ilgili şirketlerin ticari markasıdır; marka
// kılavuzları (Meta · X · YouTube · LinkedIn) logonun YALNIZ o platformdaki hesabımıza bağlantı
// için, biçimi DEĞİŞTİRİLMEDEN kullanımına izin verir → path verisine DOKUNMA (yeniden çizme,
// kırpma, eğme yok). Hover hâli: kutu = markanın kendi rengi, logo = BEYAZ: Facebook dairesindeki "f",
// LinkedIn karesindeki "in" ve YouTube'un oynat üçgeni boşluk olarak kalır ve zemin rengini
// gösterir — bu, kılavuzlardaki "ters renk" sürümlerin kendisidir.
// ORTAK FORM: SQUIRCLE — süperelips |x|^5 + |y|^5 = 12^5 (iOS uygulama ikonu eğrisi), 24 ızgarayı
// tam doldurur; görüntü 28 px. Geçmiş (👤 2026-10-09/10): yuvarlatılmış kare rx 6 → rx 8 → kutu
// şekli beğenilmedi → 6 seçenekli şekil çalışması (daire · squircle · yaprak · altıgen · halka ·
// formsuz) → "İki olsun" = squircle. Path aşağıda önceden hesaplanmış (3°'lik adım, 120 nokta).
// RENK DAVRANIŞI (👤 2026-10-10 — 09.10'daki "yeşil kutu + beyaz logo"nun TERSİ): başlangıçta
// kutu BEYAZ, logo Doctorium YEŞİLİ; üzerine gelince / klavye odağında kutu markanın KENDİ rengine,
// logo beyaza döner. Uygulama: marka zemini altta, beyaz örtü üstte → örtünün opaklığı 1 → 0
// geçer (degrade zeminde de düzgün geçiş); logo `fill` rengi yeşil → beyaz geçer. Beyaz kutu açık
// footer zemininde (#fafaf8) kaybolmasın diye örtüde ince, soluk yeşil kenar çizgisi var.
// Yeşil = SABİT `#047857` (landing'in marka yeşili; beyazla ≈5,5:1) — `--dl-emerald` gece
// portalında `#34d399`'a döner, beyaz kutu üstünde okunmaz (≈1,9:1) → token KULLANILMAZ.
// KUTU İÇİ TEK ÖLÇÜ (anahtar çizgi): kare biçimler 13 · ince X 12,5 · daire 14 · yatay YouTube 15
// genişlik. Ham logolar 24 kutuyu kenara kadar doldurur ve hepsi ortalıdır (ölçüldü) → ölçek
// merkezden uygulanır; anahtar çizgi ince/dolu biçimlerin optik ağırlığını eşitler.
// Kitle (doktor zümrüt / öğrenci koral) ve tema renklendirmesi bu ikonlara UYGULANMAZ
// (👤 2026-10-09 — 06.09'daki kitle-renkli ikon kuralını süpersede eder).
const TILE_PATH =
  "M24 12L23.99 15.69L23.97 16.86L23.94 17.71L23.89 18.40L23.83 18.99L23.76 19.50L23.67 19.96L23.57 20.37L23.46 20.75L23.33 21.09L23.18 21.41L23.02 21.70L22.85 21.97L22.66 22.22L22.45 22.45L22.22 22.66L21.97 22.85L21.70 23.02L21.41 23.18L21.09 23.33L20.75 23.46L20.37 23.57L19.96 23.67L19.50 23.76L18.99 23.83L18.40 23.89L17.71 23.94L16.86 23.97L15.69 23.99L12 24L8.31 23.99L7.14 23.97L6.29 23.94L5.60 23.89L5.01 23.83L4.50 23.76L4.04 23.67L3.63 23.57L3.25 23.46L2.91 23.33L2.59 23.18L2.30 23.02L2.03 22.85L1.78 22.66L1.55 22.45L1.34 22.22L1.15 21.97L0.98 21.70L0.82 21.41L0.67 21.09L0.54 20.75L0.43 20.37L0.33 19.96L0.24 19.50L0.17 18.99L0.11 18.40L0.06 17.71L0.03 16.86L0.01 15.69L0 12L0.01 8.31L0.03 7.14L0.06 6.29L0.11 5.60L0.17 5.01L0.24 4.50L0.33 4.04L0.43 3.63L0.54 3.25L0.67 2.91L0.82 2.59L0.98 2.30L1.15 2.03L1.34 1.78L1.55 1.55L1.78 1.34L2.03 1.15L2.30 0.98L2.59 0.82L2.91 0.67L3.25 0.54L3.63 0.43L4.04 0.33L4.50 0.24L5.01 0.17L5.60 0.11L6.29 0.06L7.14 0.03L8.31 0.01L12 0L15.69 0.01L16.86 0.03L17.71 0.06L18.40 0.11L18.99 0.17L19.50 0.24L19.96 0.33L20.37 0.43L20.75 0.54L21.09 0.67L21.41 0.82L21.70 0.98L21.97 1.15L22.22 1.34L22.45 1.55L22.66 1.78L22.85 2.03L23.02 2.30L23.18 2.59L23.33 2.91L23.46 3.25L23.57 3.63L23.67 4.04L23.76 4.50L23.83 5.01L23.89 5.60L23.94 6.29L23.97 7.14L23.99 8.31Z";
const DOCTORIUM_GREEN = "#047857";
const INSTAGRAM_GRADIENT = [
  ["0", "#FFD600"],
  ["0.25", "#FF7A00"],
  ["0.5", "#FF0069"],
  ["0.75", "#D300C5"],
  ["1", "#7638FA"],
] as const;

const BRAND_MARKS: Record<DoctoriumSocialKey, { d: string; inner: number; color: string | null }> = {
  instagram: {
    inner: 13,
    color: null, // resmî degrade — aşağıda radialGradient
    d: "M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077",
  },
  x: {
    inner: 12.5,
    color: "#000000",
    d: "M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z",
  },
  linkedin: {
    inner: 13,
    color: "#0A66C2",
    d: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  },
  facebook: {
    inner: 14,
    color: "#0866FF",
    d: "M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z",
  },
  youtube: {
    inner: 15,
    color: "#FF0000",
    d: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
  },
};

function BrandTile({ mark }: { mark: DoctoriumSocialKey }) {
  const gradientId = useId();
  const { d, inner, color } = BRAND_MARKS[mark];
  const k = inner / 24;
  const t = (24 - 24 * k) / 2;
  return (
    <svg viewBox="0 0 24 24" width={28} height={28} aria-hidden="true" focusable="false" className="block">
      {color === null && (
        <defs>
          <radialGradient id={gradientId} cx="0.3" cy="1.07" r="1.3">
            {INSTAGRAM_GRADIENT.map(([offset, stop]) => (
              <stop key={offset} offset={offset} stopColor={stop} />
            ))}
          </radialGradient>
        </defs>
      )}
      {/* Marka katmanı başlangıçta GİZLİ (opacity 0): beyaz örtünün altında dursa bile kenar
          yumuşatması marka rengini ince bir hâle olarak sızdırıyordu (2026-10-10 ölçüldü). */}
      <g className="opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
        <path d={TILE_PATH} fill={color ?? `url(#${gradientId})`} />
        {/* X'in siyah kutusu gece zemininde kaybolmasın: çok ince açık çerçeve. */}
        {mark === "x" && (
          <path d={TILE_PATH} transform="translate(0.3 0.3) scale(0.975)" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={0.6} />
        )}
      </g>
      {/* Beyaz örtü + soluk yeşil kenar — <a>'nın `group` durumuyla kaybolur (hover + klavye odağı). */}
      <g className="transition-opacity duration-200 group-hover:opacity-0 group-focus-visible:opacity-0">
        <path d={TILE_PATH} fill="#FFFFFF" />
        <path
          d={TILE_PATH}
          transform="translate(0.25 0.25) scale(0.979)"
          fill="none"
          stroke={DOCTORIUM_GREEN}
          strokeOpacity={0.28}
          strokeWidth={0.5}
        />
      </g>
      <path
        transform={`translate(${t} ${t}) scale(${k})`}
        d={d}
        className="fill-[#047857] transition-colors duration-200 group-hover:fill-white group-focus-visible:fill-white"
      />
    </svg>
  );
}

/** Doctorium footer sosyal ikon satırı — TÜM Doctorium footer'larının tek kaynağı (ortak
 *  DoctoriumFooter + landing V3 footer'ı, ikisi de bunu import eder — bkz. [[doctorium-footer.tsx]]).
 *  Renk davranışı sabit (yeşil → hover'da marka rengi) olduğu için kitle/tema prop'u YOK (2026-10-09). */
export function DoctoriumSocialLinks({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {DOCTORIUM_SOCIAL_LINKS.map((s) => (
        <a
          key={s.key}
          href={s.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={s.label}
          className="group rounded-[10px] transition-transform duration-150 motion-safe:hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dl-emerald)]"
        >
          <BrandTile mark={s.key} />
        </a>
      ))}
    </div>
  );
}
