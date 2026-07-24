import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { V2Home } from "@/components/aura/v2/home";
import { COPY, LANG_CODES, type Lang } from "@/lib/aura-landing/copy";
import { OG_LOCALE } from "@/lib/aura-landing/seo";

// Locale rotaları (v6.17, backlog P1-i18n): /en /tr /de /fr /ru /ar /fa /az /bg —
// landing'i URL dilinde SSR'lar (ilk boyama o dilde; air_lang okuması atlanır,
// kayıtlı tercih EZİLMEZ — i18n.tsx initialLang sözleşmesi).
//
// ⚠️ İLK AŞAMA BİLİNÇLİ noindex + sitemap'e GİRMEZ: "/" v5.9.1'den beri çok-dil-
// tek-URL kanonik stratejisiyle indeksli — locale rotalarını indekslemeye açmak
// (noindex kaldır + sitemap + "/" canonical stratejisi) SEO'yu yeniden şekillendiren
// ayrı bir karardır ve kullanıcı onayı olmadan verilmez. Rotalar bu haliyle tam
// çalışır ve gerçek cihazda test edilebilir; açma kararı tek satırlık değişiklik.
//
// hreflang (alternates.languages) ŞİMDİDEN doğru kurulur ki açma anında yalnız
// robots satırı kalksın; x-default → "/" (mevcut kanonik giriş).
//
// dynamicParams=false ŞART: [lang] kök segmentte — sınırlanmazsa /herhangi-sey
// bu rotaya düşer ve 404 davranışı bozulur. Yalnız 9 kod eşleşir, gerisi 404.
// (Statik rotalar — /giris, /v2, /vakalarim… — Next önceliğiyle zaten kazanır.)
export const dynamicParams = false;

export function generateStaticParams() {
  return LANG_CODES.map((lang) => ({ lang }));
}

const HREFLANG = Object.fromEntries([
  ...LANG_CODES.map((code) => [code, `/${code}`]),
  ["x-default", "/"],
]) as Record<string, string>;

// Metadata metinleri MEVCUT onaylı sözlükten kurulur (yeni kamu metni YOK,
// [[public-claim-honesty]]): başlık = v2.hero.headline ("/" ile aynı konumlandırma,
// taşıma 2026-07-16), açıklama = v2.hero.lede — ikisi de 9 dilde onaylı.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const l = lang as Lang;
  const t = COPY[l];
  // Guard (2026-07-24): dynamicParams=false'a RAĞMEN Next 16 bilinmeyen kodda (/xx)
  // generateMetadata'yı koşuyor → COPY[l] undefined → 500 dönüyordu (v6.17'den beri
  // gizli; v6.34 canlı doğrulamasında yakalandı). Vaat edilen davranış: 404.
  if (!t) notFound();
  const heroLine = t.v2.hero.headline;

  return {
    title: { absolute: `AURA — ${heroLine}` },
    description: t.v2.hero.lede,
    robots: { index: false, follow: true }, // ⚠️ açma = kullanıcı kararı (üstteki not)
    alternates: { canonical: `/${l}`, languages: HREFLANG },
    openGraph: {
      type: "website",
      url: `/${l}`,
      siteName: "AURA",
      title: `AURA — ${heroLine}`,
      description: t.v2.hero.lede,
      locale: OG_LOCALE[l],
      // alternate = TÜM dillerin locale'i − sayfanın kendisi. Hazır OG_ALTERNATE_LOCALES
      // KULLANILAMAZ: o "EN-dışı" listesi — TR sayfasında en_US alternate'ten düşerdi.
      alternateLocale: Object.values(OG_LOCALE).filter((loc) => loc !== OG_LOCALE[l]),
      images: [{ url: "/assets/video/p-hero3.jpg", width: 1280, height: 720, alt: "AURA" }],
    },
  };
}

export default async function LocaleLandingPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!COPY[lang as Lang]) notFound(); // generateMetadata guard'ının eşleniği (bilinmeyen kod = 404)
  // Taşıma (2026-07-16): locale rotaları da YENİ ana sayfayı render eder —
  // /tr eski landing'i gösterip "/" yenisini gösterseydi tutarsız olurdu.
  return <V2Home initialLang={lang as Lang} />;
}
