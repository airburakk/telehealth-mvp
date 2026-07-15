"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { LINKS, VIDEOS, useLang, type Copy } from "@/lib/aura-landing/i18n";

// prefers-reduced-motion — SSR'da daima false (sunucu bilemez; istemci mount'ta
// düzeltir). useState+useEffect yerine bu: effect içinde senkron setState
// cascading render tetikliyordu (eslint) + tercih canlı değişirse de yakalanır.
const RM_QUERY = "(prefers-reduced-motion: reduce)";
function useReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(RM_QUERY);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(RM_QUERY).matches,
    () => false,
  );
}

type Card = Copy["v2"]["entry"]["cards"][number];

// Kart key'i → hedef rota. copy.ts'te DEĞİL burada: rotalar akış sözleşmesi
// (landing chapters ile birebir aynı hedefler), çeviriye tabi değil.
const HREF: Record<string, string> = {
  consult: "/giris",
  so: LINKS.secondOpinion,
  tourism: "/giris",
  freecare: LINKS.freeCare,
};

// Kart key'i → arkada oynayacak kulvar videosu (mevcut landing chapters'ın
// kaynakları). 720p hafif kopya: bu bölümde video TAM GENİŞLİK arka plandır
// ama kartların arkasında ve karartılmış → 1080p'nin bedeli görünmez.
const MEDIA: Record<string, { src: string; poster: string }> = {
  consult: { src: VIDEOS.consult.src720, poster: VIDEOS.consult.poster },
  so: { src: VIDEOS.so.src720, poster: VIDEOS.so.poster },
  tourism: { src: VIDEOS.tourism.src720, poster: VIDEOS.tourism.poster },
  freecare: { src: VIDEOS.freecare.src720, poster: VIDEOS.freecare.poster },
};

