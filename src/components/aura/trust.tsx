"use client";

import { useEffect, useRef, useState } from "react";
import { Users, Building2, Star, type LucideIcon } from "lucide-react";
import { useLang } from "@/lib/aura-landing/i18n";

// Guven v3 (sandwich gunduz govdesi): dev metrik seridi (gsap sayaci + ikon) +
// DONEN tek-tipografik alinti destesi (turkuaz tirnaklar, nokta gostergeli) +
// cerceveli akreditasyon monogramlari (hover'da tam ad). Uydurulmus markalara
// inline-SVG monogram kurali surer.
const METRIC_ICONS: LucideIcon[] = [Users, Building2, Star];

// Akreditasyon monogramlari + hover tam adi (kurum adlari evrensel → cevrilmez).
const ACCREDS: { label: string; full: string }[] = [
  { label: "JCI", full: "Joint Commission International" },
  { label: "ISO 9001", full: "ISO 9001 — Quality Management" },
  { label: "TÜRSAB", full: "Türkiye Seyahat Acentaları Birliği" },
  { label: "TGA", full: "Health Tourism Accreditation" },
  { label: "KVKK", full: "Kişisel Verilerin Korunması Kanunu" },
];

export function AuraTrust() {
  const { t } = useLang();

  return (
    <section className="mx-auto max-w-6xl px-5 py-24 md:px-8 md:py-32">
      {/* Dev metrik seridi */}
      <div className="flex flex-wrap items-end justify-center gap-x-12 gap-y-6 md:gap-x-20">
        {t.trust.metrics.map((m, i) => (
          <Metric key={m.label} value={m.value} suffix={m.suffix} label={m.label} Icon={METRIC_ICONS[i]} />
        ))}
      </div>
      <p className="aura-mono mt-3 text-center text-[11px] text-[var(--aura-micro)]">
        {t.trust.footnote}
      </p>

      {/* Donen tipografik alinti destesi */}
      <QuoteCarousel quotes={t.trust.quotes} />

      {/* Akreditasyon monogram seridi (hover'da tam ad) */}
      <div className="mt-16 flex flex-wrap items-center justify-center gap-x-10 gap-y-5 opacity-50">
        {ACCREDS.map((a) => (
          <Monogram key={a.label} label={a.label} full={a.full} />
        ))}
      </div>
    </section>
  );
}

// Sayi animasyonu: gorunur olunca gsap sayaci 0'dan hedefe kosar; JS oncesi
// statik hedef deger render edilir (screenshot-safe, opacity oyunu yok).
function Metric({ value, suffix, label, Icon }: { value: number; suffix: string; label: string; Icon?: LucideIcon }) {
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
      {Icon && (
        <Icon
          aria-hidden
          className="mx-auto mb-2 h-5 w-5 text-[var(--aura-accent)]"
          strokeWidth={2}
        />
      )}
      <p className="aura-display text-5xl font-bold leading-none tracking-tighter md:text-7xl">
        <span ref={numRef}>{Number.isInteger(value) ? value : value.toFixed(1)}</span>
        {suffix}
      </p>
      <p className="mt-2 text-sm text-[var(--aura-grey)]">{label}</p>
    </div>
  );
}

// Donen alinti: gorunur alintı 5.5 sn'de bir degisir (reduced-motion'da sabit;
// nokta gostergesinden elle secilir). Alinti degisimi anlik (screenshot-safe).
function QuoteCarousel({ quotes }: { quotes: { quote: string; name: string; role: string }[] }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || quotes.length < 2) return;
    const id = setInterval(() => setI((p) => (p + 1) % quotes.length), 5500);
    return () => clearInterval(id);
  }, [quotes.length]);

  const q = quotes[Math.min(i, quotes.length - 1)];
  if (!q) return null;

  return (
    <figure className="mx-auto mt-16 max-w-3xl text-center">
      <blockquote key={i} className="aura-display text-2xl font-bold leading-snug tracking-tight md:text-3xl">
        <span aria-hidden className="text-[var(--aura-accent)]">
          “
        </span>
        {q.quote}
        <span aria-hidden className="text-[var(--aura-accent)]">
          ”
        </span>
      </blockquote>
      <figcaption className="mt-5 text-sm text-[var(--aura-grey)]">
        <span className="font-medium text-[var(--aura-ink)]">{q.name}</span>
        {" · "}
        {q.role}
      </figcaption>
      {quotes.length > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          {quotes.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setI(idx)}
              aria-label={`${idx + 1} / ${quotes.length}`}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: idx === i ? 22 : 6,
                background: "var(--aura-accent)",
                opacity: idx === i ? 1 : 0.35,
              }}
            />
          ))}
        </div>
      )}
    </figure>
  );
}

function Monogram({ label, full }: { label: string; full: string }) {
  const w = Math.max(64, label.length * 13 + 26);
  return (
    <svg
      role="img"
      aria-label={full}
      width={w}
      height="28"
      viewBox={`0 0 ${w} 28`}
      className="text-[var(--aura-grey)]"
    >
      <title>{full}</title>
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
