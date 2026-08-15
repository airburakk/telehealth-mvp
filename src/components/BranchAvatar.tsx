"use client";

// Küçük branş amblemi — beyaz daire + branş renginde lucide ikon. Branş→ikon eşlemesi
// v6.99.3'te src/components/branch-icons.tsx'e taşındı (Doctorium CoverArt de aynı sembolleri
// kullanır — kullanıcı kararı 2026-08-16: "AURA'da kullandığımız branş sembolleri" = bu set).
import { branchColor, hasBranchVisual, resolveBranchKey } from "@/lib/branch-visuals";
import { Stethoscope } from "lucide-react";
import { createElement } from "react";
import { BRANCH_ICONS, type BranchIconLike } from "./branch-icons";

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
  const key = resolveBranchKey(branchKey);
  const Icon: BranchIconLike = (key && BRANCH_ICONS[key]) || Stethoscope;
  const color = branchColor(branchKey);
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-[10px] ${className}`}
      style={{ width: size, height: size, background: "#ffffff", boxShadow: `0 1px 4px ${color}45, inset 0 0 0 1px ${color}2e` }}
    >
      {createElement(Icon, { size: Math.round(size * 0.56), color, strokeWidth: 2.3 })}
    </span>
  );
}
