import type { ReactNode } from "react";
import { DOCTORIUM_PALETTE } from "@/components/aura/doctorium-brand";
import { chapterNo, type SectionCopy } from "@/lib/doctorium-landing/content";
import { Rich } from "../doctorium-v2/rich-text";
import { V3_LIGHT } from "./palette";
import { v3Theme } from "./theme";

// V3 yapı taşları. Tek font ailesi (brief kararı): globals.css body zaten --aura-font-sans
// (Inter) miras verir — v2'nin aksine buradaki hiçbir bileşen `aura-display`/`aura-mono`
// class'ını KULLANMAZ, hiyerarşi yalnız font-weight (400/500/600) + boyutla kurulur. Bu, kök
// layout'a (AURA dahil site geneli) dokunmadan Doctorium'u Inter-tek yapmanın yolu.
//
// 🪤 "dark" için style:undefined BIRAKMA — kök konteynerin varsayılanı (V3_LIGHT) miras alınır
// ve Hero yanlışlıkla açık zemine döner (ölçüldü). Koyu bölüm DOCTORIUM_PALETTE'i EXPLICIT alır.
const THEME_STYLE = { light: V3_LIGHT, dark: DOCTORIUM_PALETTE } as const;

export function LandingSection({
  copy, children, className = "", padded = true, tone,
}: { copy: SectionCopy; children: ReactNode; className?: string; padded?: boolean; tone?: "bg" | "panel" | "alt" }) {
  const theme = v3Theme(copy.id);
  const no = chapterNo(copy.id);
  // 🪤 tone için iki bg-* class'ı YAN YANA yazma (Tailwind'de kazanan class sırası değil stylesheet
  // sırasıdır) — tek class koşullu seçilir. "panel" = zebra'sız dünyada vurgu bandı (koyu yerine
  // bir ton gri; yalnız manifesto gibi tekil duraklarda, EXPLICIT verilir). Verilmezse (2026-08-27,
  // "bölümler ayrışmıyor" bulgusu) çift numaraya göre bg/--dl-alt OTOMATİK alternans — --dl-panel'le
  // KARIŞTIRMA: o kart/rozet zemini, bu yalnız bölüm zebrası (bkz. palette.ts).
  const autoAlt = Number(no) % 2 === 0;
  const resolvedTone = tone ?? (autoAlt ? "alt" : "bg");
  const bg = resolvedTone === "panel" ? "bg-[var(--dl-panel)]" : resolvedTone === "alt" ? "bg-[var(--dl-alt)]" : "bg-[var(--dl-bg)]";
  return (
    <section
      id={copy.anchor ?? copy.id}
      data-section={copy.id}
      data-v3-theme={theme}
      style={THEME_STYLE[theme]}
      className={`scroll-mt-4 border-t border-[var(--dl-line)] ${bg} text-[var(--dl-ink)] md:scroll-mt-24 ${className}`}
    >
      <div className={`mx-auto w-full max-w-6xl px-5 ${padded ? "py-20 lg:py-28" : ""}`}>
        <div aria-hidden className="mb-5 flex items-center gap-2.5">
          <span className="text-[12px] font-bold tracking-[0.06em] text-[var(--dl-emerald)]">{no}</span>
          <span className="h-px w-7 bg-[var(--dl-emerald)] opacity-40" />
        </div>
        {children}
      </div>
    </section>
  );
}

// Mono değil — v2'nin "durak dili" burada normal ağırlıkta küçük harf takip eder (tek font
// kararıyla tutarlı); ayrım artık harf aralığı + renkle.
export function Eyebrow({ children, color = "var(--dl-emerald)" }: { children: ReactNode; color?: string }) {
  return (
    <div className="text-[13px] font-semibold tracking-[0.02em]" style={{ color }}>
      {children}
    </div>
  );
}

export function SectionHead({ copy, align = "left", size = "md" }: { copy: SectionCopy; align?: "left" | "center"; size?: "md" | "lg" }) {
  const h = size === "lg"
    ? "text-[clamp(36px,5.4vw,64px)] leading-[1.05]"
    : "text-[clamp(30px,4.4vw,52px)] leading-[1.08]";
  return (
    <div className={align === "center" ? "mx-auto max-w-[850px] text-center" : "max-w-[760px]"}>
      {copy.eyebrow && <Eyebrow><Rich text={copy.eyebrow} /></Eyebrow>}
      <h2 className={`mt-3 font-medium tracking-[-0.02em] ${h}`}>
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

export function Note({ text, className = "" }: { text: string; className?: string }) {
  return (
    <p className={`border-l-2 border-[var(--dl-emerald)] pl-4 text-[13px] leading-relaxed text-[var(--dl-muted)] ${className}`}>
      <Rich text={text} />
    </p>
  );
}
