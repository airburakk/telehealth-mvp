"use client";

import { useEffect, useRef } from "react";

// /doctorium arka plan videosu (deneme, 2026-08-16) — v2 hero sözleşmesinin taşıması:
// IO ile yalnız görünürken oynat · arka plan sekmesinde mount-play reddedilir →
// visibilitychange'te yeniden dene · Save-Data ve reduced-motion'da HİÇ başlatma
// (preload="none" → play edilmeyen video inmez, poster kalır). Kaynak UZUN FİLM
// (film7: 34.3 sn, 2026-08-17 ikinci revizyon — [1] ara sahne YENİDEN: doktor hiç
// görünmez, beyaz önlüklü EL laptop kapağını açar, ekranda GERÇEK /doctorium sayfası
// [Playwright screenshot → seedance omni_reference; gerçek lockup+AuraMark] — film6'nın
// "kafasına göre logo"lu doktorlu sahnesi süpersede; [2] adliye YENİDEN: FPV "oyun gibi"
// eleştirisi → insanlı gerçek adliye koridoru (cübbeli avukatlar), "ARŞİV" tabelalı kapı
// [Ş'yi model doğru bastı], raflar dolusu dosyanın dijitalleşmesi. Ad-vers. film6→film7).
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
        poster="/assets/video/p-doctorium-film7.jpg"
        aria-hidden
        className="absolute inset-0 -z-10 h-full w-full object-cover"
      >
        <source src="/assets/video/v-doctorium-film7-720.mp4" type="video/mp4" />
      </video>
      <div aria-hidden className="absolute inset-0 -z-10" style={{ background: overlay }} />
    </>
  );
}
