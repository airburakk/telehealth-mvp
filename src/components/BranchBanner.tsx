"use client";

// Branş görsel kimliği bandı — hasta bir branşa yönlendiğinde/geçtiğinde gösterilir.
// Atmosferik banner (branş renginden türetilen CSS gradyan) + lucide branş amblemi + semantik renk.
// Amblem, vaka listesiyle (MyCasesList) TEK TİP olsun diye BranchAvatar'dır (lucide ikon); eski
// Higgsfield SVG sembolü kaldırıldı (2026-07-13, kullanıcı isteği — liste ikon/detay sembol tutarsızlığı).
// Görsel kimliği olmayan branşta hiç render edilmez (hasBranchVisual guard); 30 branşın tamamı hazır.

import { branchColor, branchBannerBg, hasBranchVisual } from "@/lib/branch-visuals";
import { BranchAvatar } from "@/components/BranchAvatar";

export function BranchBanner({
  branchKey,
  branchLabel,
  eyebrow,
  className = "",
}: {
  branchKey: string;
  branchLabel: string;   // çağıran çevrilmiş etiketi geçirir (t(b.label))
  eyebrow: string;       // çevrilmiş üst etiket (ör. t("Branşınız"))
  className?: string;
}) {
  if (!hasBranchVisual(branchKey)) return null;
  const color = branchColor(branchKey);
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-[var(--c-hairline)] ${className}`}
      style={{ minHeight: 128, background: branchBannerBg(branchKey) }}
    >
      <div className="relative flex items-center gap-4 p-5">
        <BranchAvatar branchKey={branchKey} size={64} />
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color }}>{eyebrow}</div>
          <div className="mt-0.5 text-lg font-bold leading-tight text-[var(--c-ink)] sm:text-xl">{branchLabel}</div>
        </div>
      </div>
      {/* Marka şeridi — branş rengi */}
      <div className="absolute inset-x-0 bottom-0 h-1" style={{ background: color }} />
    </div>
  );
}
