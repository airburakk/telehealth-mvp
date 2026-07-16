"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { AuraBraille } from "@/components/PortamedLogo";
import { LETTERS, VIDEOS, useLang } from "@/lib/aura-landing/i18n";

// /v2 hero — SAHNELİ AÇILIŞ (v6.14.4, kullanıcı kararı):
// "başta yalnızca AURA ve braille olsun, aşağıya kaydırdıkça yazılar gelsin ama
//  hâlâ hero'da kalalım; tüm yazılar geldikten sonra bir sonraki sahneye geçelim"
// ⇒ ScrollTrigger PIN + SCRUB: hero ekranda sabitlenir, scroll ilerledikçe metin
// parçaları sırayla belirir; timeline bitince pin çözülür ve sayfa akar.
//
// ⚠️ BİLİNÇLİ ÇELİŞKİ: wireframe "Avoid scroll-jacking" diyor; bu desen tam
// olarak odur. Kullanıcı kararı (2026-07-16) — gerekçe: hero "çok kalabalık"tı,
// marka vuruşu metin yığınında kayboluyordu. Zararı a11y kollarıyla sınırlandı:
//
// A11Y/SEO SÖZLEŞMESİ (bozma):
//  · reduced-motion → pin/scrub HİÇ kurulmaz, tüm metin görünür, normal scroll.
//  · Metinler SSR'da DOM'da ve okunur; gizleme yalnız mount SONRASI gsap.set ile
//    (JS yoksa/hata alırsa içerik görünür kalır — fail-open, SEO güvenli).
//  · Pin sırasında klavye Tab çalışır; hero zaten ekranda olduğu için focus
//    kaybolmaz. Metin parçaları opacity ile gelir, DOM'dan çıkmaz.
export function V2Hero() {
  const { t } = useLang();
  const h = t.v2.hero;
  const videoRef = useRef<HTMLVideoElement>(null);
  const sectionRef = useRef<HTMLElement>(null);

  // Video: mevcut landing hero'suyla aynı sözleşme (IO + arka-plan sekme yaması).
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Save-Data (v6.17): veri tasarrufu isteginde video hic baslatilmaz
    // (preload="none" → play edilmeyen video inmez, poster kalir). Kok hero ile ayni.
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

  // Sahneli açılış: pin + scrub timeline.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const section = sectionRef.current;
    if (!section) return;

    let ctx: { revert: () => void } | undefined;
    let cancelled = false;

    void (async () => {
      const [gsapMod, stMod] = await Promise.all([import("gsap"), import("gsap/ScrollTrigger")]);
      if (cancelled) return;
      const gsap = gsapMod.gsap;
      gsap.registerPlugin(stMod.ScrollTrigger);

      ctx = gsap.context(() => {
        const steps = gsap.utils.toArray<HTMLElement>("[data-hero-step]");
        // Mount SONRASI gizle → SSR/JS-siz durumda metin görünür kalır.
        gsap.set(steps, { opacity: 0, y: 20 });

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: "top top",
            // ⚠️ TOPLAM pin süresi — adım BAŞINA değil (v6.14.6).
            // v6.14.4'te `adım×55+40` yazmıştım = ~315vh ≈ ekranın 3 katı →
            // kullanıcı: "scroll jacking çok olmuş, bir kez scroll yaptığımda
            // direkt yazılar gelsin; mobilde 3 kez kaydırmam gerekiyor".
            // v6.14.7: stagger sıfırlandı (kullanıcı: "tek yeter") → tüm metin
            // TEK hamlede gelir ⇒ pin de kısaldı: 55% → 30% (~1 kaydırma).
            // Adım sayısı artarsa burayı ÇARPMA.
            end: "+=30%",
            pin: true,
            pinSpacing: true,
            scrub: 0.4, // düşük = kaydırmaya çevik yanıt (0.8 gecikmeli hissettiriyordu)
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });
        // Kullanıcı kararı (v6.14.7): stagger YOK — eyebrow/h1/lede/CTA/not
        // hepsi AYNI ANDA belirir. Sıralı akış "bir kez scroll = yazılar gelsin"
        // isteğini geciktiriyordu. Geri eklenecekse pin süresini de büyüt.
        tl.to(steps, { opacity: 1, y: 0, duration: 1, ease: "power2.out" });
      }, section);
    })();

    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, [t]);

  return (
    <section ref={sectionRef} id="top" className="relative isolate min-h-dvh overflow-hidden">
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
        {/* Mobil kaynak (v6.17): telefonda src720 (848KB), masaustunde 1080p
            kullanici karari korunur — gerekce kok hero.tsx'te. */}
        <source media="(max-width: 767px)" src={VIDEOS.hero.src720} type="video/mp4" />
        <source src={VIDEOS.hero.src} type="video/mp4" />
      </video>
      {/* Okunurluk skrimi: metnin olduğu ALT koyu, videonun göründüğü ÜST açık.
          Düz perdeye çevirme — v6.14'te öyleydi, "video boğuluyor" geri bildirimi. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgba(13,14,16,0.88)_0%,rgba(13,14,16,0.40)_45%,rgba(13,14,16,0.22)_100%)]"
      />

      <div className="relative mx-auto flex min-h-dvh max-w-6xl flex-col items-center justify-center px-5 py-24 text-center md:px-8">
        {/* SAHNE 0 — açılışta YALNIZ bunlar görünür (kullanıcı: "başta yalnızca
            AURA ve braille olsun"). data-hero-step YOK: hiç gizlenmez. */}
        <div role="img" aria-label="AURA" className="aura-brand inline-flex flex-col items-center">
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
          {/* height=30 → 140px. Alt sınır 12: AuraBraille height<12'de HİÇ çizmez. */}
          <AuraBraille height={30} className="aura-braille mt-5 text-[var(--aura-ink)]" />
        </div>

        {/* SAHNE 1..n — scroll ilerledikçe sırayla belirir. */}
        <p data-hero-step className="aura-mono mt-14 text-sm text-[var(--aura-accent)]">
          / {h.eyebrow}
        </p>
        <h1
          data-hero-step
          className="aura-display mt-5 max-w-4xl text-4xl font-bold leading-[1.05] tracking-tighter text-[var(--aura-ink)] md:text-6xl"
        >
          {h.headline}
        </h1>
        <p
          data-hero-step
          className="mt-5 max-w-2xl text-base leading-relaxed text-[var(--aura-grey)] md:text-lg"
        >
          {h.lede}
        </p>
        <div data-hero-step className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/giris"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--aura-accent)] px-7 py-3.5 text-base font-semibold text-[var(--aura-night)] transition-transform duration-200 hover:translate-x-0.5 active:scale-[0.98]"
          >
            {h.ctaPrimary}
            <span aria-hidden>→</span>
          </Link>
          {/* Hedef #how (v6.16 düzeltmesi): etiket "AURA nasıl çalışır?" diyor →
              4 adımlık "nasıl çalışır" şeridine iner. Önce #care'e (dört giriş
              kapısı) gidiyordu = etiketle hedef çelişiyordu. #care'e giden yol
              kapanmadı: nav'ın "Bakım" sekmesi ve doğal kaydırma sırası aynı. */}
          <Link
            href="#how"
            className="inline-flex items-center rounded-full border border-[var(--aura-hairline)] bg-[var(--aura-night)]/40 px-7 py-3.5 text-base font-semibold text-[var(--aura-ink)] backdrop-blur-sm transition-colors duration-200 hover:border-[var(--aura-accent)]/60"
          >
            {h.ctaSecondary}
          </Link>
        </div>
        {/* Klinik sorumluluk mikro-metni (v6.8 dürüstlük çizgisi) — son sahne. */}
        <p data-hero-step className="mt-7 max-w-xl text-[13px] leading-relaxed text-[var(--aura-micro)]">
          {h.safety}
        </p>
      </div>
    </section>
  );
}
