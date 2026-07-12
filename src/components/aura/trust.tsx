"use client";

import { useEffect, useRef } from "react";
import { useLang } from "@/lib/aura-landing/i18n";

// Guven v2: gece zemininde dev metrik seridi (gsap sayaci, demo dipnotu) +
// tek tipografik alinti (turkuaz tirnaklar) + cerceveli akreditasyon
// monogramlari. Uydurulmus markalara inline-SVG monogram kurali surer.
export function AuraTrust() {
  const { t } = useLang();

  return (
    <section className="mx-auto max-w-6xl px-5 py-24 md:px-8 md:py-32">
      {/* Dev metrik seridi */}
      <div className="flex flex-wrap items-end justify-center gap-x-12 gap-y-6 md:gap-x-20">
        {t.trust.metrics.map((m) => (
          <Metric key={m.label} value={m.value} suffix={m.suffix} label={m.label} />
        ))}
      </div>
      <p className="aura-mono mt-3 text-center text-[11px] text-[var(--aura-micro)]">
        {t.trust.footnote}
      </p>

      {/* Tek tipografik alinti */}
      <figure className="mx-auto mt-16 max-w-3xl text-center">
        <blockquote className="aura-display text-2xl font-bold leading-snug tracking-tight md:text-3xl">
          <span aria-hidden className="text-[var(--aura-accent)]">
            “
          </span>
          {t.trust.quote}
          <span aria-hidden className="text-[var(--aura-accent)]">
            ”
          </span>
        </blockquote>
        <figcaption className="mt-5 text-sm text-[var(--aura-grey)]">
          <span className="font-medium text-[var(--aura-ink)]">{t.trust.attribName}</span>
          {" · "}
          {t.trust.attribRole}
        </figcaption>
      </figure>

      {/* Akreditasyon monogram seridi */}
      <div className="mt-16 flex flex-wrap items-center justify-center gap-x-10 gap-y-5 opacity-50">
        {["JCI", "ISO 9001", "TÜRSAB", "TGA", "KVKK"].map((m) => (
          <Monogram key={m} label={m} />
        ))}
      </div>
    </section>
  );
}

// Sayi animasyonu: gorunur olunca gsap sayaci 0'dan hedefe kosar; JS oncesi
// statik hedef deger render edilir (screenshot-safe, opacity oyunu yok).
function Metric({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const numRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = numRef.current;
    if (reduced || !el) return;
    const decimals = Number.isInteger(value) ? 0 : 1;
    let killed = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        io.disconnect();
        void import("gsap").then(({ gsap }) => {
          if (killed) return;
          const counter = { n: 0 };
          gsap.to(counter, {
            n: value,
            duration: 1.4,
            ease: "power2.out",
            onUpdate: () => {
              el.textContent = counter.n.toFixed(decimals);
            },
          });
        });
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      killed = true;
      io.disconnect();
    };
  }, [value]);

  return (
    <div className="text-center">
      <p className="aura-display text-5xl font-bold leading-none tracking-tighter md:text-7xl">
        <span ref={numRef}>{Number.isInteger(value) ? value : value.toFixed(1)}</span>
        {suffix}
      </p>
      <p className="mt-2 text-sm text-[var(--aura-grey)]">{label}</p>
    </div>
  );
}

function Monogram({ label }: { label: string }) {
  const w = Math.max(64, label.length * 13 + 26);
  return (
    <svg
      role="img"
      aria-label={label}
      width={w}
      height="28"
      viewBox={`0 0 ${w} 28`}
      className="text-[var(--aura-grey)]"
    >
      <rect x="1" y="1" width={w - 2} height="26" rx="4" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        fontFamily="var(--aura-font-mono)"
        fontSize="11"
        fill="currentColor"
      >
        {label}
      </text>
    </svg>
  );
}
