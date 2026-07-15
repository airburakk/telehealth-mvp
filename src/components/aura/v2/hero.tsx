"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { VIDEOS, useLang } from "@/lib/aura-landing/i18n";

// /v2 hero — blueprint Hero (marka mesajı "Care, without borders.").
//
// Blueprint hero medyasını boş bir <div aria-hidden> olarak bırakmıştı (kendi
// ifadesiyle "intentionally avoids video implementation details"); wireframe §1
// ise "current cinematic video can remain" diyor → mevcut hero videosu taşındı.
// Kinetik letterform (gsap) BURAYA ALINMADI: blueprint hero'da AURA letterform'u
// değil METİN başlık istiyor ("Care, without borders." okunabilir olmalı) ve
// letterform ölçüm tuzağı taşıyor (v6.13: wordAfter ~9-12px kopuk).
//
// Kaynak seçimi: 1080p "src" — tam genişlik ana ekran (landing hero'su ile aynı
// kullanıcı kararı; 720p tam ekranda kalite kaybediyordu).
// REDUCED-MOTION: video oynatılmaz, poster kalır.
export function V2Hero() {
  const { t } = useLang();
  const h = t.v2.hero;
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

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
    // Arka plan sekmesinde mount-play reddedilir ve hero hep kesişimde kaldığı
    // için IO bir daha ateşlemez → görünür olunca yeniden dene (hero.tsx tuzağı).
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
    <section className="relative isolate flex min-h-dvh items-center overflow-hidden">
      <video
        ref={videoRef}
        src={VIDEOS.hero.src}
        poster={VIDEOS.hero.poster}
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden
        className="absolute inset-0 -z-10 h-full w-full object-cover"
      />
      {/* Okunabilirlik perdesi — hero metni videonun üstünde AA'yı tutsun. */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-[var(--aura-night)]/65" />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-b from-[var(--aura-night)]/80 via-transparent to-[var(--aura-night)]"
      />

      <div className="mx-auto w-full max-w-6xl px-5 py-28 md:px-8">
        <p className="aura-mono text-sm text-[var(--aura-accent)]">/ {h.eyebrow}</p>
        <h1 className="aura-display mt-5 max-w-4xl text-5xl font-bold leading-[1.05] tracking-tighter text-[var(--aura-ink)] md:text-7xl">
          {h.headline}
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-[var(--aura-grey)] md:text-lg">
          {h.lede}
        </p>

        {/* Wireframe: "No more than two equal-priority actions" + birincil CTA
            kaydırmadan görünür. */}
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            href="/giris"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--aura-accent)] px-7 py-3.5 text-base font-semibold text-[var(--aura-night)] transition-transform duration-200 hover:translate-x-0.5 active:scale-[0.98]"
          >
            {h.ctaPrimary}
            <span aria-hidden>→</span>
          </Link>
          <Link
            href="#how"
            className="inline-flex items-center rounded-full border border-[var(--aura-hairline)] px-7 py-3.5 text-base font-semibold text-[var(--aura-ink)] transition-colors duration-200 hover:border-[var(--aura-accent)]/60"
          >
            {h.ctaSecondary}
          </Link>
        </div>

        {/* Klinik sorumluluk mikro-metni (v6.8 dürüstlük çizgisi) — CTA'nın
            hemen altında, wireframe §1 gereği. */}
        <p className="mt-8 max-w-xl text-[13px] leading-relaxed text-[var(--aura-micro)]">
          {h.safety}
        </p>
      </div>
    </section>
  );
}
