"use client";

// Küçük branş amblemi — beyaz daire + branş renginde lucide ikon (diş hariç: lucide'de diş
// ikonu yok → lucide çizim diliyle uyumlu özel inline SVG). Branş→ikon eşlemesi anlam-bazlı
// ve 30 branşta BENZERSİZ (2026-07-14 revizyonu: Bone/Scissors/Sparkles/Baby/Droplet/Brain/
// HeartPulse tekrarları ayrıştırıldı → sıfır çakışma); eşleşmeyen Stethoscope'a düşer.
import { branchColor, hasBranchVisual, resolveBranchKey } from "@/lib/branch-visuals";
import {
  HeartPulse, Heart, Brain, BrainCog, PersonStanding, Hand, Slice, ScanHeart,
  Dna, Venus, Crown, ScanFace, Layers, HandHeart, MessageCircleHeart, Utensils,
  Atom, Filter, Droplets, Droplet, Eye, Ear, Baby, Activity, Stethoscope,
  Wind, Bug, Ribbon, Zap, type LucideIcon,
} from "lucide-react";
import { createElement, type FC } from "react";

// Diş: lucide'de diş/tooth ikonu yok → 24×24 stroke + round diliyle uyumlu özel amblem;
// LucideIcon gibi size/color/strokeWidth alır, ICONS'ta lucide ikonlarla yan yana durur.
type IconProps = { size?: number; color?: string; strokeWidth?: number };
function ToothIcon({ size = 24, color = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8.5 3.2C6.5 3.2 5 4.8 5 7.3c0 1.6.3 3.2.7 4.7.5 1.9.6 3.8.9 5.7.2 1.3.5 2.9 1.4 2.9.8 0 1-1.4 1.2-2.7.2-1.4.3-3.2.8-3.2s.6 1.8.8 3.2c.2 1.3.4 2.7 1.2 2.7.9 0 1.2-1.6 1.4-2.9.3-1.9.4-3.8.9-5.7.4-1.5.7-3.1.7-4.7 0-2.5-1.5-4.1-3.5-4.1-1.3 0-2 .7-3 .7s-1.7-.7-3-.7z" />
    </svg>
  );
}

type IconLike = LucideIcon | FC<IconProps>;

// Branş→ikon: 30 branş, hepsi benzersiz. Anahtarlar lib/triage BRANCHES.key ile birebir.
const ICONS: Record<string, IconLike> = {
  kardiyoloji: HeartPulse, kvc: Heart, "organ-nakli": HandHeart,
  onkoloji: Ribbon, "radyasyon-onkolojisi": Zap, hematoloji: Droplet,
  ortopedi: PersonStanding, romatoloji: Hand, "fizik-tedavi": Activity,
  norosirurji: BrainCog, noroloji: Brain, psikiyatri: MessageCircleHeart,
  "sac-ekimi": Crown, estetik: ScanFace, dermatoloji: Layers,
  ivf: Dna, "kadin-dogum": Venus, "cocuk-sagligi": Baby,
  dis: ToothIcon, goz: Eye, kbb: Ear,
  "genel-cerrahi": Slice, "gogus-cerrahisi": ScanHeart,
  dahiliye: Stethoscope, endokrinoloji: Atom, gastroenteroloji: Utensils,
  nefroloji: Filter, uroloji: Droplets,
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
  const Icon: IconLike = (key && ICONS[key]) || Stethoscope;
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
