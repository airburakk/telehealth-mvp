import type { CSSProperties, ReactNode } from "react";
import type { SectionCopy, SectionTheme } from "@/lib/doctorium-landing/content";
import { DOCTORIUM_DEEP, DOCTORIUM_LIGHT } from "./palette";
import { Rich } from "./rich-text";

// V2 landing yapı taşları (sunucu). Bölüm sözleşmesi: bir viewport = bir fikir; bölüm kendi
// paletini style ile alır (tema toggle'ına bağlı DEĞİL — landing sözleşmesi, v6.100.1), çapası
// content.ts'ten gelir, data-section analytics section_view için.

const THEME_STYLE: Record<SectionTheme, CSSProperties | undefined> = {
  dark: undefined,
  deep: DOCTORIUM_DEEP,
  light: DOCTORIUM_LIGHT,
};

export function LandingSection({
  copy, children, className = "", padded = true,
}: { copy: SectionCopy; children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section
      id={copy.anchor ?? copy.id}
      data-section={copy.id}
      style={THEME_STYLE[copy.theme]}
      className={`scroll-mt-20 bg-[var(--dl-bg)] text-[var(--dl-ink)] ${className}`}
    >
      <div className={`mx-auto w-full max-w-6xl px-5 ${padded ? "py-20 lg:py-28" : ""}`}>{children}</div>
    </section>
  );
}

// Mono mikro etiket — landing'in durak dili (v1 Eyebrow). caps=false: "Doctorium" geçen
// etiketlerde marka yazımı korunur (kullanıcı kuralı: D büyük kalanlar küçük, UPPERCASE yok).
export function Eyebrow({ children, color = "var(--dl-emerald)", caps = true }: { children: ReactNode; color?: string; caps?: boolean }) {
  return (
    <div className={`aura-mono text-[11px] font-semibold ${caps ? "uppercase tracking-[0.2em]" : "tracking-[0.14em]"}`} style={{ color }}>
      {children}
    </div>
  );
}

/** Bölüm başlığı bloğu: eyebrow + h2 + lead/body. Eyebrow'da marka geçiyorsa caps kapanır. */
export function SectionHead({ copy, align = "left", size = "md" }: { copy: SectionCopy; align?: "left" | "center"; size?: "md" | "lg" }) {
  const h = size === "lg"
    ? "text-[clamp(36px,5.4vw,64px)] leading-[1.02]"
    : "text-[clamp(30px,4.4vw,52px)] leading-[1.04]";
  return (
    <div className={align === "center" ? "mx-auto max-w-[850px] text-center" : "max-w-[760px]"}>
      {copy.eyebrow && (
        <Eyebrow caps={!copy.eyebrow.includes("{Doctorium}")}><Rich text={copy.eyebrow} /></Eyebrow>
      )}
      <h2 className={`aura-display mt-3 font-medium tracking-tight ${h}`}>
        <Rich text={copy.title} />
      </h2>
      {copy.lead && (
        <p className="mt-5 text-[19px] leading-relaxed text-[var(--dl-body)]"><Rich text={copy.lead} /></p>
      )}
      {copy.body && (
        <p className={`${copy.lead ? "mt-3" : "mt-5"} max-w-[640px] text-[17px] leading-relaxed text-[var(--dl-body)] ${align === "center" ? "mx-auto" : ""}`}>
          <Rich text={copy.body} />
        </p>
      )}
    </div>
  );
}

/** Güven/sınır cümlesi — sol ince zümrüt çizgi, küçük punto. */
export function Note({ text, className = "" }: { text: string; className?: string }) {
  return (
    <p className={`border-l-2 border-[var(--dl-emerald)] pl-4 text-[13px] leading-relaxed text-[var(--dl-muted)] ${className}`}>
      <Rich text={text} />
    </p>
  );
}
