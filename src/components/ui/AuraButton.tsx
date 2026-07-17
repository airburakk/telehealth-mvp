import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

// Aura UI kiti — buton dili: aura ease/duration geçişi + marka-tutarlı focus halkası
// (landing'in :focus-visible sözleşmesinin iç-yüzey karşılığı, WCAG 2.4.7).
// `danger` yalnız klinik-kritik eylemlerde (tıbbi renk semantiği — DESIGN.md).
// Dokunma hedefi: md ≥44px (py-3 + metin), sm ikincil/yoğun bağlamlar için.

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "sm";

const BASE =
  "inline-flex items-center justify-center gap-2 font-semibold transition-colors duration-200 ease-[cubic-bezier(0.2,0,0,1)] " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-accent)] " +
  "disabled:pointer-events-none disabled:opacity-50";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-[var(--c-accent)] text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)]",
  secondary:
    "border border-[var(--c-hairline)] bg-[var(--c-surface)] text-[var(--c-ink)] hover:border-[var(--c-accent)]/50 hover:text-[var(--c-accent)]",
  ghost: "text-[var(--c-ink-2)] hover:bg-[var(--c-surface)] hover:text-[var(--c-accent)]",
  danger: "bg-[var(--c-danger)] text-white hover:opacity-90",
};

const SIZES: Record<Size, string> = {
  md: "rounded-xl px-5 py-3 text-sm",
  sm: "rounded-lg px-3.5 py-2 text-xs",
};

function cls(variant: Variant, size: Size, className: string) {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
}

export function AuraButton({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button {...props} className={cls(variant, size, className)} />;
}

export function AuraButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; children: ReactNode }) {
  return (
    <Link {...props} className={cls(variant, size, className)}>
      {children}
    </Link>
  );
}
