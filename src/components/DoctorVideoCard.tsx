"use client";

// Doktor tanıtım videosu (kartvizit) — cinsiyete göre yüklenir (erkek/kadın isimli doktor).
// Kaynak: public/videos/doctor-{male,female}.mp4 (varsayılan) + dil-bazlı varyant
// doctor-{male,female}-{dilkodu}.mp4 (ör. doctor-female-ar.mp4). Dil varyantı yoksa onError ile
// varsayılana düşülür — manifest gerekmez; dosya public/videos/'a eklenince otomatik devreye girer
// (Vercel'de public/ CDN'den servis edilir, sunucu-tarafı klasör taraması güvenilmez).
// Altyazı: çevrilmiş satırlar (subtitles) video süresine eşit dağıtılıp WebVTT olarak basılır
// (Blob URL + <track>) — dil-bazlı video kaynağı olmayan dillerde de "hastanın dilinde" deneyim.
// Sessiz otomatik döngü (kartvizit hissi) + tam kontroller (kullanıcı sesli izleyebilir/durdurabilir).
import { useEffect, useRef, useState } from "react";
import { LANG_BCP47 } from "@/lib/constants";
// Kanonik tanıtım metni VIDEO_CARD_SCRIPT @/lib/constants'tadır (server+client ortak import;
// "use client" modülünden veri export'u server component'te client-reference'a döner).

// Dil adı ("Arapça") → video dosya adı kodu ("ar"). Bilinmeyen dil → null (varsayılan video).
function langFileCode(lang?: string | null): string | null {
  if (!lang) return null;
  const bcp = LANG_BCP47[lang];
  if (!bcp) return null;
  const code = bcp.split("-")[0];
  return code === "tr" ? null : code; // varsayılan videolar TR — TR için varyant aranmaz
}

// Yüklenemeyen (404/decode) video varyantları — modül-seviyesi: dil değişip geri dönüldüğünde veya
// kart yeniden mount olduğunda bilinen-404 varyant tekrar denenmez (tekrarlı 404 + remount flaşı önlenir).
const FAILED_VIDEO_SRCS = new Set<string>();

