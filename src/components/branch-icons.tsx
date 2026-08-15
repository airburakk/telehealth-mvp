// Branş → ikon eşlemesi — AURA'nın KANONİK branş sembolleri (BranchAvatar'dan çıkarıldı,
// v6.99.3 2026-08-16): hem client (BranchAvatar) hem server (Doctorium CoverArt) tüketir.
// ⚠️ "use client" YOK — bilinçli: client-işaretli modülden veri/bileşen import etmek server
// component'te client-reference üretir (hafıza: rsc-client-module-data-export); paylaşılan
// sabit bu yüzden direktifsiz dosyada yaşar. Lucide ikonları her iki tarafta da render edilir.
//
// Eşleme anlam-bazlı ve 30 branşta BENZERSİZ (2026-07-14 revizyonu: Bone/Scissors/Sparkles/
// Baby/Droplet/Brain/HeartPulse tekrarları ayrıştırıldı → sıfır çakışma); eşleşmeyen
// Stethoscope'a düşer. Diş: lucide'de diş ikonu yok → çizim diliyle uyumlu özel SVG.
import {
  HeartPulse, Heart, Brain, BrainCog, PersonStanding, Hand, Slice, ScanHeart,
  Dna, Venus, Crown, ScanFace, Layers, HandHeart, MessageCircleHeart, Utensils,
  Atom, Filter, Droplets, Droplet, Eye, Ear, Baby, Activity, Stethoscope,
  Wind, Bug, Ribbon, Zap, type LucideIcon,
} from "lucide-react";
import type { FC } from "react";

export type BranchIconProps = { size?: number; color?: string; strokeWidth?: number };
export type BranchIconLike = LucideIcon | FC<BranchIconProps>;

/** Diş amblemi — 24×24, stroke + round (lucide diliyle uyumlu); size/color/strokeWidth alır. */
export function ToothIcon({ size = 24, color = "currentColor", strokeWidth = 2 }: BranchIconProps) {
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

/** Branş KEY (lib/triage BRANCHES.key) → ikon. 30 branş, hepsi benzersiz. */
export const BRANCH_ICONS: Record<string, BranchIconLike> = {
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
