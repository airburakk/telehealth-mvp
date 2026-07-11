"use client";

// Yeknesak 6-sahne rayı — 4 intake ekranının kabuğunda ortak ilerleme göstergesi.
// current = bulunulan sahne (0-index). N/A sahneler (yola göre) soluk + üstü çizili.
// Kendi useT'siyle çeviri yönetir (self-contained); kabuk yalnız journey + stage geçer.
import { useMemo } from "react";
import { useT } from "@/components/useT";
import { JOURNEY_STAGES, JOURNEY_SKIP_STAGES, type JourneyKey } from "@/lib/journey-stages";

export function JourneyStageRail({ journey, current, lang }: { journey: JourneyKey; current: number; lang: string }) {
  const texts = useMemo(() => [...JOURNEY_STAGES], []);
  const { t } = useT(lang, texts);
  const skip = JOURNEY_SKIP_STAGES[journey];

  return (
    <ol aria-label={t("Yolculuk aşamaları")} className="mt-4 flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
      {JOURNEY_STAGES.map((label, i) => {
        const na = skip.includes(i);
        const done = i < current && !na;
        const isCurrent = i === current;
        return (
          <li key={label} className="flex shrink-0 items-center gap-1">
            <span
              className={[
                "grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold",
                isCurrent
                  ? "bg-[#28C8D8] text-[#0D0E10]"
                  : done
                    ? "bg-[#28C8D8]/20 text-[#17919E]"
                    : na
                      ? "border border-dashed border-white/15 text-white/25"
                      : "bg-white/10 text-white/40",
              ].join(" ")}
              aria-current={isCurrent ? "step" : undefined}
            >
              {i + 1}
            </span>
            <span
              className={
                isCurrent
                  ? "whitespace-nowrap font-semibold text-[#F4F5F3]"
                  : na
                    ? "whitespace-nowrap text-white/25 line-through"
                    : "whitespace-nowrap text-white/40"
              }
            >
              {t(label)}
            </span>
            {i < JOURNEY_STAGES.length - 1 && <span className="mx-0.5 h-px w-3 shrink-0 bg-white/15" />}
          </li>
        );
      })}
    </ol>
  );
}
