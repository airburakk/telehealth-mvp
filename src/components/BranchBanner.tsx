"use client";

// Branş görsel kimliği bandı — hasta bir branşa yönlendiğinde/geçtiğinde gösterilir.
// Atmosferik banner (branş renginden türetilen CSS gradyan) + SVG amblem + branşın semantik rengi.
// Görsel kimliği olmayan branşta hiç render edilmez (hasBranchVisual guard); 30 branşın tamamı hazır.

import { branchColor, branchSymbolSrc, branchBannerBg, hasBranchVisual } from "@/lib/branch-visuals";

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
      className={`relative overflow-hidden rounded-2xl border border-white/10 ${className}`}
      style={{ minHeight: 128, background: branchBannerBg(branchKey) }}
    >
      <div className="relative flex items-center gap-4 p-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={branchSymbolSrc(branchKey)}
          alt=""
          aria-hidden
          className="h-16 w-16 shrink-0 rounded-2xl ring-1 ring-white/10"
          style={{ background: "#0D0E10", boxShadow: `0 0 24px -6px ${color}66` }}
        />
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color }}>{eyebrow}</div>
          <div className="mt-0.5 text-lg font-bold leading-tight text-white sm:text-xl">{branchLabel}</div>
        </div>
      </div>
      {/* Marka şeridi — branş rengi */}
      <div className="absolute inset-x-0 bottom-0 h-1" style={{ background: color }} />
    </div>
  );
}
