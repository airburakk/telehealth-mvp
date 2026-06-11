// portamed logosu — "o" yerine portal halkası (spec: design_handoff_portamed_landing/README.md)
// Landing + iç uygulama Header'ı ortak kullanır.
import { Hanken_Grotesk } from "next/font/google";

const logoFont = Hanken_Grotesk({ subsets: ["latin", "latin-ext"], weight: ["700"] });

export function PortamedLogo({ size = 24, ink = "#14211F" }: { size?: number; ink?: string }) {
  return (
    <span className={`${logoFont.className} inline-flex items-center font-bold`} style={{ fontSize: size, letterSpacing: "-0.035em", color: ink, lineHeight: 1 }}>
      <span>p</span>
      <svg viewBox="0 0 52 76" style={{ height: size * 0.92, margin: "0 0.5px" }} aria-hidden>
        <ellipse cx="26" cy="38" rx="16" ry="27" transform="rotate(-18 26 38)" fill="none" stroke="#0E9E97" strokeWidth="8" strokeLinecap="round" />
      </svg>
      <span>rta<span style={{ color: "#0E9E97" }}>med</span></span>
    </span>
  );
}
