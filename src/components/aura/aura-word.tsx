import { Fragment } from "react";

// Metin içi AURA wordmark kuralı (kullanıcı kararı 2026-08-17, ana sayfa):
// "AURA" geçen her görünür metinde kelime düz yazıyla DEĞİL, logodaki yazımıyla
// (gerçek wordmark PNG'si) geçer — doctorium-landing'deki ByAura deseninin
// site-geneli eşleniği. Kullanım: <AuraWordText text={t...} /> — metni "AURA"
// geçişlerinden böler, araya wordmark görselini dizer; "AURA'nın" gibi ekler
// bölmeden sonra düz metin olarak kalır (görsel + "'nın").
//
// AÇIK/KOYU otomatik: iki varyant birden render edilir, hangisinin görüneceğini
// globals.css seçer (.aura-light kapsamında light varyant). Böylece bileşene
// tema prop'u taşınmaz — almaşık ritimde bölüm nereye taşınırsa taşınsın doğru
// varyant görünür (display:none olan ekran okuyucuya da okunmaz → çift okuma yok).
//
// Boyut ByAura sözleşmesiyle aynı: h-[0.95em] + align-[-0.12em] — kullanıldığı
// puntoya em ile ölçeklenir.
//
// ⚠️ Braille kuralı ([[aura-braille-under-wordmark]]) BURAYA UYGULANMAZ: kural
// marka lockup'ları (logo sunumu) içindir; metin içi geçişler doctorium'daki
// ByAura emsalinde de braille'siz. Footer'daki bağımsız lockup braille taşımaya
// devam eder.
export function AuraInlineWord({ className = "" }: { className?: string }) {
  return (
    <span className={`whitespace-nowrap ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/aura-word-dark.png"
        alt="AURA"
        className="aura-word-inline-dark inline-block h-[0.95em] w-auto align-[-0.12em]"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/aura-word-light.png"
        alt="AURA"
        className="aura-word-inline-light inline-block h-[0.95em] w-auto align-[-0.12em]"
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
