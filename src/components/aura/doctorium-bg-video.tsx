"use client";

import { useEffect, useRef } from "react";

// /doctorium arka plan videosu (deneme, 2026-08-16) — v2 hero sözleşmesinin taşıması:
// IO ile yalnız görünürken oynat · arka plan sekmesinde mount-play reddedilir →
// visibilitychange'te yeniden dene · Save-Data ve reduced-motion'da HİÇ başlatma
// (preload="none" → play edilmeyen video inmez, poster kalır). Kaynak UZUN FİLM
// (film8: 36.5 sn, 2026-08-17 üçüncü revizyon — [1] ofis sahnesi: OTURAN önlüklü/gözlüklü
// doktor + BÜYÜK MASAÜSTÜ monitör (gözlük yansımasının 5 sn öncesi kuruldu), cam cepheli
// modern hastane ofisi gece-şehir bokeh'iyle koridor planının dünyasında; ekranda gerçek
// sayfa + SOL ÜSTTE BÜYÜK dönen zümrüt amblem = ışığın kaynağı [referans screenshot'ta
// header AuraMark 3.2x büyütüldü]; [2] adliye: beğenilen adalet sarayı CEPHE dalışı
// (court3[0:2.3]) geri geldi + koridor ABD-adliyesi araştırmasıyla yeniden [takım elbiseli
// cübbesiz avukatlar, bankta bekleyen aileler, güvenlik görevlisi, ARŞİV tabelası] +
// raf dijitalizasyonu. Ad-vers. film7→film8).
// `overlay` = üstteki okunurluk skrimi: koyu bölümde koyu gradient, açık bölümde
// beyaz perde — çağıran bölümün temasına göre verilir. Kapsayıcı bölümde
// `relative isolate` ŞART (-z-10 katmanları bölüm köküne gömülür).
export function DoctoriumBgVideo({ overlay }: { overlay: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
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
    <>
      <video
        ref={videoRef}
        muted
        loop
        playsInline
        preload="none"
        poster="/assets/video/p-doctorium-film8.jpg"
        aria-hidden
        className="absolute inset-0 -z-10 h-full w-full object-cover"
      >
        <source src="/assets/video/v-doctorium-film8-720.mp4" type="video/mp4" />
      </video>
      <div aria-hidden className="absolute inset-0 -z-10" style={{ background: overlay }} />
    </>
  );
}
