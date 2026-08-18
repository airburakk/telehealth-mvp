"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";
import { AuraBraille } from "@/components/AuraLogo";
import { AuraWordText } from "@/components/aura/aura-word";
import { AiVideoNoticeBadge } from "@/components/AiVideoNotice";
import { LETTERS, VIDEOS, useLang } from "@/lib/aura-landing/i18n";

// Hero — STATİK VİDEO SAHNESİ (2026-08-17, ana sayfa sadeleşmesi; kullanıcı kararı:
// "doctorium'daki gibi bir video hazırlayacağız").
//
// v6.14.4'ün GSAP pin+scrub sahneli açılışı SÜPERSEDE: doctorium-landing hero deseni
// benimsenip scroll-jacking tamamen kalktı — gsap bağımlılığı bu dosyadan çıktı,
// tüm metin SSR'da görünür (fail-open tartışması da bitti: gizlenen bir şey yok).
// Wireframe'in "Avoid scroll-jacking" ilkesine geri dönülmüş oldu.
//
// KORUNANLAR (bozma):
//  · AURA harf lockup'ı + braille (marka kuralı [[aura-braille-under-wordmark]]:
//    wordmark braille'ini TAM ALTINDA taşır).
//  · Video sözleşmesi: IO ile görünürken oyna + arka-plan sekme yaması + Save-Data
//    ve reduced-motion'da hiç başlatma (preload="none" → inmez, poster kalır).
//  · Metinler v2.hero sözlüğünden (9 dil) — h1/CTA değişmedi ⇒ synthetic-checks
//    beklentileri ("Care, without borders" + /giris CTA'sı) yeşil kalır.
//  · Skrim: alt koyu → üst açık (düz perde YAPMA — "video boğuluyor" geri bildirimi).
//
// ⚠️ Kullanıcı yeni hero videosunu hazırlayınca yalnız VIDEOS.hero kaynakları
// değişir (copy.ts) — bu bileşen dokunulmadan kalır.
export function V2Hero() {
  const { t, lang } = useLang();
  const h = t.v2.hero;
  const videoRef = useRef<HTMLVideoElement>(null);

  // Video: mevcut landing hero'suyla aynı sözleşme (IO + arka-plan sekme yaması).
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Save-Data: veri tasarrufu isteğinde video hiç başlatılmaz.
    if (
      "connection" in navigator &&
      (navigator as { connection?: { saveData?: boolean } }).connection?.saveData === true
    )
      return;

    let inView = false;
    const io = new IntersectionObserver(
      (entries) => {
        inView = entries[0]?.isIntersecting ?? false;
        if (inView) void video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.1 },
    );
    io.observe(video);
    const onVis = () => {
      if (document.visibilityState === "visible" && inView) void video.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <section id="top" className="relative isolate min-h-dvh overflow-hidden">
      <video
        ref={videoRef}
        muted
        loop
        playsInline
        preload="none"
        poster={VIDEOS.hero.poster}
        aria-hidden
        className="absolute inset-0 -z-10 h-full w-full object-cover"
      >
        {/* Mobil kaynak (v6.17): telefonda src720 (848KB), masaüstünde 1080p. */}
        <source media="(max-width: 767px)" src={VIDEOS.hero.src720} type="video/mp4" />
        <source src={VIDEOS.hero.src} type="video/mp4" />
      </video>
      {/* Seffaflik beyani (kullanici karari 2026-08-18): hero videosu yapay zeka ile
          uretildi. Tam ekran arka planda videonun bir "alti" yok — gorunur kalan tek
          konum kadrajin sag-alt kosesi. */}
      <AiVideoNoticeBadge lang={lang} />
      {/* Okunurluk skrimi: metnin olduğu ALT koyu, videonun göründüğü ÜST açık. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgba(13,14,16,0.88)_0%,rgba(13,14,16,0.40)_45%,rgba(13,14,16,0.22)_100%)]"
      />

      {/* Sola dayalı düzen (2026-08-18, kullanıcı isteği): /doctorium landing deseni —
          içerik V2Nav'daki logoyla AYNI sol çizgiden akar (ikisi de max-w-6xl px-5
          md:px-8). Braille marka bloğu İÇİNDE wordmark'a göre ortalı kalır (kural). */}
      <div className="relative mx-auto flex min-h-dvh max-w-6xl flex-col items-start justify-center px-5 py-24 md:px-8">
        {/* Marka vuruşu: AURA harfleri + braille — sahnesiz, her zaman görünür. */}
        <div role="img" aria-label="AURA" className="aura-brand inline-flex flex-col items-center">
          <span className="aura-word flex select-none items-end justify-center gap-[clamp(0.7rem,3.2vw,2.5rem)]">
            {LETTERS.map((letter) => (
              <img
                key={letter}
                src={`/assets/letters/${letter}.png`}
                alt=""
                aria-hidden
                draggable={false}
                className="h-[clamp(3rem,12vw,9rem)] w-auto"
              />
            ))}
          </span>
          {/* Alt sınır 12: AuraBraille height<12'de HİÇ çizmez. */}
          <AuraBraille height={24} className="aura-braille mt-4 text-[var(--aura-ink)]" />
        </div>

        <p className="aura-mono mt-12 text-sm text-[var(--aura-accent)]">/ {h.eyebrow}</p>
        <h1 className="aura-display mt-5 max-w-4xl text-4xl font-bold leading-[1.05] tracking-tighter text-[var(--aura-ink)] md:text-6xl">
          {h.headline}
        </h1>
        {/* Metin içi AURA = wordmark görseli (kullanıcı kuralı 2026-08-17, aura-word.tsx). */}
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-[var(--aura-grey)] md:text-lg">
          <AuraWordText text={h.lede} />
        </p>
        {/* CTA giysisi (kullanıcı kararı 2026-08-18): how/closing/doctorium-section'daki
            ORTAK efekt buraya da — kenar şeridi hover'da bandı doldurur (opacity 15), ok
            ileri kayar, düğme sağa ötelenir. Renk düğmeye ait: dolu primary'de şerit
            KOYU (zemin accent — accent şerit görünmezdi, %15 koyu dolgu = hafif kararma);
            kenarlıklı secondary'de şerit accent (closing deseni; eski hover:border-accent
            kalktı — dolgu aynı işi yapıyor, ikisi üst üste binerdi).
            🪤 Dolgu span'i absolute: metin ve ok `relative` olmak ZORUNDA, yoksa altında
            kalır. rtl: varyantları ar/fa için (9 dil yayında). */}
        <div className="mt-8 flex flex-wrap items-center justify-start gap-3">
          <Link
            href="/giris"
            className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-[var(--aura-accent)] px-7 py-3.5 text-base font-semibold text-[var(--aura-night)] transition-transform duration-200 hover:translate-x-1 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aura-accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--aura-bg)] rtl:hover:-translate-x-1"
          >
            <span
              aria-hidden
              className="absolute inset-y-0 start-0 w-1 bg-[var(--aura-night)] transition-all duration-300 group-hover:w-full group-hover:opacity-15"
            />
            <span className="relative">{h.ctaPrimary}</span>
            <ArrowRight
              aria-hidden
              size={18}
              className="relative transition-transform duration-300 group-hover:translate-x-1.5 rtl:rotate-180 rtl:group-hover:-translate-x-1.5"
            />
          </Link>
          {/* Hedef #how (v6.16): etiket "AURA nasıl çalışır?" → 4 adımlık şeride iner. */}
          <Link
            href="#how"
            className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full border border-[var(--aura-hairline)] bg-[var(--aura-night)]/40 px-7 py-3.5 text-base font-semibold text-[var(--aura-ink)] backdrop-blur-sm transition-transform duration-200 hover:translate-x-1 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aura-accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--aura-bg)] rtl:hover:-translate-x-1"
          >
            <span
              aria-hidden
              className="absolute inset-y-0 start-0 w-1 bg-[var(--aura-accent)] transition-all duration-300 group-hover:w-full group-hover:opacity-15"
            />
            <span className="relative">
              <AuraWordText text={h.ctaSecondary} />
            </span>
            <ArrowRight
              aria-hidden
              size={16}
              className="relative text-[var(--aura-accent)] transition-transform duration-300 group-hover:translate-x-1.5 rtl:rotate-180 rtl:group-hover:-translate-x-1.5"
            />
          </Link>
        </div>
        {/* Klinik sorumluluk mikro-metni (v6.8 dürüstlük çizgisi). */}
        <p className="mt-7 max-w-xl text-[13px] leading-relaxed text-[var(--aura-micro)]">
          <AuraWordText text={h.safety} />
        </p>
      </div>
    </section>
  );
}