// /v2 — "One care journey. Four ways to begin." (blueprint EntryPaths).
//
// KULLANICI KARARI (2026-07-16): chapters'ın 4 kulvar videosu bu bölümün
// ARKASINA gömüldü — hangi kart aktifse o video oynar. Böylece blueprint'in
// kart mimarisi ile v5.9 sinematik katmanı bir arada yaşar (blueprint videoyu
// KASTEN dışarıda bırakmıştı: "review artifact, not a drop-in replacement").
//
// AKTİFLİK: masaüstü hover/focus · her yerde klavye focus · mobil (hover yok)
// IntersectionObserver ile ekranın ortasındaki kart. Kart AÇILMAZ, yalnız
// arka plan değişir → hover tek keşif yolu DEĞİL (wireframe interaction rule:
// "Hover cannot be the only way to reveal explanatory content" — kart metni
// zaten görünür, video yalnız atmosfer).
//
// PERFORMANS: 4 video preload="none" + poster → sayfa açılışında hiçbiri inmez;
// yalnız aktif olan yüklenir/oynar. Diğerleri pause + opacity-0 (DOM'dan
// düşmez ki geri gelince yeniden yüklenmesin).
// REDUCED-MOTION: video hiç oynatılmaz, aktif kartın POSTER'ı gösterilir.
export function V2EntryPaths() {
  const { t } = useLang();
  const e = t.v2.entry;
  const [active, setActive] = useState(0);
  const reduced = useReducedMotion();
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);
  const sectionRef = useRef<HTMLElement>(null);

  // Mobil/dokunmatik: hover yok → ekranın ortasına gelen kart aktif olur.
  // Masaüstünde de zararsız (hover/focus üzerine yazar).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(hover: none)").matches) return;
    const io = new IntersectionObserver(
      (entries) => {
        const best = entries
          .filter((en) => en.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!best) return;
        const i = cardRefs.current.indexOf(best.target as HTMLElement);
        if (i >= 0) setActive(i);
      },
      { threshold: [0.5, 0.75], rootMargin: "-25% 0px -25% 0px" },
    );
    for (const el of cardRefs.current) if (el) io.observe(el);
    return () => io.disconnect();
  }, [e.cards.length]);

  // Aktif video oynasın, diğerleri dursun. Bölüm ekran dışındayken hepsi durur
  // (v6.9 AuraAnimPause ilkesi: ekran dışı hareket = boşa iş).
  useEffect(() => {
    if (reduced) return;
    const section = sectionRef.current;
    if (!section) return;
    let inView = false;

    const sync = () => {
      videoRefs.current.forEach((v, i) => {
        if (!v) return;
        if (i === active && inView && document.visibilityState === "visible") {
          void v.play().catch(() => {});
        } else {
          v.pause();
        }
      });
    };

    const io = new IntersectionObserver(
      (entries) => {
        inView = entries[0]?.isIntersecting ?? false;
        sync();
      },
      { threshold: 0.15 },
    );
    io.observe(section);
    // Arka plan sekmesinde play() reddedilir ve IO bir daha ateşlemeyebilir →
    // sekme görünür olunca yeniden dene (hero.tsx'teki aynı tuzak).
    const onVis = () => sync();
    document.addEventListener("visibilitychange", onVis);
    sync();
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [active, reduced]);

  const activate = useCallback((i: number) => () => setActive(i), []);

  return (
    <section
      ref={sectionRef}
      id="care"
      className="relative isolate overflow-hidden bg-[var(--aura-night)] py-24 md:py-32"
    >
      {/* Arka plan video katmanı — aktif kartın kulvarı. aria-hidden: atmosfer,
          içerik değil; kart metni tek bilgi kaynağı. */}
      <div aria-hidden className="absolute inset-0 -z-10">
        {e.cards.map((c, i) => {
          const m = MEDIA[c.key];
          if (!m) return null;
          return (
            <video
              key={c.key}
              ref={(el) => {
                videoRefs.current[i] = el;
              }}
              src={reduced ? undefined : m.src}
              poster={m.poster}
              muted
              loop
              playsInline
              preload="none"
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
                i === active ? "opacity-100" : "opacity-0"
              }`}
            />
          );
        })}
        {/* Okunurluk skrimi — ⚠️ v6.14.1: ilk sürümde düz /75 perdeydi ve
            kullanıcı "video tam seçilmiyor, çok karartılmış" dedi → /40'a
            açıldı. Kontrastı taşıyan asıl katman KARTLARIN KENDİ zemini
            (panel/85 + backdrop-blur), perde değil; perde yalnız videonun
            parlak karelerinde başlık/intro'yu korur. Daha fazla koyultma
            gerekirse önce kart zeminini artır, perdeyi değil. */}
        <div className="absolute inset-0 bg-[var(--aura-night)]/40" />
        {/* Üst/alt koyu, orta açık: başlık üstte okunur, video ortada görünür,
            alt kenar bir sonraki bölüme yumuşak bağlanır. */}
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--aura-night)] via-[var(--aura-night)]/10 to-[var(--aura-night)]" />
      </div>

      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <p className="aura-mono text-sm text-[var(--aura-accent)]">/ {e.eyebrow}</p>
        <h2 className="aura-display mt-4 max-w-3xl text-3xl font-bold leading-tight tracking-tight text-[var(--aura-ink)] md:text-5xl">
          {e.headline}
        </h2>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--aura-grey)] md:text-lg">
          {e.intro}
        </p>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {e.cards.map((c, i) => (
            <EntryCard
              key={c.key}
              card={c}
              active={i === active}
              onActivate={activate(i)}
              cardRef={(el) => {
                cardRefs.current[i] = el;
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function EntryCard({
  card,
  active,
  onActivate,
  cardRef,
}: {
  card: Card;
  active: boolean;
  onActivate: () => void;
  cardRef: (el: HTMLElement | null) => void;
}) {
  const href = HREF[card.key] ?? "/giris";

  return (
    <article
      ref={cardRef}
      onMouseEnter={onActivate}
      onFocus={onActivate}
      // Kart zemini kontrastı TAŞIYAN katman (perde açıldı, v6.14.1) →
      // backdrop-blur + yüksek opaklık: video ne kadar parlak olursa olsun
      // kart metni okunur kalır. Aktif kart daha opak + turkuaz kenar.
      className={`group flex flex-col rounded-[18px] border p-6 backdrop-blur-md transition-all duration-300 ${
        active
          ? "border-[var(--aura-accent)]/60 bg-[var(--aura-panel)]/90"
          : "border-[var(--aura-hairline)] bg-[var(--aura-panel)]/75"
      }`}
    >
      <p className="aura-mono text-[12px]">
        <span className="aura-badge">{card.n} / 04</span>
      </p>
      <h3 className="aura-display mt-3 text-lg font-bold leading-snug tracking-tight text-[var(--aura-ink)]">
        {card.title}
      </h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--aura-grey)]">{card.body}</p>
      <Link
        href={href}
        className="aura-mono mt-5 inline-flex items-center gap-1.5 text-[12px] text-[var(--aura-accent)] transition-transform duration-200 group-hover:translate-x-0.5"
      >
        {card.cta}
        <span aria-hidden>→</span>
      </Link>
    </article>
  );
}
