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
// 2026-08-28 denetimi: "Sesi aç" düğmesi kaldırılmıştı (mobilde AI-rozeti/sticky-CTA ile
// yarışıyordu). Aynı turda mobil/reduced-motion/save-data'da video mount edilmeyip poster'a
// düşme + object-position eklendi (poster'daki küre/wordmark odağı dikeyde ~%38 — FOCAL).
//
// 2026-08-29 (kullanıcı kararı): düğme GERİ GELDİ, bu kez SAĞ ALTTA. Denetimin itirazı iki
// yönden karşılandı: (a) düğme yalnız video gerçekten mount edildiğinde render edilir →
// mobilde/reduced-motion'da hiç yok, sticky-CTA ile yarışma ihtimali ortadan kalktı;
// (b) AI şeffaflık rozeti de sağ-alt köşede (bottom-3 right-3) olduğu için düğme onun
// ÜSTÜNE istiflenir (bottom-12) — köşede tek dikey yığın, çakışma yok. Rozetin konumu
// BEYAN olduğu için dokunulmadı; kayacak olan düğmedir.
//
// `muted` React'e bırakıldı (muted={!soundOn}), imperative `video.muted = …` DEĞİL: prop
// sabit true iken DOM'u elle değiştirmek React'in bir sonraki render'ıyla sessizce geri
// alınabilir. Autoplay sözleşmesi korunur — soundOn başlangıçta false → ilk mount muted.
export function DoctoriumBgVideo({ overlay }: { overlay: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showVideo, setShowVideo] = useState(false);
  const [soundOn, setSoundOn] = useState(false);

  // Karar: mobil (dar ekran) ya da reduced-motion ya da save-data → video hiç mount edilmez.
  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 767px)").matches;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData =
      "connection" in navigator &&
      (navigator as { connection?: { saveData?: boolean } }).connection?.saveData === true;
    if (narrow || reduceMotion || saveData) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR/prerender'da matchMedia yok → ilk render güvenli varsayılanla, gerçek değer mount'ta bir kez okunur (deps [], cascading yok).
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
          muted={!soundOn}
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
      {/* Ses aç/kapa — YALNIZ video mount edildiyse (poster hâlinde oynatılacak ses yok).
          Sağ-alt köşede AI rozetinin üstünde: bottom-12 = rozetin (bottom-3 + ~22px) üstünden
          ~14px boşluk. Görünür metin etiketin kendisidir → ayrıca aria-label VERİLMEZ
          (aria-label görünür adı ezer; ikisi birebir tutulmazsa "label in name" kırılır). */}
      {showVideo && (
        <button
          type="button"
          onClick={() => setSoundOn((on) => !on)}
          aria-pressed={soundOn}
          className="absolute bottom-12 right-3 z-10 flex items-center gap-2 rounded-full border border-white/15 bg-black/55 px-3.5 py-2 text-[12px] font-medium text-white backdrop-blur-sm transition hover:bg-black/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
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
      )}
      {/* Seffaflik beyani (kullanici karari 2026-08-18). Doctorium yuzeyi tek dil TR. */}
      <AiVideoNoticeBadge lang="tr" />
    </>
  );
}

const POSTER = "/assets/video/p-doctorium-film14.jpg";
// Küre/wordmark odağı posterde dikeyde ~%38 (üst-orta) — mobilde dar/uzun kırpmada
// odağın alta kaymaması için hem video hem poster-fallback aynı object-position'ı kullanır.
const FOCAL = "50% 38%";
