"use client";

import { useEffect, useRef, useState } from "react";
import { AiVideoNoticeBadge } from "@/components/AiVideoNotice";

// /doctorium arka plan videosu — v2 hero sözleşmesinin taşıması: IO ile yalnız
// görünürken oynat · arka plan sekmesinde mount-play reddedilir → visibilitychange'te
// yeniden dene · Save-Data ve reduced-motion'da HİÇ başlatma (preload="none" → play
// edilmeyen video inmez, poster kalır). `overlay` = üstteki okunurluk skrimi: koyu
// bölümde koyu gradient, açık bölümde beyaz perde — çağıran bölümün temasına göre
// verilir. Kapsayıcı bölümde `relative isolate` ŞART (-z-10 katmanları bölüm köküne
// gömülür). Film geçmişi (film8→film13, sahne-anchor tuzakları dahil): git geçmişi.
//
// film14 (2026-08-27, kullanıcı onaylı marka filmi — VO+müzik dahil, 44.15sn): film13'ün
// yerini aldı. Önceki sahne-anchor hack'i (belirli bir zaman aralığında objectPosition
// değiştirme) film13'e ÖZGÜYDÜ, film14'te yok — kaldırıldı. Otomatik oynatma tarayıcı
// kuralı gereği DAİMA sessiz başlar (`muted` olmadan autoplay reddedilir); film14
// anlatım+müzik taşıdığı için kullanıcı SES AÇ/KAPA düğmesiyle sesi kendi açar.
export function DoctoriumBgVideo({ overlay }: { overlay: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [soundOn, setSoundOn] = useState(false);

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

  const toggleSound = () => {
    const video = videoRef.current;
    if (!video) return;
    const next = video.muted;
    video.muted = !next;
    setSoundOn(video.muted === false);
  };

  return (
    <>
      <video
        ref={videoRef}
        muted
        loop
        playsInline
        preload="none"
        poster="/assets/video/p-doctorium-film14.jpg"
        aria-hidden
        className="absolute inset-0 -z-10 h-full w-full object-cover"
      >
        <source src="/assets/video/v-doctorium-film14-720.mp4" type="video/mp4" />
      </video>
      <div aria-hidden className="absolute inset-0 -z-10" style={{ background: overlay }} />
      <button
        type="button"
        onClick={toggleSound}
        aria-label={soundOn ? "Sesi kapat" : "Sesi aç"}
        className="absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded-full border border-white/15 bg-black/55 px-3.5 py-2 text-[12px] font-medium text-white backdrop-blur-sm transition hover:bg-black/70"
      >
        {soundOn ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M18.5 5.5a9 9 0 0 1 0 13" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        )}
        {soundOn ? "Sesi kapat" : "Sesi aç"}
      </button>
      {/* Seffaflik beyani (kullanici karari 2026-08-18). Doctorium yuzeyi tek dil TR. */}
      <AiVideoNoticeBadge lang="tr" />
    </>
  );
}
