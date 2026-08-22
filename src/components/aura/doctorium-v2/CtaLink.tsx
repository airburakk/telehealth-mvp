"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import type { LandingEventName, LandingPlacement } from "@/lib/doctorium-landing/events";
import { track } from "./track";

// Ortak CTA giysisi (v1 hero CTA'sından aynen — 2026-08-18 kullanıcı kararı): kenar şeridi hover'da
// bandı doldurur (opacity 15), ok ileri kayar, düğme sağa ötelenir. primary = zümrüt DOLU (şerit
// koyu), secondary = kenarlıklı (şerit emerald token'ı → LIGHT bölümde #047857'e bağlanır).
// 🪤 Dolgu span'i absolute: metin ve ok `relative` olmak ZORUNDA.
// İstemci bileşeni: tek nedeni tıklama event'i (track). Çocuklar sunucuda render edilip geçirilir.
export function CtaLink({
  href, variant = "secondary", event, placement, children, className = "", arrow = true,
}: {
  href: string;
  variant?: "primary" | "secondary";
  event?: LandingEventName;
  placement?: LandingPlacement;
  children: ReactNode;
  className?: string;
  arrow?: boolean;
}) {
  const base =
    "group relative inline-flex min-h-[48px] items-center justify-center gap-2 overflow-hidden rounded-xl px-6 text-base font-semibold transition-transform duration-200 hover:translate-x-1 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--dl-bg)] motion-reduce:transition-none motion-reduce:hover:translate-x-0";
  // primary = KOYU zümrüt dolgu + beyaz metin (v6.136 kontrast kararı; lockup DoctoriumOnEmerald).
  const skin = variant === "primary"
    ? "bg-[#065f46] text-white focus-visible:ring-[#34d399]"
    : "border border-[var(--dl-line)] focus-visible:ring-[var(--dl-emerald)]";
  const strip = variant === "primary" ? "bg-[#022c22]" : "bg-[var(--dl-emerald)]";
  const onClick = event && placement ? () => track(event, placement) : undefined;
  const inner = (
    <>
      <span aria-hidden className={`absolute inset-y-0 start-0 w-1 ${strip} transition-all duration-300 group-hover:w-full group-hover:opacity-15 motion-reduce:transition-none`} />
      <span className="relative">{children}</span>
      {arrow && (
        <ArrowRight
          aria-hidden
          size={17}
          className={`relative transition-transform duration-300 group-hover:translate-x-1.5 motion-reduce:transition-none ${variant === "secondary" ? "text-[var(--dl-emerald)]" : ""}`}
        />
      )}
    </>
  );
  if (href.startsWith("#")) {
    return <a href={href} onClick={onClick} className={`${base} ${skin} ${className}`}>{inner}</a>;
  }
  return <Link href={href} onClick={onClick} className={`${base} ${skin} ${className}`}>{inner}</Link>;
}
