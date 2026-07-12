"use client";

// Teklif hasta-yüzü görünümü (FAZ 3) — server page.tsx auth+decrypt+DB+redirect yapar, düz veriyi
// prop olarak geçer; sunum + i18n (useT/air_lang) + RTL (langDir) + escrow güven görseli
// (EscrowMilestones, PENDING) + i18n'li OfferActions. Faz 3 cilası: finansal kalem etiketleri de
// çevrilir (katalog terimleri, PHI değil); dinamik etiketler texts'e sabit ref'le eklenir.
import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft, FileText, Building2, BedDouble, Languages, ShieldCheck, Plane, Stethoscope, Home, XCircle, Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useT } from "@/components/useT";
import { usePatientLang, PatientLangSelect } from "@/components/PatientLocale";
import { langDir, countryFlag, countryName } from "@/lib/constants";
import { formatUSD, type LineItem } from "@/lib/pricing";
import { InsuranceSummary } from "@/components/InsuranceSummary";
import { OfferActions } from "@/components/OfferActions";
import { EscrowMilestones } from "@/components/EscrowMilestones";

// Statik yolculuk önizlemesi (teklifte durum takibi yok — hepsi eşit; rezervasyonda gerçek durumlu).
const JOURNEY: { icon: LucideIcon; t: string; d: string }[] = [
  { icon: Plane, t: "Karşılama & transfer", d: "Havalimanı VIP karşılama" },
  { icon: BedDouble, t: "Otel girişi", d: "Konaklama başlangıcı" },
  { icon: Building2, t: "Hastane & ön muayene", d: "Tetkik ve hazırlık" },
  { icon: Stethoscope, t: "Operasyon / tedavi", d: "Planlanan işlem" },
  { icon: Home, t: "Taburcu & dönüş", d: "Kontroller + uçuş" },
];

const TEXTS = [
  "Vakalarım",
  "Tedavi Paketi Teklifi",
  "Bu teklif reddedildi",
  "Yeni bir teklif için koordinatörünüzle görüşebilirsiniz.",
  "Size özel hazırlanmış tedavi paketi teklifi",
  "Aşağıdaki paketi inceleyin. Onayladığınızda ödeme, hizmet tamamlanana dek platform Escrow güvencesinde tutulur (escrow simülasyonu — gerçek para transferi yapılmaz).",
  "Paket içeriği", "Paket",
  "Hastane", "Otel", "Tercüman", "Sigorta", "Seviye", "Dahil", "Yok", "gece",
  "Toplam",
  "Yetki belgesi", "Sağlık turizmi yetki belgeli tesis (T.C. Sağlık Bakanlığı — HealthTürkiye)",
  "Hasta Yolculuğu",
  "Bu teklif AURA sağlık turizmi platformu üzerinden hazırlanmıştır",
  // yolculuk önizleme etiketleri
  "Karşılama & transfer", "Havalimanı VIP karşılama",
  "Otel girişi", "Konaklama başlangıcı",
  "Hastane & ön muayene", "Tetkik ve hazırlık",
  "Operasyon / tedavi", "Planlanan işlem",
  "Taburcu & dönüş", "Kontroller + uçuş",
];

export interface OfferViewProps {
  bookingId: string;
  rezNo: string;
  /** Doktorun tedavi kararında seçtiği tesis (Case.hospitalName; null = belirtilmedi). */
  hospitalName: string | null;
  /** Tesisin sağlık turizmi yetki belge no'su (HealthTürkiye; null = kayıt yok → rozet basılmaz). */
  hospitalAuthNo: string | null;
  tier: string;
  hospitalType: string;
  hotelStars: number;
  nights: number;
  translator: boolean;
  insuranceLevel: number;
  insuranceDetail: string | null;
  items: LineItem[];
  total: number;
  patientName: string;
  country: string;
  branch: string;
  escrowStatus: string;
  declined: boolean;
  createdLabel: string;
  /** Vaka merkezinde (Faz 6) bölüm olarak gömülü: kendi kromu (geri linki + dil seçici + dış boşluk) gizlenir. */
  embedded?: boolean;
}