// mm:ss.mmm — WebVTT cue zaman biçimi.
function vttTime(sec: number): string {
  const ms = Math.max(0, Math.round(sec * 1000));
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), r = ms % 1000;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(r).padStart(3, "0")}`;
}

// Satırları video süresine eşit dağıtan WebVTT üretir (başta/sonda küçük pay; cue'lar arası nefes).
function buildVtt(lines: string[], duration: number): string {
  const clean = lines.map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const pad = Math.min(0.5, duration * 0.04);
  const usable = Math.max(0.1, duration - 2 * pad);
  const slot = usable / clean.length;
  const cues = clean.map((text, i) => {
    const start = pad + i * slot;
    const end = start + slot * 0.92;
    return `${vttTime(start)} --> ${vttTime(end)}\n${text}`;
  });
  return `WEBVTT\n\n${cues.join("\n\n")}\n`;
}

export function DoctorVideoCard({
  name, title, female, lang, subtitles, ariaLabel,
}: {
  name: string;
  title: string;
  female: boolean;
  /** Hasta dili (Türkçe adıyla, ör. "Arapça") — dil-bazlı video varyantı + altyazı srclang. */
  lang?: string;
  /** Hedef dile ÇEVRİLMİŞ tanıtım satırları (VIDEO_CARD_SCRIPT sırasıyla). Yoksa altyazı basılmaz. */
  subtitles?: string[];
  /** Çevrilmiş erişilebilirlik etiketi (yoksa TR). */
  ariaLabel?: string;
}) {
  const fallbackSrc = female ? "/videos/doctor-female.mp4" : "/videos/doctor-male.mp4";
  const code = langFileCode(lang);
  const langSrc = code ? `/videos/doctor-${female ? "female" : "male"}-${code}.mp4` : null;

  // Dil varyantı varsa önce o denenir; yüklenemezse (404/decode) varsayılana düşülür.
  // Başarısızlık FAILED_VIDEO_SRCS'e yazılır (modül-seviyesi); state tick yalnız re-render tetikler.
  const [, bumpFailed] = useState(0);
  const src = langSrc && !FAILED_VIDEO_SRCS.has(langSrc) ? langSrc : fallbackSrc;

  // Altyazı: süre öğrenilince (loadedmetadata) VTT üret → Blob URL → <track>.
  // subtitles her render'da yeni dizi olabilir (lobi sık re-render eder) → içerik imzasıyla stabilize.
  const videoRef = useRef<HTMLVideoElement>(null);
  const [vttUrl, setVttUrl] = useState<string | null>(null);
  const subSig = subtitles?.map((s) => s.trim()).filter(Boolean).join("\n") ?? "";

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !subSig) return; // önceki koşunun cleanup'ı eski track'i zaten temizledi
    let url: string | null = null;
    const make = () => {
      if (!video.duration || !isFinite(video.duration)) return;
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(new Blob([buildVtt(subSig.split("\n"), video.duration)], { type: "text/vtt" }));
      setVttUrl(url);
    };
    if (video.readyState >= 1) make();
    video.addEventListener("loadedmetadata", make);
    return () => {
      video.removeEventListener("loadedmetadata", make);
      if (url) URL.revokeObjectURL(url);
      setVttUrl(null);
    };
  }, [subSig, src]);

  // <track> metadata sonrası eklendiğinde bazı tarayıcılar default'u otomatik göstermez → modu zorla.
  useEffect(() => {
    const tracks = videoRef.current?.textTracks;
    if (vttUrl && tracks && tracks.length > 0) tracks[0].mode = "showing";
  }, [vttUrl]);

  const srclang = (lang && LANG_BCP47[lang]?.split("-")[0]) || "tr";

  return (
    <div className="dvc">
      <video
        ref={videoRef}
        key={src}
        className="dvc-video"
        src={src}
        onError={() => { if (langSrc && src === langSrc) { FAILED_VIDEO_SRCS.add(langSrc); bumpFailed((n) => n + 1); } }}
        autoPlay
        muted
        loop
        playsInline
        controls
        preload="metadata"
        aria-label={ariaLabel ?? `${title} ${name} tanıtım videosu`}
      >
        {vttUrl && <track kind="subtitles" src={vttUrl} srcLang={srclang} default />}
      </video>
      <div className="dvc-top" aria-hidden>
        <span className="dvc-badge"><i /> TANITIM</span>
        <span className="dvc-id">{title} {name}</span>
      </div>

      <style>{`
        .dvc { position: relative; aspect-ratio: 16/9; width: 100%; overflow: hidden; border-radius: 0.75rem; background: #07221f; }
        .dvc-video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; background: #000; }
        .dvc-video::cue { font-size: 0.85rem; line-height: 1.35; background: rgba(0,0,0,0.55); }
        .dvc-top { position: absolute; top: 0; left: 0; right: 0; z-index: 2; display: flex; align-items: center;
          justify-content: space-between; gap: 0.5rem; padding: 0.6rem 0.75rem; pointer-events: none;
          background: linear-gradient(to bottom, rgba(0,0,0,0.5), transparent); }
        .dvc-badge { display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.6rem; font-weight: 700;
          letter-spacing: 0.04em; color: rgba(255,255,255,0.95); background: rgba(0,0,0,0.35); padding: 0.2rem 0.45rem; border-radius: 999px; }
        .dvc-badge i { height: 6px; width: 6px; border-radius: 50%; background: #f87171; animation: dvc-blink 1.4s steps(1) infinite; }
        .dvc-id { font-size: 0.7rem; font-weight: 700; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,0.6); }
        @keyframes dvc-blink { 50% { opacity: 0.2; } }
        @media (prefers-reduced-motion: reduce) { .dvc-badge i { animation: none; } }
      `}</style>
    </div>
  );
}
