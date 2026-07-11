"use client";

import { useMemo } from "react";
import { formatUSD, type InsuranceQuote, type InsuranceLevel } from "@/lib/pricing";
import { ShieldCheck } from "lucide-react";
import { useT } from "@/components/useT";

// M3 — Booking.insuranceDetail (JSON InsuranceQuote) → 3 kademeli sigorta teminat özeti.
// Teklif + rezervasyon sayfalarında ortak kullanılır. Endikatif (bağlayıcı primi sigortacı belirler).
// i18n: lang prop'uyla çevrilir (Faz 3 cilası) — tutarlar cümle SONUNDA/ayraçla durur ki çeviri
// kelime sırası bozulmasın; metinler modül-sabit TEXTS'te ([[uset-unstable-texts-race]]).
const LEVEL_LABEL: Record<InsuranceLevel, string> = {
  1: "Zorunlu Sağlık Turizmi Sigortası",
  2: "+ Operasyon Teminat Poliçesi",
  3: "+ Malpraktis & Komplikasyon Teminatı",
};

const TEXTS = [
  "Sigorta Teminatı", "Seviye",
  "Zorunlu Sağlık Turizmi Sigortası", "+ Operasyon Teminat Poliçesi", "+ Malpraktis & Komplikasyon Teminatı",
  "Zorunlu sağlık turizmi sigortası",
  "Operasyon teminat poliçesi · taban",
  "Malpraktis & komplikasyon · hedef",
  "ek prim yok",
  "Doktorun mevcut MMSS poliçesi hedef teminatı karşılıyor → ek malpraktis primi yok.",
  "Doktorun mevcut MMSS poliçesi:",
  "ek teminatla kapatılan boşluk:",
  "Sigorta toplam",
  "Primler tahminidir; bağlayıcı poliçe bedelini ve teminat şartlarını sigorta şirketi belirler.",
];

export function InsuranceSummary({ detailJson, lang = "Türkçe" }: { detailJson: string | null; lang?: string }) {
  const texts = useMemo(() => TEXTS, []); // sabit referans — useT yarış dersi
  const { t } = useT(lang, texts);

  if (!detailJson) return null;
  let q: InsuranceQuote;
  try { q = JSON.parse(detailJson) as InsuranceQuote; } catch { return null; }
  if (!q || typeof q.level !== "number") return null;

  return (
    <div className="rounded-3xl border border-white/10 bg-[#161719] p-6 shadow-sm">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/50">
        <ShieldCheck size={14} /> {t("Sigorta Teminatı")} · {t("Seviye")} {q.level} — {t(LEVEL_LABEL[q.level])}
      </div>
      <div className="mt-3 space-y-1.5 text-sm">
        <Row k={t("Zorunlu sağlık turizmi sigortası")} v={formatUSD(q.p1)} />
        {q.level >= 2 && (
          <Row k={`${t("Operasyon teminat poliçesi · taban")} ${formatUSD(q.coverageBase)}`} v={`+${formatUSD(q.p2)}`} />
        )}
        {q.level >= 3 && (
          <>
            <Row k={`${t("Malpraktis & komplikasyon · hedef")} ${formatUSD(q.targetCoverage)}`} v={q.p3 > 0 ? `+${formatUSD(q.p3)}` : t("ek prim yok")} />
            <p className="text-[11px] leading-relaxed text-white/60">
              {q.gap === 0
                ? `${t("Doktorun mevcut MMSS poliçesi hedef teminatı karşılıyor → ek malpraktis primi yok.")} (${formatUSD(q.doctorCoverage)})`
                : `${t("Doktorun mevcut MMSS poliçesi:")} ${formatUSD(q.doctorCoverage)} · ${t("ek teminatla kapatılan boşluk:")} ${formatUSD(q.gap)}`}
            </p>
          </>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-sm font-semibold">
        <span className="text-white/75">{t("Sigorta toplam")}</span>
        <span className="text-[#F4F5F3]">{formatUSD(q.total)}</span>
      </div>
      <p className="mt-1.5 text-[10px] leading-relaxed text-white/40">
        {t("Primler tahminidir; bağlayıcı poliçe bedelini ve teminat şartlarını sigorta şirketi belirler.")}
      </p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-white/65">{k}</span>
      <span className="shrink-0 font-medium text-[#F4F5F3]">{v}</span>
    </div>
  );
}
