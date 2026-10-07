"use client";

import { useEffect, useRef, useState } from "react";
import { AiVideoNoticeBadge } from "@/components/AiVideoNotice";
import { heroMotionAllowed, heroVideoEligible, type HeroConnection } from "@/lib/doctorium-hero-media";

const POSTER = "/assets/video/p-doctorium-film14-still-v2.webp";
const FILM = "/assets/video/v-doctorium-film14-720.mp4";
const FOCAL = "50% 38%";
type Connection = HeroConnection & EventTarget;

// Film14 and the existing overlay/brand remain unchanged. The text-free poster
// comes from 15s in that film; the mobile default has no video/source element.
export function DoctoriumBgVideo({ overlay }: { overlay: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [policy, setPolicy] = useState({ motionAllowed: false, desktop: false, inView: false, tabVisible: false });
  const [requested, setRequested] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [pausedByUser, setPausedByUser] = useState(false);
  const eligible = heroVideoEligible({ ...policy, requested });
  const showVideo = policy.motionAllowed && loaded;

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktop = window.matchMedia("(min-width: 1024px)");
    const connection = (navigator as Navigator & { connection?: Connection }).connection;
    let inView = false;
    const update = () => setPolicy({ motionAllowed: heroMotionAllowed(motion.matches, connection), desktop: desktop.matches, inView, tabVisible: document.visibilityState === "visible" });
    const observer = new IntersectionObserver(([entry]) => { inView = entry?.isIntersecting ?? false; update(); }, { threshold: 0.1 });
    if (rootRef.current) observer.observe(rootRef.current);
    motion.addEventListener("change", update);
    desktop.addEventListener("change", update);
    connection?.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", update);
      desktop.removeEventListener("change", update);
      connection?.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  useEffect(() => {
    if (eligible && !loaded) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- attach the media source only after browser visibility and preference checks
      setLoaded(true);
    }
    const video = videoRef.current;
    if (!video) return;
    if (eligible && !pausedByUser) void video.play().catch(() => {});
    else video.pause();
  }, [eligible, loaded, pausedByUser, showVideo]);

  return (
    <>
      <div ref={rootRef} aria-hidden className="pointer-events-none absolute inset-0" />
      {showVideo ? (
        <video ref={videoRef} muted={!soundOn} loop playsInline preload="none" poster={POSTER} aria-hidden className="absolute inset-0 -z-10 h-full w-full object-cover" style={{ objectPosition: FOCAL }}>
          <source src={FILM} type="video/mp4" />
        </video>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- decorative absolute background, also the video poster
        <img src={POSTER} alt="" aria-hidden fetchPriority="high" width={1280} height={720} className="absolute inset-0 -z-10 h-full w-full object-cover" style={{ objectPosition: FOCAL }} />
      )}
      <div aria-hidden className="absolute inset-0 -z-10" style={{ background: overlay }} />
      {policy.motionAllowed && (
        <div className="absolute bottom-12 right-3 z-10 flex flex-wrap justify-end gap-2">
          {!showVideo ? (
            <button type="button" onClick={() => setRequested(true)} className={CONTROL}>Tanıtım videosunu oynat</button>
          ) : (
            <>
              <button type="button" onClick={() => setPausedByUser((value) => !value)} aria-pressed={pausedByUser} className={CONTROL}>{pausedByUser ? "Videoyu oynat" : "Videoyu duraklat"}</button>
              <button type="button" onClick={() => setSoundOn((value) => !value)} aria-pressed={soundOn} className={CONTROL}>{soundOn ? "Sesi kapat" : "Sesi aç"}</button>
            </>
          )}
        </div>
      )}
      <AiVideoNoticeBadge lang="tr" />
    </>
  );
}

const CONTROL = "rounded-full border border-white/15 bg-black/55 px-3.5 py-2 text-[12px] font-medium text-white backdrop-blur-sm transition hover:bg-black/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70";
