import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// V3 düğme giysisi — etkileşim dili "A · Yükselme" (kullanıcı seçimi 2026-08-26, 4 seçenekli
// GIF demosundan): hover'da 2px kalkış + yumuşak geniş gölge, basınca yerine oturup %98'e iner.
// Geçiş 250ms [0.32,0.72,0,1] (brief); reduced-motion'da transform/gölge oynamaz, yalnız renk
// geçişi kalır. Koyu zeminde (hero video) gölge görünmez ama kalkış hissi korunur — bilinçli.
// shadcn deseni (cva variant/size); Radix'siz — landing'de yalnız düğme/bağlantı var.
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold",
    "transition-[transform,box-shadow,background-color,border-color,color] duration-250 ease-[cubic-bezier(.32,.72,0,1)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dl-emerald)] focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-none motion-reduce:active:scale-100",
  ].join(" "),
  {
    variants: {
      variant: {
        // 🪤 var(--dl-emerald) KULLANMA: koyu bölümde #34d399 çözülür, beyaz metin AA düşer
        // (ölçüldü, ilk önizleme). Sabit koyu zümrüt iki temada da AA.
        primary: [
          "bg-[#065f46] text-white",
          "hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-8px_rgba(6,95,70,.38),0_3px_8px_-3px_rgba(6,95,70,.25)]",
          "active:translate-y-0 active:scale-[.98] active:bg-[#054d39] active:shadow-[0_2px_6px_-2px_rgba(6,95,70,.3)]",
        ].join(" "),
        secondary: [
          "border border-[var(--dl-line)] text-[var(--dl-ink)]",
          "hover:-translate-y-0.5 hover:border-[rgba(24,24,27,.26)] hover:shadow-[0_10px_22px_-10px_rgba(24,24,27,.22)]",
          "active:translate-y-0 active:scale-[.98] active:shadow-none",
        ].join(" "),
        ghost: "text-[var(--dl-ink)] hover:bg-[var(--dl-panel)] active:scale-[.98]",
      },
      size: {
        md: "min-h-[44px] px-5",
        sm: "min-h-[36px] px-4 text-[13px]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
