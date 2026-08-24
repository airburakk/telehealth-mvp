import { Fragment } from "react";
import { AuraWordSvg } from "@/components/AuraLogo";

// Metin içi AURA wordmark kuralı (kullanıcı kararı 2026-08-17, ana sayfa):
// "AURA" geçen her görünür metinde kelime düz yazıyla DEĞİL, logodaki yazımıyla
// (gerçek wordmark) geçer — doctorium-landing'deki ByAura deseninin site-geneli
// eşleniği. Kullanım: <AuraWordText text={t...} /> — metni "AURA" geçişlerinden
// böler, araya wordmark'ı dizer; "AURA'nın" gibi ekler bölmeden sonra düz metin
// olarak kalır (görsel + "'nın").
//
// v6.137 (2026-08-23): PNG çifti (dark/light) yerine VEKTÖR wordmark (AuraWordSvg).
// AÇIK/KOYU otomatik: tek eleman, rengi globals.css `.aura-word-inline` seçer
// (varsayılan beyaz; `.aura-light` kapsamında lacivert) — bileşene tema prop'u
// taşınmaz, almaşık ritimde bölüm nereye taşınırsa taşınsın doğru renk.
//
// Boyut ByAura sözleşmesiyle aynı görsel büyüklük: eski h-[0.95em] PNG-canvas →
// vektörde h-[0.6em] (harf sınırına kırpık viewBox; çarpan AURA_WORD_FROM_PNG_HEIGHT).
// align: A tabanı kutunun 1,3% üstünde (U taşması) → -0.02em ≈ metin taban çizgisi.
//
// ⚠️ Braille kuralı ([[aura-braille-under-wordmark]]) BURAYA UYGULANMAZ: kural
// marka lockup'ları (logo sunumu) içindir; metin içi geçişler braille'siz.
export function AuraInlineWord({ className = "" }: { className?: string }) {
  return (
    <span className={`whitespace-nowrap ${className}`}>
      <AuraWordSvg
        className="aura-word-inline inline-block h-[0.6em] w-auto align-[-0.02em]"
        style={{ display: "inline-block" }}
      />
    </span>
  );
}

export function AuraWordText({ text }: { text: string }) {
  const parts = text.split("AURA");
  if (parts.length === 1) return <>{text}</>;
  return (
    // Bölünmüş çıktı TEK span'de kalmalı: Fragment dönerse flex ebeveynde
    // (örn. hero'daki inline-flex CTA) her parça ayrı flex item olur ve item
    // sınırındaki boşluklar düşer → wordmark metne yapışır ("AURAnasıl çalışır").
    <span>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && <AuraInlineWord />}
          {part}
        </Fragment>
      ))}
    </span>
  );
}
