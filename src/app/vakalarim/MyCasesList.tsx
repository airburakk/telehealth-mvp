"use client";

// Vakalarım — hastanın kendi başvuruları, çok dilli (8+ dil) + RTL. Veriyi server page.tsx getirir,
// burada yalnız sunum + çeviri yapılır. Hastanın kendi girdisi (isim, semptom) ÇEVRİLMEZ; yalnız
// arayüz metinleri + durum/branş/tier etiketleri çevrilir (TR kanonik → doktor/AI etkilenmez).
// Tam birleşme (2026-07-12): İkinci Görüş vakaları da bu listede — genel vakalarla tek kronolojik
// akışta, "İkinci Görüş" rozetli kart olarak (kullanıcı kararı: karma kronolojik, bölüm yok).
import Link from "next/link";
import { useMemo } from "react";
import { useT } from "@/components/useT";
import { usePatientLang, PatientLangSelect } from "@/components/PatientLocale";
import { countryFlag, urgencyStyle, CASE_STATUS, formatDateTime, langDir } from "@/lib/constants";
import { BRANCHES } from "@/lib/triage";
import { SO_STATUS_LABELS, type SoStatus } from "@/lib/second-opinion";
import { FolderHeart, Plus, ArrowRight, Stethoscope, HeartPulse, Luggage, FileText, Inbox, HandHeart, Bell } from "lucide-react";

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

export type SoCaseRow = {
  id: string;
  branchLabel: string;
  status: string;
  diagnosisSummary: string;
  createdAt: string; // ISO
  hasPendingReq: boolean;
};

const S = {
  title: "Vakalarım",
  subtitle: "Sağlık başvurularınız — yalnızca siz görürsünüz.",
  newBtn: "Yeni başvuru",
  soTitle: "İkinci Görüş",
  soDesc: "Mevcut tanınız için uzmandan bağımsız değerlendirme + video görüşme.",
  tourismTitle: "Sağlık Turizmi",
  tourismDesc: "Tedavi, seyahat ve konaklamayı doktorunuzla planlayın.",
  freeTitle: "Ücretsiz Sağlık Hizmeti",
  freeDesc: "Gönüllü doktorlarla ücretsiz video konsültasyon.",
  empty: "Henüz başvurunuz yok.",
  emptyBtn: "Triyaj ile başlayın",
  caseSummary: "Vaka özeti",
  postop: "Post-Op takip",
  booking: "Rezervasyon",
  offer: "Bekleyen teklif",
  offerWord: "teklifi",
  packageWord: "paket",
  soBadge: "İkinci Görüş",
  actionNeeded: "İşlem gerekiyor",
} as const;

const TIERS = ["Ekonomik", "Standart", "Premium"];

// Karma kronolojik akış: genel + SO vakaları tek listede yeni→eski (tam birleşme, 2026-07-12).
type MergedRow = { kind: "general"; createdAt: string; row: MyCaseRow } | { kind: "so"; createdAt: string; row: SoCaseRow };

