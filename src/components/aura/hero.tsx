"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { LETTERS, useLang, VIDEOS } from "@/lib/aura-landing/i18n";

// Hero v2: tam ekran gece Bogaz videosu (sessiz dongu + poster) uzerinde dev
// kinetik "AURA" tipografisi. Harfler mount'ta 3B silindirden yuvarlanarak
// acilir (rotateX), scroll'da sahne yukari suzulur. SSR'da tam metin + poster
// render edilir (screenshot-safe); reduced-motion'da video oynamaz, animasyon
// yok.
export function AuraHero() {
  const { t } = useLang();
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const video = videoRef.current;

    // Video: reduced-motion disinda sessiz dongu; sekme gorunur degilken durur.
    let io: IntersectionObserver | undefined;
    let onVis: (() => void) | undefined;
    if (video && !reduced) {
      let inView = false;
      io = new IntersectionObserver(
        (entries) => {
          inView = entries[0]?.isIntersecting ?? false;
          if (inView) void video.play().catch(() => {});
          else video.pause();
        },
        { threshold: 0.1 },
      );
      io.observe(video);
      // Arka plan sekmesinde acilan sayfada mount-play ertelenir/reddedilir ve
      // hero hep kesisimde kaldigi icin IO bir daha ateslemez → sekme gorunur
      // olunca gorunumdeki videoyu yeniden dene (yoksa poster'da kalir).
      onVis = () => {
        if (document.visibilityState === "visible" && inView) {
          void video.play().catch(() => {});
        }
      };
      document.addEventListener("visibilitychange", onVis);
    }

    if (reduced)
      return () => {
        io?.disconnect();
        if (onVis) document.removeEventListener("visibilitychange", onVis);
      };

    let undo: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      const [gsapMod, stMod] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (cancelled) return;
      const gsap = gsapMod.gsap;
      gsap.registerPlugin(stMod.ScrollTrigger);

      const ctx = gsap.context(() => {
        // Kinetik acilis: AURA harfleri silindirden yuvarlanir.
        gsap.from("[data-hero-char]", {
          rotateX: -95,
          yPercent: 40,
          opacity: 0,
          transformOrigin: "50% 100% -40px",
          stagger: 0.06,
          duration: 1.1,
          ease: "power3.out",
          delay: 0.15,
        });
        gsap.from("[data-hero-line]", {
          yPercent: 70,
          opacity: 0,
          stagger: 0.12,
          duration: 0.9,
          ease: "power3.out",
          delay: 0.6,
        });

        // Scroll cikisi: icerik hafifce yukari ve derine (yalniz transform).
        gsap.to("[data-hero-content]", {
          yPercent: -18,
          scale: 0.96,
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top top",
            end: "bottom top",
            scrub: 0.8,
          },
        });
      }, sectionRef);
      undo = () => ctx.revert();
    })();

    return () => {
      cancelled = true;
      io?.disconnect();
      if (onVis) document.removeEventListener("visibilitychange", onVis);
      undo?.();
    };
  }, []);

  return (
    <section id="top" ref={sectionRef} className="relative min-h-dvh overflow-hidden">
      {/* Video katmani */}
      {/* Hero KASITLI 1080p orijinal (kullanici karari 2026-07-12): ana ekran
          tam-genislik cizildigi icin 720p kopya gozle gorulur kalite kaybetti
          — "ilk izlenim" sahnesi agirliga (11.45 MB) tercih edildi. Chapter/
          giris yuzeyleri 720p'de kalir. preload="none"+IO korunur (oynatma
          aninda iner; arka-plan-sekme yamasi visibilitychange'te). */}
      <video
        ref={videoRef}
        muted
        loop
        playsInline
        preload="none"
        poster={VIDEOS.hero.poster}
        className="absolute inset-0 h-full w-full object-cover"
        aria-hidden
      >
        <source src={VIDEOS.hero.src} type="video/mp4" />
      </video>
      {/* Okunurluk skrimi */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(to_top,rgba(13,14,16,0.86)_0%,rgba(13,14,16,0.35)_40%,rgba(13,14,16,0.25)_100%)]"
      />

      <div
        data-hero-content
        className="aura-roll-stage relative mx-auto flex min-h-dvh max-w-6xl flex-col items-center justify-center px-5 pt-16 text-center"
      >
        {/* Dev AURA: kullanicinin logo letterform'u (beyaz dilim PNG'leri,
            yatayda siki kirpilmis "-t" kesimler) — harf harf 3B roll korunur;
            aralik gap ile kontrollu, hover'da turkuaz aura isimasi. */}
        <h1
          aria-label={t.hero.word}
          className="aura-word flex select-none items-end justify-center gap-[clamp(0.7rem,3.2vw,2.5rem)]"
        >
          {LETTERS.map((letter, i) => (
            <img
              key={i}
              data-hero-char
              aria-hidden
              src={`/assets/letters/${letter}.png`}
              alt=""
              draggable={false}
              className="h-[clamp(3.5rem,15vw,12rem)] w-auto will-change-transform"
            />
          ))}
        </h1>
        <p className="aura-display mt-2 text-3xl font-bold leading-tight tracking-tighter md:text-5xl">
          <span className="block overflow-hidden">
            {/* Iki marka ayagi logo turkuazinda */}
            <span data-hero-line className="block">
              <span className="text-[var(--aura-accent)]">{t.hero.l1.a}</span>
              {t.hero.l1.mid}
              <span className="text-[var(--aura-accent)]">{t.hero.l1.b}</span>
              {t.hero.l1.tail}
            </span>
          </span>
          <span className="block overflow-hidden">
            <span data-hero-line className="block">
              {t.hero.line2}
            </span>
          </span>
        </p>
        <div className="mt-9">
          <SeeDoctorCta label={t.hero.cta} />
        </div>
      </div>

      {/* Mono sahne sayaci */}
      <p className="aura-mono absolute bottom-6 left-5 text-[12px] text-[var(--aura-grey)] md:left-8">
        {t.hero.scenes}
      </p>
    </section>
  );
}

// Hero CTA giysisi: turkuaz murekkep blogu; hover'da blok hafif 3B yatar
// (rotateX) ve ok asagi kayar — sayfada baska hicbir CTA bu bicimi paylasmaz.
function SeeDoctorCta({ label }: { label: string }) {
  return (
    <Link
      href="/giris"
      className="group inline-flex items-center gap-3 rounded-lg bg-[var(--aura-accent)] px-7 py-3.5 text-base font-semibold text-[var(--aura-bg)] transition-transform duration-200 [transform-style:preserve-3d] hover:[transform:rotateX(14deg)] active:scale-[0.98]"
    >
      {label}
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className="h-4 w-4 transition-transform duration-300 group-hover:translate-y-0.5 group-hover:translate-x-1"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M2 8h10M8 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}
