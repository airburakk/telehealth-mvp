"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { AuraBraille } from "@/components/PortamedLogo";
import { LETTERS, VIDEOS, useLang } from "@/lib/aura-landing/i18n";

// /v2 hero — blueprint Hero'nun marka mesajı ("Care, without borders.") +
// mevcut landing'in MARKA VURUŞU.
//
// ⚠️ v6.14.1 (kullanıcı geri bildirimi): ilk sürümde blueprint'e uyup düz metin
// başlık yazmıştım → "hero olmamış, AURA yazısı vurucu, o olmadan o hissiyatı
// vermiyor". Dev AURA letterform GERİ GELDİ + marka kuralı gereği ALTINA Braille
// ([[aura-braille-under-wordmark]]: Braille daima AURA yazısının tam altında,
// ortalı — sembol altında/tek başına ASLA).
//
// SEMANTİK: letterform role="img" aria-label="AURA" (görsel marka); <h1> =
// "Care, without borders." (blueprint + SEO'nun istediği okunabilir başlık).
// Böylece hem marka vuruşu hem doğru belge başlığı olur.
//
// SKRİM: mevcut landing'in ALT-KOYU/ÜST-AÇIK gradyanı (0.86 → 0.35 → 0.25).
// ⚠️ Düz perde (bg-night/65) KULLANMA — v6.14'te öyleydi ve kullanıcı "video tam
// seçilmiyor, çok karartılmış" dedi. Metin altta okunur, video üstte görünür.
// Kaynak: 1080p "src" (kullanıcı kararı — tam ekranda 720p kalite kaybediyor).
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
        <source src={VIDEOS.hero.src} type="video/mp4" />
      </video>
      {/* Okunurluk skrimi — landing ile aynı: metnin olduğu ALT koyu, video'nun
          göründüğü ÜST açık. Düz perdeye çevirme (video boğulur). */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgba(13,14,16,0.88)_0%,rgba(13,14,16,0.40)_45%,rgba(13,14,16,0.22)_100%)]"
      />

      <div className="relative mx-auto flex min-h-dvh max-w-6xl flex-col items-center justify-center px-5 py-24 text-center md:px-8">
        <p className="aura-mono text-sm text-[var(--aura-accent)]">/ {h.eyebrow}</p>

        {/* Marka vuruşu: dev AURA letterform + TAM ALTINDA ortalı Braille.
            Ölçek landing hero'suyla aynı clamp; Braille dikey grupta ortalanır. */}
        {/* aura-brand: letterform + Braille TEK marka bloğu → ikisi birlikte
            nefes alır (globals.css .aura-brand:hover, aura-breathe). */}
        <div
          role="img"
          aria-label="AURA"
          className="aura-brand mt-6 inline-flex flex-col items-center"
        >
          <span className="aura-word flex select-none items-end justify-center gap-[clamp(0.7rem,3.2vw,2.5rem)]">
            {LETTERS.map((letter) => (
              <img
                key={letter}
                src={`/assets/letters/${letter}.png`}
                alt=""
                aria-hidden
                draggable={false}
                className="h-[clamp(3.5rem,15vw,12rem)] w-auto"
              />
            ))}
          </span>
          {/* v6.14.2 (kullanıcı: "braille'i büyüt"): height 18 → 30 (~140px
              genişlik; letterform genişliğinin ~1/4'ü). Alt sınır 12 —
              AuraBraille height<12'de HİÇ çizmez (v6.9 kuralı, 56px eşiği).
              `aura-braille` sınıfı glow için ŞART (.aura-brand:hover seçicisi). */}
          <AuraBraille
            height={30}
            className="aura-braille mt-5 text-[var(--aura-ink)]"
          />
        </div>

        {/* mt-8 → mt-16 (kullanıcı: "başlığı biraz daha aşağıya it") — marka
            bloğu ile başlık arasında nefes payı. */}
        <h1 className="aura-display mt-16 max-w-4xl text-4xl font-bold leading-[1.05] tracking-tighter text-[var(--aura-ink)] md:text-6xl">
          {h.headline}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-[var(--aura-grey)] md:text-lg">
          {h.lede}
        </p>

        {/* Wireframe: "No more than two equal-priority actions" + birincil CTA
            kaydırmadan görünür. */}
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/giris"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--aura-accent)] px-7 py-3.5 text-base font-semibold text-[var(--aura-night)] transition-transform duration-200 hover:translate-x-0.5 active:scale-[0.98]"
          >
            {h.ctaPrimary}
            <span aria-hidden>→</span>
          </Link>
          <Link
            href="#care"
            className="inline-flex items-center rounded-full border border-[var(--aura-hairline)] bg-[var(--aura-night)]/40 px-7 py-3.5 text-base font-semibold text-[var(--aura-ink)] backdrop-blur-sm transition-colors duration-200 hover:border-[var(--aura-accent)]/60"
          >
            {h.ctaSecondary}
          </Link>
        </div>

        {/* Klinik sorumluluk mikro-metni (v6.8 dürüstlük çizgisi). */}
        <p className="mt-8 max-w-xl text-[13px] leading-relaxed text-[var(--aura-micro)]">
          {h.safety}
        </p>
      </div>
    </section>
  );
}
