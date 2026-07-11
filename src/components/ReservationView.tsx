"use client";

// Rezervasyon hasta-yüzü görünümü (FAZ 3) — server page.tsx auth+decrypt+DB yapar, düz veriyi buraya
// prop olarak geçer; bu bileşen sunum + i18n (useT/air_lang) + RTL (langDir) + escrow güven görseli
// (EscrowMilestones) + "Koordinatörle konuş" (CoordinatorContact) sağlar. Faz 3 cilası: finansal
// kalem/split etiketleri de çevrilir (katalog terimleri, PHI değil — hasta adı/tanı çeviriye GİRMEZ);
// dinamik etiketler texts'e içerik-imzalı sabit ref'le eklenir ([[uset-unstable-texts-race]]).
import { useMemo } from "react";
import Link from "next/link";
import {
  CheckCircle2, Plane, BedDouble, Stethoscope, Home, Languages, Building2, HeartPulse, Scale, ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useT } from "@/components/useT";
import { usePatientLang, PatientLangSelect } from "@/components/PatientLocale";
import { langDir } from "@/lib/constants";
import { formatUSD, type LineItem } from "@/lib/pricing";
import { JOURNEY_STAGES, JOURNEY_STATUS, journeyProgress, type JourneyStage } from "@/lib/journey";
import { InsuranceSummary } from "@/components/InsuranceSummary";
import { EscrowMilestones } from "@/components/EscrowMilestones";
import { CoordinatorContact } from "@/components/CoordinatorContact";

const STAGE_ICONS: Record<string, LucideIcon> = {
  transfer: Plane, hotel: BedDouble, hospital: Building2, operation: Stethoscope, discharge: Home,
};

const TEXTS = [
  "Paket onaylandı",
  "Tedavi paketiniz rezerve edildi; ödemeniz hizmet tamamlanana dek güvence altında tutulur (escrow simülasyonu).",
  "Paket",
  "Rezervasyon No",
  "Hastane", "Otel", "Tercüman", "Sigorta", "Seviye", "Dahil", "Yok", "gece",
  "Toplam (Escrow)",
  "Yetki belgesi", "Sağlık turizmi yetki belgeli tesis (T.C. Sağlık Bakanlığı — HealthTürkiye)",
  "Ödeme Dağılımı (Split)",
  "Hasta Yolculuğu",
  "tamamlandı",
  "Tamamlandı", "Planlanan",
  "Post-Op takibe başla",
  "Şikayet / itiraz (Etik Kurul)",
  "Doktor paneline dön",
  // yolculuk aşama etiketleri (lib/journey.ts JOURNEY_STAGES ile birebir)
  "Karşılama & transfer", "Havalimanı VIP karşılama",
  "Otel girişi", "Konaklama başlangıcı",
  "Hastane & ön muayene", "Tetkik ve hazırlık",
  "Operasyon / tedavi", "Planlanan işlem",
  "Taburcu & dönüş", "Kontroller + uçuş",
  // yolculuk durum etiketleri (JOURNEY_STATUS)
  "Bekliyor", "Devam ediyor",
];

const fmtJourneyDate = (iso: string) =>
  new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeZone: "Europe/Istanbul" }).format(new Date(iso));

export interface ReservationViewProps {
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
  split: LineItem[];
  total: number;
  patientName: string;
  branch: string;
  escrowStatus: string;
  stages: JourneyStage[];
  caseId: string;
}

