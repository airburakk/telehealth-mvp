"use client";

// Kulvara göre sahne rayı — 4 intake ekranının kabuğunda ortak ilerleme göstergesi.
// Sahne dizisi yola göre değişir (v5.8: "Seçim" yok, K1'de ödeme önde, SO tek oturum).
// current = bulunulan sahne (0-index). N/A sahneler (yola göre) soluk + üstü çizili.
// Kendi useT'siyle çeviri yönetir (self-contained); kabuk yalnız journey + stage geçer.
import { useMemo } from "react";
import { useT } from "@/components/useT";
import { JOURNEY_STAGES, JOURNEY_SKIP_STAGES, type JourneyKey } from "@/lib/journey-stages";

export function JourneyStageRail({ journey, current, lang }: { journey: JourneyKey; current: number; lang: string }) {
  const stages = JOURNEY_STAGES[journey];
  const texts = useMemo(() => [...stages], [stages]);
  const { t } = useT(lang, texts);
  const skip = JOURNEY_SKIP_STAGES[journey];

  return (
    <ol aria-label={t("Yolculuk aşamaları")} className="mt-4 flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
      {stages.map((label, i) => {
        const na = skip.includes(i);
        const done = i < current && !na;
        const isCurrent = i === current;
        return (
          <li key={label} className="flex shrink-0 items-center gap-1">
            <span
              className={[
                "grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold",
                isCurrent
                  ? "bg-[var(--c-accent)] text-[var(--c-bg)]"
                  : done
                    ? "bg-[var(--c-accent)]/20 text-[var(--c-accent-stronger)]"
                    : na
                      ? "border border-dashed border-[var(--c-hairline)] text-[var(--c-ink-3)]"
                      : "bg-[var(--c-ink)]/10 text-[var(--c-ink-3)]",
              ].join(" ")}
              aria-current={isCurrent ? "step" : undefined}
            >
              {i + 1}
            </span>
            <span
              className={
                isCurrent
                  ? "whitespace-nowrap font-semibold text-[var(--c-ink)]"
                  : na
                    ? "whitespace-nowrap text-[var(--c-ink-3)] line-through"
                    : "whitespace-nowrap text-[var(--c-ink-3)]"
              }
            >
              {t(label)}
            </span>
            {i < stages.length - 1 && <span className="mx-0.5 h-px w-3 shrink-0 bg-[var(--c-ink)]/15" />}
          </li>
        );
      })}
    </ol>
  );
}
