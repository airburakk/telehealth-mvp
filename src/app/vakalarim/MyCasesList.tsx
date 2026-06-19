"use client";

// Vakalarım — hastanın kendi başvuruları, çok dilli (8+ dil) + RTL. Veriyi server page.tsx getirir,
// burada yalnız sunum + çeviri yapılır. Hastanın kendi girdisi (isim, semptom) ÇEVRİLMEZ; yalnız
// arayüz metinleri + durum/branş/tier etiketleri çevrilir (TR kanonik → doktor/AI etkilenmez).
import Link from "next/link";
import { useMemo } from "react";
import { useT } from "@/components/useT";
import { usePatientLang, PatientLangSelect } from "@/components/PatientLocale";
import { countryFlag, urgencyStyle, CASE_STATUS, formatDateTime, langDir } from "@/lib/constants";
import { BRANCHES } from "@/lib/triage";
import { FolderHeart, Plus, ArrowRight, Stethoscope, HeartPulse, Luggage, FileText, Inbox } from "lucide-react";

export type MyCaseRow = {
  id: string;
  patientName: string;
  country: string;
  status: string;
  urgency: number;
  branch: string;
  symptoms: string;
  createdAt: string; // ISO
  booking: { id: string; tier: string; status: string; total: number } | null;
  hasRecovery: boolean;
};

const S = {
  title: "Vakalarım",
  subtitle: "Sağlık başvurularınız — yalnızca siz görürsünüz.",
  newBtn: "Yeni başvuru",
  soTitle: "İkinci Görüş",
  soDesc: "Mevcut tanınız için uzmandan bağımsız değerlendirme + video görüşme.",
  empty: "Henüz başvurunuz yok.",
  emptyBtn: "Triyaj ile başlayın",
  caseSummary: "Vaka özeti",
  postop: "Post-Op takip",
  booking: "Rezervasyon",
  offer: "Bekleyen teklif",
  offerWord: "teklifi",
  packageWord: "paket",
} as const;

const TIERS = ["Ekonomik", "Standart", "Premium"];

export function MyCasesList({ rows }: { rows: MyCaseRow[] }) {
  const [lang, setLang] = usePatientLang();
  const texts = useMemo(
    () => [
      ...Object.values(S),
      ...Object.values(CASE_STATUS).map((s) => s.label),
      ...BRANCHES.map((b) => b.label),
      ...TIERS,
    ],
    [],
  );
  const { t } = useT(lang, texts);

  return (
    <div dir={langDir(lang)} className="mx-auto max-w-4xl px-5 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#14C3D0] text-[#101010]"><FolderHeart size={22} /></span>
          <div>
            <h1 className="text-2xl font-bold text-[#101010]">{t(S.title)}</h1>
            <p className="text-sm text-slate-500">{t(S.subtitle)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <PatientLangSelect lang={lang} onChange={setLang} />
          <Link href="/triyaj" className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
            <Plus size={16} /> {t(S.newBtn)}
          </Link>
        </div>
      </div>

      <Link href="/second-opinion/vakalarim" className="mt-5 flex items-center gap-3 rounded-3xl border border-[#14C3D0]/30 bg-[#14C3D0]/[0.06] p-4 transition hover:bg-[#14C3D0]/[0.1]">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#14C3D0] text-[#101010]"><Stethoscope size={18} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[#101010]">{t(S.soTitle)}</div>
          <p className="text-xs text-slate-500">{t(S.soDesc)}</p>
        </div>
        <ArrowRight size={16} className="shrink-0 text-[#0E8A95]" />
      </Link>

      <div className="mt-6 space-y-3">
        {rows.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white py-14 text-center">
            <Inbox className="mx-auto mb-2 text-slate-300" size={28} />
            <p className="text-sm text-slate-500">{t(S.empty)}</p>
            <Link href="/triyaj" className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#14C3D0] px-4 py-2 text-sm font-semibold text-[#101010] hover:bg-[#0EA5B2]">
              <Plus size={15} /> {t(S.emptyBtn)}
            </Link>
          </div>
        )}

        {rows.map((c) => {
          const u = urgencyStyle(c.urgency);
          const st = CASE_STATUS[c.status] ?? CASE_STATUS.NEW;
          const booking = c.booking;
          return (
            <div key={c.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-800">{c.patientName}</span>
                    <span className="text-xs text-slate-400">{countryFlag(c.country)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${st.color}`}>{t(st.label)}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${u.badge}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${u.dot}`} /> {c.urgency}/5
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1"><Stethoscope size={12} /> <span className="font-medium text-[#0EA5B2]">{t(c.branch)}</span></span>
                    <span>· {formatDateTime(c.createdAt)}</span>
                    {booking && <span>· {t(booking.tier)} {booking.status === "DRAFT" ? t(S.offerWord) : t(S.packageWord)} (${booking.total.toLocaleString("en-US")})</span>}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600">{c.symptoms}</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <CaseAction href={`/triyaj/${c.id}`} icon={<FileText size={13} />}>{t(S.caseSummary)}</CaseAction>
                {c.hasRecovery && <CaseAction href={`/takip/${c.id}`} icon={<HeartPulse size={13} />} tone="text-teal-700 border-teal-200 bg-teal-50 hover:bg-teal-100">{t(S.postop)}</CaseAction>}
                {booking && booking.status === "CONFIRMED" && <CaseAction href={`/rezervasyon/${booking.id}`} icon={<Luggage size={13} />} tone="text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100">{t(S.booking)}</CaseAction>}
                {booking && booking.status === "DRAFT" && <CaseAction href={`/teklif/${booking.id}`} icon={<FileText size={13} />} tone="text-violet-700 border-violet-200 bg-violet-50 hover:bg-violet-100">{t(S.offer)}</CaseAction>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CaseAction({ href, icon, children, tone }: { href: string; icon: React.ReactNode; children: React.ReactNode; tone?: string }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium ${tone ?? "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
      {icon} {children} <ArrowRight size={11} />
    </Link>
  );
}
