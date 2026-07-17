import type { ReactNode } from "react";

// Aura UI kiti (Faz 0, 2026-07-17 — Doz 1 "Sakin Premium", kullanıcı onaylı /kit-onizleme):
// landing'in "mono durak" dili iç yüzeyde. SectionLabel = JetBrains Mono mikro etiket;
// InfoField = etiket + değer çifti (detay ızgaralarının ortak deseni). Işıma YOK.

export function SectionLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`aura-mono text-[11px] uppercase tracking-[0.2em] text-[var(--c-ink-3)] ${className}`}>
      {children}
    </div>
  );
}

export function InfoField({ k, v, accent }: { k: ReactNode; v: ReactNode; accent?: boolean }) {
  return (
    <div>
      <SectionLabel>{k}</SectionLabel>
      <div className={`mt-1 text-[15px] ${accent ? "font-medium text-[var(--c-accent)]" : "text-[var(--c-ink)]"}`}>{v}</div>
    </div>
  );
}
