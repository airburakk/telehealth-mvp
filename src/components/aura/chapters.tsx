"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useLang, VIDEOS } from "@/lib/aura-landing/i18n";

// Tier-1: "3D Roll chapter destesi" — 4 sahne 220dvh pencerelere pinli
// sticky-stack; basliklar girerken 3B silindirden yuvarlanir (rotateX scrub).
// v5 video davranisi (kullanici karari): MASAUSTU = LOOP (video gorunurken
// kendi akisinda oynar — poster ilk kareyle dikissiz), MOBIL/TOUCH = scroll-
// scrub film (all-keyframe "-k" kaynaklari yalniz scrub modunda yuklenir +
// rAF-lerp yumusatilmis seek, katsayi 0.3). Reduced-motion: statik poster.
export function AuraChapters() {
  const { t } = useLang();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wrap = wrapRef.current;
    if (!wrap) return;

    // Scrub yalniz dokunmatik/kaba isaretcide; masaustu loop oynatir.
    const scrubMode = !reduced && window.matchMedia("(pointer: coarse)").matches;

    // Loop modu (masaustu): videolar gorunurken oynat, cikinca durdur.
    const ios: IntersectionObserver[] = [];
    if (!reduced && !scrubMode) {
      wrap.querySelectorAll("video").forEach((video) => {
        const io = new IntersectionObserver(
          (entries) => {
            if (entries[0]?.isIntersecting) void video.play().catch(() => {});
            else video.pause();
          },
          { threshold: 0.15 },
        );
        io.observe(video);
        ios.push(io);
      });
    }

    if (reduced) return () => ios.forEach((io) => io.disconnect());

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

      const mobile = window.matchMedia("(max-width: 767px)").matches;
      const rollDeg = mobile ? 35 : 65;
      const tickers: Array<() => void> = [];

      const ctx = gsap.context(() => {
        gsap.utils.toArray<HTMLElement>("[data-chapter]").forEach((wrapper) => {
          const chars = wrapper.querySelectorAll("[data-roll-char]");
          const meta = wrapper.querySelectorAll("[data-roll-meta]");
          // Giris rollu: sahne pinlenene kadar tamamlanir (trigger = wrapper;
          // sticky section pin sirasinda top=0'a kilitli oldugundan trigger
          // olamaz).
          const st = {
            trigger: wrapper,
            start: "top 80%",
            end: "top top",
            scrub: 0.7,
          };
          gsap.fromTo(
            chars,
            {
              rotateX: -rollDeg,
              yPercent: 55,
              transformOrigin: "50% 100% -60px",
            },
            { rotateX: 0, yPercent: 0, stagger: 0.02, ease: "none", scrollTrigger: st },
          );
          gsap.fromTo(
            meta,
            { yPercent: 60 },
            { yPercent: 0, stagger: 0.05, ease: "none", scrollTrigger: st },
          );

          // Sahne medyasi: giris/cikista hafif derinlik (paralaks his).
          const media = wrapper.querySelector("[data-chapter-media]");
          if (media) {
            gsap.fromTo(
              media,
              { scale: 1.08 },
              {
                scale: 1,
                ease: "none",
                scrollTrigger: {
                  trigger: wrapper,
                  start: "top bottom",
                  end: "bottom top",
                  scrub: 0.7,
                },
              },
            );
          }

          // Scroll-scrub film: pin penceresi boyunca video scroll'la akar.
          const video = wrapper.querySelector("video");
          const scrubSrc = video?.dataset.scrubSrc;
          if (video && scrubSrc && scrubMode) {
            // All-keyframe kaynaga gec (yalniz masaustu bunu indirir).
            video.src = scrubSrc;
            video.preload = "auto";
            video.load();
            video.pause();

            let target = 0; // scroll'un istedigi ilerleme (0-1)
            let current = 0; // lerp'lenen ilerleme
            const trigger = stMod.ScrollTrigger.create({
              trigger: wrapper,
              start: "top top",
              end: "bottom bottom",
              scrub: true,
              onUpdate: (self) => {
                target = self.progress;
              },
            });

            const syncNow = () => {
              target = trigger.progress;
              current = target;
            };
            if (video.readyState >= 1) syncNow();
            else video.addEventListener("loadedmetadata", syncNow, { once: true });

            // Yumusatilmis seek: hedefe kademeli yaklas; kare-alti farkta ve
            // seek surerken atla (all-keyframe sayesinde her seek ucuz).
            const tick = () => {
              const dur = video.duration;
              if (!dur || !Number.isFinite(dur)) return;
              current += (target - current) * 0.3;
              const want = Math.min(dur - 0.05, Math.max(0, current * dur));
              if (!video.seeking && Math.abs(want - video.currentTime) > 0.033) {
                video.currentTime = want;
              }
            };
            gsap.ticker.add(tick);
            tickers.push(tick);
          }
        });
      }, wrap);
      undo = () => {
        tickers.forEach((fn) => gsap.ticker.remove(fn));
        ctx.revert();
      };
    })();

    return () => {
      cancelled = true;
      ios.forEach((io) => io.disconnect());
      undo?.();
    };
  }, []);

  return (
    <div id="scenes" ref={wrapRef} className="relative">
      {t.chapters.map((c, i) => (
        <Chapter key={c.n} c={c} index={i} />
      ))}
    </div>
  );
}

