"use client";

// Ortak hasta yolu intake kabuğu — 4 yolun (triyaj / ikinci görüş / sağlık turizmi / ücretsiz
// sağlık) giriş ekranları aynı çerçeveyi paylaşır: eyebrow pill (yol ikonu + adı) + h1 + intro +
// ortak LangSelect (sağ üst) + tek genişlik/renk. Gövde (form/adımlar) children olarak gelir.
// Çeviri caller'da yapılır (t()); kabuk yalnız sunumdur. dir (RTL) lang'den türetilir.
import type { LucideIcon } from "lucide-react";
import { LangSelect } from "@/components/LangSelect";
import { JourneyStageRail } from "@/components/JourneyStageRail";
import { langDir } from "@/lib/constants";
import type { JourneyKey } from "@/lib/journey-stages";

type Props = {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  intro?: string;
  lang: string;
  onLangChange: (l: string) => void;
  wide?: boolean; // özet-panelli yollar (turizm) için geniş kolon
  journey?: JourneyKey; // sahne rayı için yol kimliği
  stage?: number; // bulunulan sahne (0-index)
  children: React.ReactNode;
};

export function JourneyIntakeShell({ icon: Icon, eyebrow, title, intro, lang, onLangChange, wide, journey, stage, children }: Props) {
  return (
    <div dir={langDir(lang)} className={`mx-auto ${wide ? "max-w-5xl" : "max-w-2xl"} px-5 py-10`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-[#28C8D8]/10 px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#17919E]">
            <Icon size={14} /> {eyebrow}
          </span>
          <h1 className="mt-3 text-2xl font-bold text-[#0D0E10]">{title}</h1>
          {intro && <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{intro}</p>}
        </div>
        <LangSelect lang={lang} onChange={onLangChange} />
      </div>
      {journey != null && stage != null && <JourneyStageRail journey={journey} current={stage} lang={lang} />}
      {children}
    </div>
  );
}
