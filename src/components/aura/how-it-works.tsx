"use client";

import { useEffect, useRef, useState } from "react";
import { ChapterCta, type ChapterData } from "./chapters";
import { AuraClosing } from "./closing";
import { AuraNav } from "./nav";
import {
  HIW_VIDEOS,
  LETTERS,
  LangProvider,
  langDir,
  useLang,
  type Copy,
} from "@/lib/aura-landing/i18n";

type Guide = Copy["hiw"]["guides"][number];

// /how-it-works — "How It Works" landing'i (vitrinden taşındı): letterform
// hero + 4 seçenek kartı (sayfa içi çapa) + her yolculuk için video +
// numaralı adım rehberi. Rehberin n/strand/başlık/intro/CTA'sı chapters
// kaydından key ile bulunur; CTA hedefleri ana sayfadaki akış sözleşmesiyle
// birebir aynıdır.
export function HowItWorks() {
  return (
    <LangProvider>
      <HiwShell />
    </LangProvider>
  );
}

function HiwShell() {
  const { lang } = useLang();
  return (
    <div dir={langDir(lang)} lang={lang} className="aura-page min-h-dvh">
      <AuraNav />
      <main className="pt-16">
        <HiwHero />
        <HiwPicker />
        <HiwGuides />
      </main>
      <AuraClosing />
    </div>
  );
}

// Hero: giriş başlıklarındaki letterform dilinin büyük ölçekli hali.
function HiwHero() {
  const { t } = useLang();
  const h = t.hiw;
  const label = [h.wordBefore, h.word + h.wordAfter, h.lineAfter].filter(Boolean).join(" ");

  return (
    <section className="mx-auto max-w-6xl px-5 pb-6 pt-14 md:px-8 md:pt-24">
      <p className="aura-mono text-sm text-[var(--aura-accent)]">/ {h.eyebrow}</p>
      <h1
        aria-label={label}
        className="aura-display mt-4 text-4xl font-bold leading-tight tracking-tighter text-[var(--aura-ink)] md:text-6xl"
      >
        <span aria-hidden className="block">
          {h.wordBefore && <span className="block">{h.wordBefore}</span>}
          <span className="aura-word mt-3 flex items-end gap-[0.14em]">
            {LETTERS.map((letter) => (
              <img
                key={letter}
                src={`/assets/letters/${letter}.png`}
                alt=""
                draggable={false}
                className="h-[0.9em] w-auto"
              />
            ))}
            {h.wordAfter && <span className="ml-1">{h.wordAfter}</span>}
          </span>
          {h.lineAfter && <span className="mt-3 block">{h.lineAfter}</span>}
        </span>
      </h1>
      <p className="mt-6 max-w-xl text-base leading-relaxed text-[var(--aura-grey)] md:text-lg">
        {h.sub}
      </p>
    </section>
  );
}

// Seçenek destesi: 4 yolculuk kartı — sayfa içi çapalara atlar.
function HiwPicker() {
  const { t } = useLang();

  return (
    <section className="mx-auto max-w-6xl px-5 pb-14 md:px-8">
      <p className="aura-mono text-[13px] text-[var(--aura-grey)]">{t.hiw.pick}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {t.hiw.guides.map((g) => {
          const ch = t.chapters.find((c) => c.key === g.key);
          if (!ch) return null;
          return (
            <a
              key={g.key}
              href={`#hiw-${g.key}`}
              className="group rounded-[16px] border border-[var(--aura-hairline)] bg-[var(--aura-panel)] p-5 transition-colors duration-200 hover:border-[var(--aura-accent)]/50"
            >
              <p className="aura-mono text-[12px]">
                <span className="aura-badge">
                  {ch.n} / 04{" · "}
                  <span className="uppercase tracking-wider">{ch.strand}</span>
                </span>
              </p>
              <p className="aura-display mt-3 text-lg font-bold leading-snug tracking-tight text-[var(--aura-ink)]">
                {ch.title}
              </p>
              <p className="aura-mono mt-4 text-[12px] text-[var(--aura-grey)] transition-colors duration-200 group-hover:text-[var(--aura-accent)]">
                {"↓ "}
                {t.hiw.watch}
              </p>
            </a>
          );
        })}
      </div>
    </section>
  );
}