export type ChapterData = {
  n: string;
  key: string;
  strand: string;
  title: string;
  body: string;
  cta: string;
  href: string;
  external: boolean;
};

function Chapter({ c, index }: { c: ChapterData; index: number }) {
  const v = VIDEOS[c.key as keyof typeof VIDEOS];
  const scrubSrc = "scrub" in v ? v.scrub : undefined;

  return (
    // 220dvh pencere: ilk 100dvh giris (roll), kalan 120dvh pinli film scrubu.
    // z-index artan → sonraki sahne oncekinin uzerine biner (deste etkisi).
    <div
      id={`ch-${c.key}`}
      data-chapter
      className="relative h-[220dvh]"
      style={{ zIndex: index + 1 }}
    >
      <section className="sticky top-0 flex h-dvh items-end overflow-hidden md:items-center">
        {/* Sahne medyasi */}
        <div data-chapter-media aria-hidden className="absolute inset-0 will-change-transform">
          {/* 720p hafif kopya + preload="none": Range'siz sunucuda metadata
              hint'i 4 sahneyi acilista TAM indirtiyordu (~21.7 MB); simdi
              her sahne ancak IO play() aninda ~0.3-0.8 MB ceker. Scrub
              kaynagi da 720p all-keyframe (-k720). */}
          <video
            muted
            loop
            playsInline
            preload="none"
            poster={v.poster}
            data-scrub-src={scrubSrc}
            className="h-full w-full object-cover"
          >
            <source src={v.src720} type="video/mp4" />
          </video>
          <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(to_right,rgba(13,14,16,0.82)_0%,rgba(13,14,16,0.45)_55%,rgba(13,14,16,0.15)_100%)]"
          />
        </div>

        <div className="aura-roll-stage relative mx-auto w-full max-w-6xl px-5 pb-20 pt-28 md:px-8 md:pb-28">
          {/* Etiket rozeti: cam zemin + turkuaz + nefes alan aura (.aura-badge) */}
          <p data-roll-meta className="aura-mono text-sm">
            <span className="aura-badge">
              {c.n} / 04{" · "}
              <span className="uppercase tracking-wider">{c.strand}</span>
            </span>
          </p>
          <h2
            className="aura-display mt-5 max-w-4xl text-5xl font-bold leading-[0.95] tracking-tighter text-[var(--aura-ink)] md:text-8xl"
            aria-label={c.title}
          >
            {c.title.split(" ").map((word, wi) => (
              <span key={wi} className="mr-[0.24em] inline-block whitespace-nowrap">
                {word.split("").map((ch, ci) => (
                  <span
                    key={ci}
                    data-roll-char
                    aria-hidden
                    className="inline-block will-change-transform"
                  >
                    {ch}
                  </span>
                ))}
              </span>
            ))}
          </h2>
          <p data-roll-meta className="mt-6 max-w-md text-base leading-relaxed text-[var(--aura-grey)]">
            {c.body}
          </p>
          <div data-roll-meta className="mt-8">
            <ChapterCta c={c} />
          </div>
        </div>
      </section>
    </div>
  );
}

// Chapter CTA giysisi: mono makara-okuma — "01 → etiket"; hover'da rakam bir
// tur yuvarlanir (rotateX 360) ve altcizgi turkuaza akar. Chapter'lar ve
// How-It-Works rehber bolumleri ayni giysiyi paylasir (ayni etiket = ayni niyet).
export function ChapterCta({ c }: { c: ChapterData }) {
  const inner = (
    <>
      <span
        aria-hidden
        className="aura-mono inline-block text-[15px] text-[var(--aura-accent)] transition-transform duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateX(360deg)]"
      >
        {c.n}
      </span>
      <span aria-hidden className="aura-mono text-[15px] text-[var(--aura-grey)]">
        {"→"}
      </span>
      <span className="aura-mono relative text-[15px] text-[var(--aura-ink)]">
        {c.cta}
        <span
          aria-hidden
          className="absolute -bottom-1 left-0 h-px w-full bg-[var(--aura-grey)]/50 transition-colors duration-300 group-hover:bg-[var(--aura-accent)]"
        />
      </span>
    </>
  );

  return c.external ? (
    <a href={c.href} className="group inline-flex items-center gap-2.5">
      {inner}
    </a>
  ) : (
    <Link href={c.href} className="group inline-flex items-center gap-2.5">
      {inner}
    </Link>
  );
}