export function ReservationView(p: ReservationViewProps) {
  const [lang, setLang] = usePatientLang();
  // Sabit kromo + dinamik kalem/split etiketleri (props server-render'dan gelir, ref sabit) — yarış dersi.
  const texts = useMemo(
    () => [...TEXTS, ...p.items.flatMap((i) => (i.note ? [i.label, i.note] : [i.label])), ...p.split.map((s) => s.label)],
    [p.items, p.split],
  );
  const { t } = useT(lang, texts);
  const progress = journeyProgress(p.stages);

  return (
    <div dir={langDir(lang)} className="mx-auto max-w-3xl px-5 py-10">
      <div className="mb-4 flex items-center justify-end">
        <PatientLangSelect lang={lang} onChange={setLang} />
      </div>

      <div className="flex items-start gap-3 rounded-3xl border border-emerald-400/25 bg-emerald-500/10 p-5">
        <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-300" />
        <div>
          <h1 className="font-bold text-emerald-200">{t("Paket onaylandı")}</h1>
          <p className="mt-0.5 text-xs font-medium text-emerald-200">{p.patientName} · {p.branch}</p>
          <p className="mt-0.5 text-sm text-emerald-800/80">{t("Tedavi paketiniz rezerve edildi; ödemeniz hizmet tamamlanana dek güvence altında tutulur (escrow simülasyonu).")}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-[1fr_300px]">
        {/* Sol: paket içeriği */}
        <div className="space-y-5">
          <div className="rounded-3xl border border-white/10 bg-[#161719] p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-white/40">{t("Rezervasyon No")}</div>
                <div className="font-mono text-sm text-white/75">{p.rezNo}</div>
              </div>
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
              <span className="text-sm font-semibold text-white/75">{t("Toplam (Escrow)")}</span>
              <span className="text-2xl font-bold text-[#F4F5F3]">{formatUSD(p.total)}</span>
            </div>
          </div>

          {/* Sigorta teminat özeti (3 kademeli) */}
          <InsuranceSummary detailJson={p.insuranceDetail} lang={lang} />

          {/* Hasta yolculuğu — lojistik takip (koordinatör /operasyon/lojistik'ten günceller) */}
          <div className="rounded-3xl border border-white/10 bg-[#161719] p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wide text-white/50">{t("Hasta Yolculuğu")}</div>
              <span className="text-xs text-white/40">{progress.done}/{progress.total} {t("tamamlandı")}</span>
            </div>
            <ol className="mt-4 space-y-0">
              {p.stages.map((st, i) => {
                const meta = JOURNEY_STAGES.find((s) => s.key === st.key) ?? { label: st.key, desc: "" };
                const Icon = STAGE_ICONS[st.key] ?? Plane;
                const stat = JOURNEY_STATUS[st.status];
                const dateLabel =
                  st.status === "done" && st.doneAt
                    ? `${t("Tamamlandı")} · ${fmtJourneyDate(st.doneAt)}`
                    : st.plannedAt
                      ? `${t("Planlanan")} · ${fmtJourneyDate(st.plannedAt)}`
                      : null;
                return (
                  <li key={st.key} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={`grid h-9 w-9 place-items-center rounded-full ${
                          st.status === "done"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : st.status === "active"
                              ? "bg-[#28C8D8]/15 text-[#28C8D8]"
                              : "bg-white/10 text-white/40"
                        }`}
                      >
                        {st.status === "done" ? <CheckCircle2 size={16} /> : <Icon size={16} />}
                      </span>
                      {i < p.stages.length - 1 && (
                        <span className={`my-1 h-6 w-0.5 ${st.status === "done" ? "bg-emerald-200" : "bg-white/15"}`} />
                      )}
                    </div>
                    <div className="pb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-sm font-medium ${st.status === "pending" ? "text-white/40" : "text-[#F4F5F3]"}`}>
                          {t(meta.label)}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${stat.color}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${stat.dot}`} /> {t(stat.label)}
                        </span>
                      </div>
                      <div className="text-xs text-white/40">{t(meta.desc)}</div>
                      {dateLabel && <div className="mt-0.5 text-xs text-white/50">{dateLabel}</div>}
                      {st.note && <div className="mt-0.5 text-xs text-white/65">{st.note}</div>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>

        {/* Sağ: Escrow güven görseli + split + aksiyonlar */}
        <aside className="space-y-4">
          <EscrowMilestones status={p.escrowStatus} lang={lang} />

          <div className="rounded-3xl border border-white/10 bg-[#161719] p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-white/50">{t("Ödeme Dağılımı (Split)")}</div>
            <ul className="mt-3 space-y-2 text-sm">
              {p.split.map((s) => (
                <li key={s.key} className="flex items-center justify-between">
                  <span className="text-white/65">{t(s.label)}</span>
                  <span className="font-medium text-[#F4F5F3]">{formatUSD(s.amount)}</span>
                </li>
              ))}
            </ul>
          </div>

          <Link href={`/takip/${p.caseId}`} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
            <HeartPulse size={16} /> {t("Post-Op takibe başla")}
          </Link>
          <CoordinatorContact bookingId={p.bookingId} lang={lang} />
          <Link href={`/sikayet/${p.caseId}`} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-[#161719] px-4 py-2.5 text-sm font-medium text-white/75 hover:bg-[#1E1F22]">
            <Scale size={15} /> {t("Şikayet / itiraz (Etik Kurul)")}
          </Link>
          <Link href="/doktor" className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#28C8D8] px-4 py-2.5 text-sm font-semibold text-[#0D0E10] hover:bg-[#1FA9B8]">
            <Stethoscope size={16} /> {t("Doktor paneline dön")}
          </Link>
        </aside>
      </div>
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
