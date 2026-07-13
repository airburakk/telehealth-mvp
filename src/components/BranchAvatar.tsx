"use client";

// Küçük branş amblemi — liste kartları / satır başları için (yalnız SVG sembol + renk halesi).
// Görsel kimliği olmayan/çözülemeyen branşta hiç render edilmez (hasBranchVisual guard).

import { branchColor, branchSymbolSrc, hasBranchVisual } from "@/lib/branch-visuals";

export function BranchAvatar({
  branchKey,
  size = 32,
  className = "",
}: {
  branchKey?: string | null;
  size?: number;
  className?: string;
}) {
  if (!hasBranchVisual(branchKey)) return null;
  const color = branchColor(branchKey);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={branchSymbolSrc(branchKey as string)}
      alt=""
      aria-hidden
      className={`shrink-0 rounded-lg ring-1 ring-white/10 ${className}`}
      style={{ width: size, height: size, background: "#0D0E10", boxShadow: `0 0 14px -7px ${color}` }}
    />
  );
}
