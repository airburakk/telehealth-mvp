"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Doctorium ürün düğmesi — V3 landing'in "A · Yükselme" giysisi (kullanıcı kararı 2026-08-26,
// buttonVariants: src/components/aura/doctorium-v3/ui/button.tsx) portala taşındı (2026-08-27,
// "landing'e yaptığımız değişiklikleri tüm siteye yap"). Landing'in --dl-* token'ları burada
// YOK (yalnız doctorium-v3 kapsamında tanımlı) → renkler .doctorium-scope token'larına
// (globals.css) veya V3'ün AYNI GEREKÇEYLE sabitlediği emerald'a bağlanır (iki temada da AA;
// bkz. button.tsx satır 21-22 yorumu — CSS değişkeni kullanma, kontrast temaya göre kayar).
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold",
    "transition-[transform,box-shadow,background-color,border-color,color] duration-250 ease-[cubic-bezier(.32,.72,0,1)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#065f46] focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-none motion-reduce:active:scale-100",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: [
          "bg-[#065f46] text-white",
          "hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-8px_rgba(6,95,70,.38),0_3px_8px_-3px_rgba(6,95,70,.25)]",
          "active:translate-y-0 active:scale-[.98] active:bg-[#054d39] active:shadow-[0_2px_6px_-2px_rgba(6,95,70,.3)]",
        ].join(" "),
        secondary: [
          "border border-[var(--c-hairline)] text-[var(--c-ink)]",
          "hover:-translate-y-0.5 hover:border-[rgba(24,24,27,.26)] hover:shadow-[0_10px_22px_-10px_rgba(24,24,27,.15)]",
          "active:translate-y-0 active:scale-[.98] active:shadow-none",
        ].join(" "),
        ghost: "text-[var(--c-ink)] hover:bg-[var(--c-surface-2)] active:scale-[.98]",
      },
      size: {
        md: "min-h-[44px] px-5",
        sm: "min-h-[36px] px-4 text-[13px]",
      },
    },
    defaultVariants: { variant: "secondary", size: "sm" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export function ButtonLink({
  href, variant, size, children, className,
}: {
  href: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant, size }), className)}>
      {children}
    </Link>
  );
}

export { buttonVariants };
