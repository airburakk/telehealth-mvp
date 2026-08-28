"use client";

import { useEffect, useRef, useState } from "react";
import { AiVideoNoticeBadge } from "@/components/AiVideoNotice";

// /doctorium arka plan videosu — v2 hero sözleşmesinin taşıması: IO ile yalnız
// görünürken oynat · arka plan sekmesinde mount-play reddedilir → visibilitychange'te
// yeniden dene · mobil/Save-Data/reduced-motion'da video HİÇ MOUNT EDİLMEZ (yalnız
// statik poster gösterilir — DOM'da <source> bile yok, "preload=none" güvencesinden
// daha güçlü: hiçbir istek gitmez). `overlay` = üstteki okunurluk skrimi: koyu
// bölümde koyu gradient, açık bölümde beyaz perde — çağıran bölümün temasına göre
// verilir. Kapsayıcı bölümde `relative isolate` ŞART (-z-10 katmanları bölüm köküne
// gömülür). Film geçmişi (film8→film13, sahne-anchor tuzakları dahil): git geçmişi.
//
// film14 (2026-08-27, kullanıcı onaylı marka filmi — VO+müzik dahil, 44.15sn): film13'ün
// yerini aldı. Önceki sahne-anchor hack'i (belirli bir zaman aralığında objectPosition
// değiştirme) film13'e ÖZGÜYDÜ, film14'te yok — kaldırıldı.
//
// 2026-08-28 denetimi: "Sesi aç" düğmesi kaldırıldı (arka plan videosu için gereksiz dikkat
// çekiyordu, mobilde AI-rozeti/sticky-CTA ile yarışıyordu) — video artık DAİMA sessiz.
// Aynı turda mobil/reduced-motion/save-data'da video mount edilmeyip poster'a düşme +
// object-position eklendi (poster'daki küre/wordmark odağı dikeyde ~%38 — FOCAL sabiti).
export function DoctoriumBgVideo({ overlay }: { overlay: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showVideo, setShowVideo] = useState(false);

  // Karar: mobil (dar ekran) ya da reduced-motion ya da save-data → video hiç mount edilmez.
  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 767px)").matches;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData =
      "connection" in navigator &&
      (navigator as { connection?: { saveData?: boolean } }).connection?.saveData === true;
    if (narrow || reduceMotion || saveData) return;
    setShowVideo(true);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !showVideo) return;

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
  }, [showVideo]);

  return (
    <>
      {showVideo ? (
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          preload="none"
          poster={POSTER}
          aria-hidden
          className="absolute inset-0 -z-10 h-full w-full object-cover"
          style={{ objectPosition: FOCAL }}
        >
          <source src="/assets/video/v-doctorium-film14-720.mp4" type="video/mp4" />
        </video>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- absolute fill zemin görseli; video poster'ıyla birebir aynı statik asset
        <img
          src={POSTER}
          alt=""
          aria-hidden
          className="absolute inset-0 -z-10 h-full w-full object-cover"
          style={{ objectPosition: FOCAL }}
        />
      )}
      <div aria-hidden className="absolute inset-0 -z-10" style={{ background: overlay }} />
      {/* Seffaflik beyani (kullanici karari 2026-08-18). Doctorium yuzeyi tek dil TR. */}
      <AiVideoNoticeBadge lang="tr" />
    </>
  );
}

const POSTER = "/assets/video/p-doctorium-film14.jpg";
// Küre/wordmark odağı posterde dikeyde ~%38 (üst-orta) — mobilde dar/uzun kırpmada
// odağın alta kaymaması için hem video hem poster-fallback aynı object-position'ı kullanır.
const FOCAL = "50% 38%";
