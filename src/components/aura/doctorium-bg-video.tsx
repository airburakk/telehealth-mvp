"use client";

import { useEffect, useRef } from "react";
import { AiVideoNoticeBadge } from "@/components/AiVideoNotice";

// /doctorium arka plan videosu (deneme, 2026-08-16) — v2 hero sözleşmesinin taşıması:
// IO ile yalnız görünürken oynat · arka plan sekmesinde mount-play reddedilir →
// visibilitychange'te yeniden dene · Save-Data ve reduced-motion'da HİÇ başlatma
// (preload="none" → play edilmeyen video inmez, poster kalır). Kaynak UZUN FİLM
// (film9: 37.3 sn, 2026-08-17 dördüncü revizyon — [1] ofis POV: doktor GÖRÜNMEZ, beyaz
// masada gerçek ölçülü Apple seti [XDR + Mac Studio + Magic klavye/mouse], el sağ üst
// "katıl"a tıklar → SOL ÜST logo ışır [orijinal boyutlu logo; screenshot referans];
// [2] adliye = İSTANBUL ÇAĞLAYAN: kullanıcının 360tr C-Kapısı/Ön-Bürolar + Yandex heykel
// referanslarından nano_banana kareleri üretildi → KULLANICI ONAYIYLA i2v 4 plan
// [C Kapısı girişi → Themis heykelleri arası → galeri boşluğu ötesindeki duvarda ARŞİV
// kapısı → raf dijitalizasyonu+patlama; TR baro cübbeleri + bej adliye güvenliği];
// kurguda ~11 sn'e sıkıştırıldı [2.5+2.5+2+4]. Ad-vers. film8→film9.
// film10 DENENDİ ve GERİ ALINDI (kullanıcı 2026-08-17: "onayladığım versiyon okeydi,
// videoyu değiştirmeden çöz") — kaynak film9'da KALDI; logo-kırpılma sorunu KODLA çözüldü:
// aşağıdaki kare-senkron anchor. object-cover, bölüm 16:9'dan GENİŞ olduğunda videoyu
// DİKEYde kırpar ve ofis sahnesinde sayfanın üst bandını (nav + zümrüt logo) yutuyordu.
// Çözüm: yalnız ofis sekansı süresince (film9 zaman ekseni 4.0–9.15 sn) objectPosition
// "center top" — anchor değişimleri tam sahne KESME anlarına denk gelir, sıçrama
// algılanmaz. Zamanlama kare-senkron requestVideoFrameCallback ile (destek yoksa
// timeupdate ~4Hz kaba fallback). ⚠️ Film yeniden kurgulanırsa bu aralık da güncellenir.
// `overlay` = üstteki okunurluk skrimi: koyu bölümde koyu gradient, açık bölümde
// beyaz perde — çağıran bölümün temasına göre verilir. Kapsayıcı bölümde
// `relative isolate` ŞART (-z-10 katmanları bölüm köküne gömülür).
// film11 (2026-08-17, kullanıcı-onaylı üç sekans yenilemesi): kütüphane = BEYAZIT DEVLET
// KÜTÜPHANESİ (meydan cephesi + kubbeli kalem işi salon + Tabanlıoğlu cam kitap küpü +
// küp-içi dijitalizasyon; kullanıcının Maps/mimarizm referansları) · adliye = Çağlayan
// (film9'dan aynen) · kongre = İSTANBUL KONGRE MERKEZİ Harbiye Oditoryumu + GLOBAL SPINE
// CONGRESS 2026 (kullanıcı talimatı: gerçek mekân+etkinlik; C2→dijitalizasyon TEK ÇEKİM —
// sıçrama yok; girişte önlük yok, takım elbise). film12 (2026-08-17): Beyazıt küp
// planındaki okur kadrajdan çıkamadan kesiliyordu ("çocuk bir anda çekiliyor") →
// b3→b4 geçişi 0.5 sn CROSSFADE oldu (küp küpe oturur, okur kenarda erir).
// film13 (2026-08-18): landing hekim→doktor çevirisi sonrası ofis sekansı YENİLENDİ —
// ekrandaki sayfa artık "Doktorun Yeni Çalışma Alanı" (kullanıcı-onaylı kare → i2v;
// eski dilim kare 96–215 = tam 120 kare, yenisi de 120 kare → süre/kesme noktaları
// DEĞİŞMEDİ; kaynaklar arşivde: doctorium-home-shot2 + office-kare-doktorun-v2 +
// scene-office4-doktorun). 45.75 sn; ofis sekansı 4.0–9.04.
const OFFICE_SCENE_START = 4.0;
const OFFICE_SCENE_END = 9.04;

type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: () => void) => number;
};

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

    // Ofis sekansında üst-anchor (logo bandı korunur); kesme anlarında değişir.
    let disposed = false;
    const applyAnchor = () => {
      const t = video.currentTime;
      const inOffice = t >= OFFICE_SCENE_START && t < OFFICE_SCENE_END;
      const want = inOffice ? "center top" : "center center";
      if (video.style.objectPosition !== want) video.style.objectPosition = want;
    };
    const v = video as VideoWithFrameCallback;
    if (typeof v.requestVideoFrameCallback === "function") {
      const loop = () => {
        if (disposed) return;
        applyAnchor();
        v.requestVideoFrameCallback!(loop);
      };
      v.requestVideoFrameCallback(loop);
    } else {
      video.addEventListener("timeupdate", applyAnchor);
    }

    return () => {
      disposed = true;
      video.removeEventListener("timeupdate", applyAnchor);
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
        poster="/assets/video/p-doctorium-film13.jpg"
        aria-hidden
        className="absolute inset-0 -z-10 h-full w-full object-cover"
      >
        <source src="/assets/video/v-doctorium-film13-720.mp4" type="video/mp4" />
      </video>
      <div aria-hidden className="absolute inset-0 -z-10" style={{ background: overlay }} />
      {/* Seffaflik beyani (kullanici karari 2026-08-18). Doctorium yuzeyi tek dil TR. */}
      <AiVideoNoticeBadge lang="tr" />
    </>
  );
}
