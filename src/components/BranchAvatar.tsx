"use client";

// Küçük branş amblemi — beyaz daire + branş renginde lucide ikon. (Higgsfield SVG'leri kendi koyu
// zeminlerini taşıyordu → beyaz zeminde "koyu kutu / beyaz boşluk" oluyordu; lucide inline-SVG rengi
// prop'tan aldığı için her zeminde temiz + net.) Branş→ikon eşlemesi anlam-bazlı, eşleşmeyen Stethoscope.
import { branchColor, hasBranchVisual, resolveBranchKey } from "@/lib/branch-visuals";
import {
  HeartPulse, Brain, Bone, Eye, Ear, Baby, Activity, Stethoscope, Droplet, Wind, Bug,
  Sparkles, Smile, Scissors, Ribbon, Zap, type LucideIcon,
} from "lucide-react";
import { createElement } from "react";

const ICONS: Record<string, LucideIcon> = {
  kardiyoloji: HeartPulse, kvc: HeartPulse, "organ-nakli": HeartPulse,
  onkoloji: Ribbon, "radyasyon-onkolojisi": Zap, hematoloji: Droplet,
  ortopedi: Bone, romatoloji: Bone, "fizik-tedavi": Activity,
  norosirurji: Brain, noroloji: Brain, psikiyatri: Brain,
  "sac-ekimi": Sparkles, estetik: Sparkles, dermatoloji: Sparkles,
  ivf: Baby, "kadin-dogum": Baby, "cocuk-sagligi": Baby,
  dis: Smile, goz: Eye, kbb: Ear,
  "genel-cerrahi": Scissors, "gogus-cerrahisi": Scissors,
  dahiliye: Stethoscope, endokrinoloji: Activity, gastroenteroloji: Activity,
  nefroloji: Droplet, uroloji: Droplet,
  "gogus-hastaliklari": Wind, enfeksiyon: Bug,
};

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
  const color = branchColor(branchKey);
  const Icon = (key && ICONS[key]) || Stethoscope;
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