function HiwGuides() {
  const { t } = useLang();

  return (
    <>
      {t.hiw.guides.map((g, i) => {
        const ch = t.chapters.find((c) => c.key === g.key);
        if (!ch) return null;
        return (
          <HiwGuide key={g.key} g={g} ch={ch} flip={i % 2 === 1} stepWord={t.hiw.step} />
        );
      })}
    </>
  );
}

// Rehber bölümü: solda (tek sıralı bölümlerde sağda) video paneli, yanda
// numaralı adım listesi + chapter CTA'sı.
function HiwGuide({
  g,
  ch,
  flip,
  stepWord,
}: {
  g: Guide;
  ch: ChapterData;
  flip: boolean;
  stepWord: string;
}) {
  return (
    <section id={`hiw-${g.key}`} className="scroll-mt-16 border-t border-[var(--aura-hairline)]">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-2 md:gap-14 md:px-8 md:py-24">
        <GuideVideo videoKey={g.key} flip={flip} />
        <div>
          <p className="aura-mono text-sm">
            <span className="aura-badge">
              {ch.n} / 04{" · "}
              <span className="uppercase tracking-wider">{ch.strand}</span>
            </span>
          </p>
          <h2 className="aura-display mt-4 text-3xl font-bold leading-none tracking-tighter text-[var(--aura-ink)] md:text-5xl">
            {ch.title}
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-[var(--aura-grey)]">
            {ch.body}
          </p>
          <ol className="mt-8 space-y-5">
            {g.steps.map((s, si) => (
              <li key={si} className="flex gap-4">
                <span
                  aria-label={`${stepWord} ${si + 1}`}
                  className="aura-mono mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--aura-accent)]/50 text-[11px] text-[var(--aura-accent)]"
                >
                  {String(si + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="text-[15px] font-semibold text-[var(--aura-ink)]">{s.t}</p>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--aura-grey)]">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-9">
            <ChapterCta c={ch} />
          </div>
        </div>
      </div>
    </section>
  );
}

// Video paneli: poster + tıkla-oynat kapısı (vitrindeki v2 davranış).
// Kaynak preload="none" ile ancak kullanıcı "rehberi izle" deyince bağlanır
// (720p, ~1 MB). Oynatma başladıktan sonra IO görünürken sürdürür, çıkınca
// duraklatır; reduced-motion'da da poster kalır, açık istekle oynatma serbest.
function GuideVideo({ videoKey, flip }: { videoKey: string; flip: boolean }) {
  const v = HIW_VIDEOS[videoKey as keyof typeof HIW_VIDEOS];
  const { t } = useLang();
  const ref = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!active || !video) return;
    void video.play().catch(() => {});
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.25 },
    );
    io.observe(video);
    return () => io.disconnect();
  }, [active]);

  return (
    <div
      className={
        "relative overflow-hidden rounded-[22px] border border-[var(--aura-hairline)] bg-[var(--aura-panel)]" +
        (flip ? " md:order-2" : "")
      }
    >
      <video
        ref={ref}
        muted
        loop
        playsInline
        preload="none"
        poster={v.poster}
        aria-hidden
        className="aspect-video h-auto w-full object-cover"
      >
        <source src={v.src} type="video/mp4" />
      </video>
      {!active && (
        <button
          type="button"
          onClick={() => setActive(true)}
          className="group absolute inset-0 flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--aura-accent)]"
        >
          <span className="aura-badge aura-mono px-4 py-2 text-[13px] transition-colors duration-200 group-hover:text-[var(--aura-ink)]">
            {"▶ "}
            {t.hiw.watch}
          </span>
        </button>
      )}
    </div>
  );
}
