import { DOCTORIUM_PALETTE } from "@/components/aura/doctorium-brand";
import { DoctoriumBgVideo } from "@/components/aura/doctorium-bg-video";
import { section } from "@/lib/doctorium-landing/content";
import { Rich } from "../rich-text";
import { Eyebrow } from "../primitives";

// V3 Hero — VİDEO ZEMİNLİ (kullanıcı 2026-08-26: "bundan önce kullandığımız hero videosunu
// arkaya yerleştir"): v1 landing'in arka plan videosu (DoctoriumBgVideo — IO'da oynat,
// Save-Data/reduced-motion'da poster, AI şeffaflık rozeti dahil; video kaynağı film13'ten
// film14'e geçti — bkz. doctorium-bg-video.tsx üstü, 2026-08-27) v1'in skrimiyle birebir
// taşındı. v1 kararı da taşındı: video oynarken sağda ürün kartı
// KALABALIKTI → tek kolon metin, sağ yarı videoya açık ("Bugün sizin için" önizlemesi zaten
// Today bölümünde). Video koyu sahne olduğundan bu bölüm DOCTORIUM_PALETTE ile koyu-metin
// dünyasında yaşar — sayfanın kalan 13 bölümü açık; zemin düz koyu DEĞİL, filmdir.
// LandingSection KULLANILMAZ: bölüm bg'si videoyu örterdi; isolate + kendi section'ı.
//
// 2026-09-04 (kullanıcı kararı): lead'den sonraki CTA çifti + "Doğrulanmış doktor..." notu +
// modül-etiketi satırı (Akademik/İlaç&Cihaz/...) kaldırıldı — mobilde video+H1+lead+2 buton+2
// yazı satırı kalabalık duruyordu. Dönüşüm yolu kaybolmadı: MobileStickyCta zaten `#hero`
// görünürlüğünü izleyip hero ekrandan çıkınca kendi CTA'sını gösteriyor (aşağıda id="hero" hâlâ
// o gözlem için kalıyor). Masaüstünde de aynı nedenle kaldırıldı (mobil/masaüstü ayrı hero
// içeriği YOK — tek JSX, tutarlılık).
export function HeroSection() {
  const copy = section("hero");
  return (
    <section
      id="hero"
      data-section="hero"
      style={DOCTORIUM_PALETTE}
      // bg fallback: poster/video inene dek düz koyu — CSS boyama sırası gereği -z-10 video
      // kendi stacking context'inde (isolate) section zemininin ÜSTÜNE çizilir.
      className="relative isolate overflow-hidden bg-[#0d0e10] text-[var(--dl-ink)] scroll-mt-4 md:scroll-mt-24"
    >
      <DoctoriumBgVideo overlay="linear-gradient(to top, rgba(13,14,16,.93) 0%, rgba(13,14,16,.58) 45%, rgba(13,14,16,.38) 100%)" />
      {/* pb-28→pb-24 mobil (2026-09-04, kullanıcı kararı): CTA/not/etiket satırı kalkınca
          H1+lead altında gereksiz boş video alanı kalmıştı; lg: masaüstünde değişmedi (orada
          zaten dengeliydi). ⚠️ pb-16 denendi ama "Sesi aç" düğmesi (DoctoriumBgVideo, absolute
          bottom-12) lead metninin son satırına bindi — pb-24 ikisi arasında pay bırakır. */}
      <div className="mx-auto w-full max-w-6xl px-5 pb-24 pt-20 lg:pb-40 lg:pt-32">
        {copy.eyebrow && <Eyebrow>{copy.eyebrow}</Eyebrow>}
        <h1 className="mt-5 max-w-[820px] text-[clamp(42px,5.6vw,72px)] font-medium leading-[1.05] tracking-[-0.03em]">
          <Rich text={copy.title} />
        </h1>
        {copy.lead && (
          <p className="mt-7 max-w-[560px] text-[19px] leading-relaxed text-[var(--dl-body)]"><Rich text={copy.lead} /></p>
        )}
      </div>
    </section>
  );
}
