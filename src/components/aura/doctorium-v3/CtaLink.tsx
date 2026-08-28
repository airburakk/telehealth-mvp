"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { LandingEventName, LandingPlacement } from "@/lib/doctorium-landing/events";
import { track } from "./track";
import { buttonVariants } from "./ui/button";

// V3 CTA bağlantısı — v2 CtaLink'in analytics sözleşmesi (track event/placement) AYNEN, giysi
// "A · Yükselme" (ui/button.tsx buttonVariants — tek giysi kaynağı). v2'nin şerit-dolgu + ok
// kayması dili KULLANILMAZ (kullanıcı 2026-08-26: mevcut efektler beğenilmedi → 4 seçenekten A).
// İstemci bileşeni: tek nedeni tıklama event'i; çocuklar sunucuda render edilip geçirilir.
export function CtaLink({
  href, variant = "secondary", event, placement, children, className = "",
}: {
  href: string;
  variant?: "primary" | "secondary";
  event?: LandingEventName;
  placement?: LandingPlacement;
  children: ReactNode;
  className?: string;
}) {
  const cls = `${buttonVariants({ variant })} min-h-[48px] px-6 text-base ${className}`.trim();
  const onClick = event && placement ? () => track(event, placement) : undefined;
  if (href.startsWith("#")) {
    return <a href={href} onClick={onClick} className={cls}>{children}</a>;
  }
  return <Link href={href} onClick={onClick} className={cls}>{children}</Link>;
}