export function MyCasesList({ rows, soRows = [] }: { rows: MyCaseRow[]; soRows?: SoCaseRow[] }) {
  const [lang, setLang] = usePatientLang();
  const texts = useMemo(
    () => [
      ...Object.values(S),
      ...Object.values(CASE_STATUS).map((s) => s.label),
      ...Object.values(SO_STATUS_LABELS),
      ...BRANCHES.map((b) => b.label),
      ...TIERS,
    ],
    [],
  );
  const { t } = useT(lang, texts);

  const merged = useMemo<MergedRow[]>(
    () =>
      [
        ...rows.map((r): MergedRow => ({ kind: "general", createdAt: r.createdAt, row: r })),
        ...soRows.map((r): MergedRow => ({ kind: "so", createdAt: r.createdAt, row: r })),
      ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [rows, soRows],
  );

  return (
    <div dir={langDir(lang)} className="mx-auto max-w-4xl px-5 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#28C8D8] text-[#0D0E10]"><FolderHeart size={22} /></span>
          <div>
            <h1 className="text-2xl font-bold text-[#F4F5F3]">{t(S.title)}</h1>
            <p className="text-sm text-white/50">{t(S.subtitle)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <PatientLangSelect lang={lang} onChange={setLang} />
          <Link href="/triyaj" className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
            <Plus size={16} /> {t(S.newBtn)}
          </Link>
        </div>
      </div>

      {/* Diğer kulvarlara köprü — /basla 4'lü seçimi kaldırıldı (2026-07-12); erişim buradan sürer.
          SO kartı yeni başvuruya gider (SO vakaları artık bu listede — tam birleşme). */}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <LaneCard href="/second-opinion/basvur" icon={<Stethoscope size={18} />} title={t(S.soTitle)} desc={t(S.soDesc)} />
        <LaneCard href="/saglik-turizmi" icon={<Luggage size={18} />} title={t(S.tourismTitle)} desc={t(S.tourismDesc)} />
        <LaneCard href="/ucretsiz-saglik/basvur" icon={<HandHeart size={18} />} title={t(S.freeTitle)} desc={t(S.freeDesc)} />
      </div>

      <div className="mt-6 space-y-3">
        {merged.length === 0 && (
          <div className="rounded-3xl border border-dashed border-white/15 bg-[#161719] py-14 text-center">
            <Inbox className="mx-auto mb-2 text-white/25" size={28} />
            <p className="text-sm text-white/50">{t(S.empty)}</p>
            <Link href="/triyaj" className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#28C8D8] px-4 py-2 text-sm font-semibold text-[#0D0E10] hover:bg-[#1FA9B8]">
              <Plus size={15} /> {t(S.emptyBtn)}
            </Link>
          </div>
        )}

        {merged.map((m) => {
          if (m.kind === "so") {
            const c = m.row;
            return (
              <div key={`so-${c.id}`} className="rounded-3xl border border-white/10 bg-[#161719] p-5 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[11px] font-semibold text-violet-300 ring-1 ring-violet-400/25">
                    <Stethoscope size={11} /> {t(S.soBadge)}
                  </span>
                  <span className="font-semibold text-[#F4F5F3]">{t(c.branchLabel)}</span>
                  <span className="rounded-full bg-[#28C8D8]/10 px-2 py-0.5 text-[11px] font-semibold text-[#17919E]">{t(SO_STATUS_LABELS[c.status as SoStatus] ?? c.status)}</span>
                  {c.hasPendingReq && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300 ring-1 ring-amber-400/25">
                      <Bell size={11} /> {t(S.actionNeeded)}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs text-white/50">{formatDateTime(c.createdAt)}</div>
                <p className="mt-2 line-clamp-2 text-sm text-white/65">{c.diagnosisSummary}</p>
                <div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-3">
                  <CaseAction href={`/second-opinion/vaka/${c.id}`} icon={<FileText size={13} />}>{t(S.caseSummary)}</CaseAction>
                </div>
              </div>
            );
          }
          const c = m.row;
          const u = urgencyStyle(c.urgency);
          const st = CASE_STATUS[c.status] ?? CASE_STATUS.NEW;
          const booking = c.booking;
          return (
            <div key={c.id} className="rounded-3xl border border-white/10 bg-[#161719] p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[#F4F5F3]">{c.patientName}</span>
                    <span className="text-xs text-white/40">{countryFlag(c.country)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${st.color}`}>{t(st.label)}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${u.badge}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${u.dot}`} /> {c.urgency}/5
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-white/50">
                    <span className="inline-flex items-center gap-1"><Stethoscope size={12} /> <span className="font-medium text-[#1FA9B8]">{t(c.branch)}</span></span>
                    <span>· {formatDateTime(c.createdAt)}</span>
                    {booking && <span>· {t(booking.tier)} {booking.status === "DRAFT" ? t(S.offerWord) : t(S.packageWord)} (${booking.total.toLocaleString("en-US")})</span>}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-white/65">{c.symptoms}</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-3">
                <CaseAction href={`/vaka/${c.id}`} icon={<FileText size={13} />}>{t(S.caseSummary)}</CaseAction>
                {c.hasRecovery && <CaseAction href={`/takip/${c.id}`} icon={<HeartPulse size={13} />} tone="text-[#28C8D8] border-[#28C8D8]/25 bg-[#28C8D8]/10 hover:bg-[#28C8D8]/15">{t(S.postop)}</CaseAction>}
                {booking && booking.status === "CONFIRMED" && <CaseAction href={`/vaka/${c.id}#rezervasyon`} icon={<Luggage size={13} />} tone="text-emerald-300 border-emerald-400/25 bg-emerald-500/10 hover:bg-emerald-500/15">{t(S.booking)}</CaseAction>}
                {booking && booking.status === "DRAFT" && <CaseAction href={`/vaka/${c.id}#teklif`} icon={<FileText size={13} />} tone="text-violet-300 border-violet-400/25 bg-violet-500/10 hover:bg-violet-500/15">{t(S.offer)}</CaseAction>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LaneCard({ href, icon, title, desc }: { href: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-3xl border border-[#28C8D8]/30 bg-[#28C8D8]/[0.06] p-4 transition hover:bg-[#28C8D8]/[0.1]">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#28C8D8] text-[#0D0E10]">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-[#F4F5F3]">{title}</div>
        <p className="text-xs text-white/50">{desc}</p>
      </div>
      <ArrowRight size={16} className="shrink-0 text-[#17919E] rtl:rotate-180" />
    </Link>
  );
}

function CaseAction({ href, icon, children, tone }: { href: string; icon: React.ReactNode; children: React.ReactNode; tone?: string }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium ${tone ?? "border-white/10 bg-[#161719] text-white/65 hover:bg-[#1E1F22]"}`}>
      {icon} {children} <ArrowRight size={11} />
    </Link>
  );
}