export function OfferView(p: OfferViewProps) {
  const [lang, setLang] = usePatientLang();
  // Sabit kromo + dinamik kalem etiketleri (props server-render'dan gelir, ref sabit) — yarış dersi.
  const texts = useMemo(
    () => [...TEXTS, ...p.items.flatMap((i) => (i.note ? [i.label, i.note] : [i.label]))],
    [p.items],
  );
  const { t } = useT(lang, texts);

  return (
    <div dir={langDir(lang)} className={p.embedded ? "print-doc" : "print-doc mx-auto max-w-3xl px-5 py-8"}>
      {!p.embedded && (
        <div className="print:hidden flex items-center justify-between gap-3">
          <Link href="/vakalarim" className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-[#1FA9B8]">
            <ArrowLeft size={16} className="rtl:rotate-180" /> {t("Vakalarım")}
          </Link>
          <PatientLangSelect lang={lang} onChange={setLang} />
        </div>
      )}

      {/* Belge başlığı */}
      <div className="mt-4 flex items-start justify-between gap-3 border-b border-white/10 pb-5">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-600 text-white"><FileText size={22} /></span>
          <div>
            <h1 className="text-2xl font-bold text-[#F4F5F3]">{t("Tedavi Paketi Teklifi")}</h1>
            <p className="text-sm text-white/50">{p.patientName} · {countryFlag(p.country)} {countryName(p.country)} · {p.branch}</p>
          </div>
        </div>
        <div className="text-right text-xs text-white/40">
          <div className="font-mono text-white/65">{p.rezNo}</div>
          <div>{p.createdLabel}</div>
        </div>
      </div>

      {/* Durum bandı */}
      {p.declined ? (
        <div className="mt-5 flex items-start gap-3 rounded-3xl border border-white/10 bg-[#1E1F22] p-4">
          <XCircle className="mt-0.5 shrink-0 text-white/40" />
          <div>
            <div className="font-semibold text-white/75">{t("Bu teklif reddedildi")}</div>
            <p className="text-sm text-white/50">{t("Yeni bir teklif için koordinatörünüzle görüşebilirsiniz.")}</p>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex items-start gap-3 rounded-3xl border border-violet-400/25 bg-violet-500/10 p-4">
          <Sparkles className="mt-0.5 shrink-0 text-violet-300" />
          <div>
            <div className="font-semibold text-violet-200">{t("Size özel hazırlanmış tedavi paketi teklifi")}</div>
            <p className="text-sm text-violet-200/90">{t("Aşağıdaki paketi inceleyin. Onayladığınızda ödeme, hizmet tamamlanana dek platform Escrow güvencesinde tutulur (escrow simülasyonu — gerçek para transferi yapılmaz).")}</p>
          </div>
        </div>
      )}

      {/* Paket içeriği */}
      <div className="mt-5 rounded-3xl border border-white/10 bg-[#161719] p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/50">{t("Paket içeriği")}</span>
          <span className="rounded-full bg-[#28C8D8] px-3 py-1 text-xs font-semibold text-[#0D0E10]">{p.tier} {t("Paket")}</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <Spec icon={<Building2 size={14} />} k={t("Hastane")} v={p.hospitalType} />
          <Spec icon={<BedDouble size={14} />} k={t("Otel")} v={`${p.hotelStars}★ · ${p.nights} ${t("gece")}`} />
          <Spec icon={<Languages size={14} />} k={t("Tercüman")} v={p.translator ? t("Dahil") : t("Yok")} />
          <Spec icon={<ShieldCheck size={14} />} k={t("Sigorta")} v={`${t("Seviye")} ${p.insuranceLevel}`} />
        </div>
        {/* Doktorun seçtiği tesis + sağlık turizmi yetki belgesi rozeti (hasta güven sinyali; yalnız pozitif) */}
        {p.hospitalName && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-[#1E1F22]/60 px-3 py-2 text-sm">
            <Building2 size={14} className="shrink-0 text-[#1FA9B8]" />
            <span className="min-w-0 font-medium text-white/75">{p.hospitalName}</span>
            {p.hospitalAuthNo && (
              <span title={t("Sağlık turizmi yetki belgeli tesis (T.C. Sağlık Bakanlığı — HealthTürkiye)")} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-400/25">
                <ShieldCheck size={12} /> {t("Yetki belgesi")}: {p.hospitalAuthNo}
              </span>
            )}
          </div>
        )}
        <ul className="mt-5 space-y-2 border-t border-white/10 pt-4">
          {p.items.map((it) => (
            <li key={it.key} className="flex items-start justify-between gap-3 text-sm">
              <span className="text-white/65">{t(it.label)}{it.note && <span className="block text-xs text-white/40">{t(it.note)}</span>}</span>
              <span className="shrink-0 font-medium text-[#F4F5F3]">{formatUSD(it.amount)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-end justify-between border-t border-white/10 pt-3">
          <span className="text-sm font-semibold text-white/75">{t("Toplam")}</span>
          <span className="text-2xl font-bold text-[#F4F5F3]">{formatUSD(p.total)}</span>
        </div>
      </div>

      {/* Escrow güven görseli (teklifte PENDING — onaylanınca akış başlar) */}
      {!p.declined && (
        <div className="mt-5">
          <EscrowMilestones status={p.escrowStatus} lang={lang} />
        </div>
      )}

      {/* Sigorta teminat özeti (3 kademeli) */}
      <div className="mt-5">
        <InsuranceSummary detailJson={p.insuranceDetail} lang={lang} />
      </div>

      {/* Hasta yolculuğu (statik önizleme) */}
      <div className="mt-5 rounded-3xl border border-white/10 bg-[#161719] p-6 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-white/50">{t("Hasta Yolculuğu")}</div>
        <ol className="mt-4 grid gap-3 sm:grid-cols-5">
          {JOURNEY.map((j, i) => {
            const Icon = j.icon;
            return (
              <li key={i} className="flex flex-col items-center text-center">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[#28C8D8]/15 text-[#28C8D8]"><Icon size={16} /></span>
                <div className="mt-1.5 text-xs font-medium text-[#F4F5F3]">{t(j.t)}</div>
                <div className="text-[10px] text-white/40">{t(j.d)}</div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Aksiyonlar (taslak teklif) */}
      {!p.declined && (
        <div className="mt-6">
          <OfferActions bookingId={p.bookingId} total={formatUSD(p.total)} lang={lang} />
        </div>
      )}

      <p className="mt-6 text-center text-[11px] text-white/40">
        {t("Bu teklif AURA sağlık turizmi platformu üzerinden hazırlanmıştır")} · {p.createdLabel}
      </p>
    </div>
  );
}

function Spec({ icon, k, v }: { icon: React.ReactNode; k: string; v: string }) {
  return (
    <div className="rounded-lg bg-[#1E1F22] px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs text-white/40">{icon} {k}</div>
      <div className="mt-0.5 text-sm font-medium text-[#F4F5F3]">{v}</div>
    </div>
  );
}
