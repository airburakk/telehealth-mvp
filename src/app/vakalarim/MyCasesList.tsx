"use client";

// Vakalarım — hastanın kendi başvuruları, çok dilli (8+ dil) + RTL. Veriyi server page.tsx getirir,
// burada yalnız sunum + çeviri yapılır. Hastanın kendi girdisi (isim, semptom) ÇEVRİLMEZ; yalnız
// arayüz metinleri + durum/branş/kulvar etiketleri çevrilir (TR kanonik → doktor/AI etkilenmez).
// Glass kart tasarımı (2026-07-13): her vaka bir cam kutu — dış kutu kulvar renginde, içindeki
// header + footer branş renginde (kutu-içinde-kutu). "Yeni başvuru" → 4 kulvar seçim modalı.
import Link from "next/link";
import { createElement, useMemo, useState } from "react";
import { useT } from "@/components/useT";
import { usePatientLang, PatientLangSelect } from "@/components/PatientLocale";
import { countryFlag, CASE_STATUS, formatDateTime, langDir } from "@/lib/constants";
import { BRANCHES } from "@/lib/triage";
import { BranchAvatar } from "@/components/BranchAvatar";
import { branchColor, branchBannerBg } from "@/lib/branch-visuals";
import { SO_STATUS_LABELS, type SoStatus } from "@/lib/second-opinion";
import { FolderHeart, Plus, ArrowRight, Stethoscope, HeartPulse, Luggage, FileText, HandHeart, Bell, X } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export type Lane = "telehealth" | "so" | "tourism" | "free";

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
  lane: "telehealth" | "tourism" | "free";
};

export type SoCaseRow = {
  id: string;
  branchLabel: string;
  status: string;
  diagnosisSummary: string;
  createdAt: string; // ISO
  hasPendingReq: boolean;
};

// 4 kulvar — adlar TR-kanonik (useT ile hedef dile çevrilir: TR'de Türkçe, EN'de "Telehealth"...).
// color = bant/aksan (açık zeminde AA), ink = başlık metni (koyu ton). telehealth = logo turkuazı.
// color = kulvar kimlik rengi (bant/buton), ink = koyu ton (metin), on = renk üstü metin
// (açık renklerde koyu, koyu renklerde beyaz — kontrast güvencesi).
const LANES: Record<Lane, { name: string; color: string; ink: string; on: string }> = {
  telehealth: { name: "Uzaktan Sağlık", color: "#2a64f5", ink: "#1a3f9e", on: "#ffffff" }, // teknolojik mavi
  so: { name: "İkinci Görüş", color: "#1a2b45", ink: "#0f1a2b", on: "#ffffff" }, // derin gece mavisi
  tourism: { name: "Sağlık Turizmi", color: "#00c2b2", ink: "#00655d", on: "#00423c" }, // huzurlu turkuaz
  free: { name: "Ücretsiz Sağlık Hizmeti", color: "#ff7e67", ink: "#a83e28", on: "#5c1e10" }, // mercan turuncu
};

const STAGE_INK: Record<string, string> = {
  NEW: "#1d4ed8",
  IN_REVIEW: "#b45309",
  IN_CONSULT: "#6d28d9",
  DONE: "#15803d",
};
// Aciliyet (urgency) hasta ekranından KALDIRILDI (2026-07-13, kullanıcı isteği) — yalnız doktor
// ekranlarında görünür (/doktor/vaka/[id] + CaseQueue). Hasta gereksiz panik/klinik yorum görmesin.

const S = {
  // "Bakım Yolculuğum" (v6.17): hasta-yüzü ad; rota /vakalarim KALDI (lib/nav.ts notu).
  title: "Bakım Yolculuğum",
  subtitle: "Sağlık başvurularınız — yalnızca siz görürsünüz.",
  newBtn: "Yeni başvuru",
  pickTitle: "Nasıl ilerlemek istersiniz?",
  pickDesc: "Başvurunuz için bir kulvar seçin.",
  cancel: "Vazgeç",
  empty: "Henüz başvurunuz yok.",
  emptyBtn: "Yeni başvuru",
  caseSummary: "Başvuru özeti",
  actionNeeded: "İşlem gerekiyor",
} as const;

// "Yeni başvuru" seçim modalı — 4 kulvar → ilgili başvuru akışı.
const LANE_PICK: { key: Lane; href: string; icon: typeof HeartPulse }[] = [
  { key: "telehealth", href: "/triyaj", icon: HeartPulse },
  { key: "so", href: "/second-opinion/basvur", icon: Stethoscope },
  { key: "tourism", href: "/saglik-turizmi", icon: Luggage },
  { key: "free", href: "/ucretsiz-saglik/basvur", icon: HandHeart },
];

type MergedRow = { kind: "general"; createdAt: string; row: MyCaseRow } | { kind: "so"; createdAt: string; row: SoCaseRow };

export function MyCasesList({ rows, soRows = [] }: { rows: MyCaseRow[]; soRows?: SoCaseRow[] }) {
  const [lang, setLang] = usePatientLang();
  const [pickerOpen, setPickerOpen] = useState(false);
  const texts = useMemo(
    () => [
      ...Object.values(S),
      ...Object.values(LANES).map((l) => l.name),
      ...Object.values(CASE_STATUS).map((s) => s.label),
      ...Object.values(SO_STATUS_LABELS),
      ...BRANCHES.map((b) => b.label),
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
    <div className="min-h-full">
      <div dir={langDir(lang)} className="mx-auto max-w-4xl px-5 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#28c8d8] text-[#0a4148]"><FolderHeart size={22} /></span>
            <div>
              {/* Aura kiti (Doz 1): display başlık — landing tipografi hiyerarşisi */}
              <h1 className="aura-display text-3xl font-medium tracking-tight text-[var(--c-ink)]">{t(S.title)}</h1>
              <p className="mt-0.5 text-[15px] text-[var(--c-ink-2)]">{t(S.subtitle)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <PatientLangSelect lang={lang} onChange={setLang} />
            <button
              onClick={() => setPickerOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#28c8d8] px-4 py-2.5 text-sm font-semibold text-[#0a4148] transition-colors duration-200 hover:bg-[#22b4c2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-accent)]"
            >
              <Plus size={16} /> {t(S.newBtn)}
            </button>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {merged.length === 0 && (
            <EmptyState
              title={t(S.empty)}
              action={
                <button
                  onClick={() => setPickerOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#28c8d8] px-4 py-2.5 text-sm font-semibold text-[#0a4148] transition-colors duration-200 hover:bg-[#22b4c2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-accent)]"
                >
                  <Plus size={15} /> {t(S.emptyBtn)}
                </button>
              }
            />
          )}

          {merged.map((m) => {
            if (m.kind === "so") {
              const c = m.row;
              const branchKey = BRANCHES.find((b) => b.label === c.branchLabel)?.key;
              return (
                <GlassCase
                  key={`so-${c.id}`}
                  lane="so"
                  branchKey={branchKey}
                  branchName={t(c.branchLabel)}
                  laneName={t(LANES.so.name)}
                  stageLabel={t(SO_STATUS_LABELS[c.status as SoStatus] ?? c.status)}
                  stageInk={LANES.so.ink}
                  date={formatDateTime(c.createdAt)}
                  body={c.diagnosisSummary}
                  summaryHref={`/second-opinion/vaka/${c.id}`}
                  summaryLabel={t(S.caseSummary)}
                  alert={c.hasPendingReq ? t(S.actionNeeded) : null}
                />
              );
            }
            const c = m.row;
            const st = CASE_STATUS[c.status] ?? CASE_STATUS.NEW;
            return (
              <GlassCase
                key={c.id}
                lane={c.lane}
                branchKey={c.branch}
                branchName={t(c.branch)}
                laneName={t(LANES[c.lane].name)}
                stageLabel={t(st.label)}
                stageInk={STAGE_INK[c.status] ?? "#57534e"}
                date={formatDateTime(c.createdAt)}
                patientName={c.patientName}
                country={c.country}
                body={c.symptoms}
                summaryHref={`/vaka/${c.id}`}
                summaryLabel={t(S.caseSummary)}
                alert={null}
              />
            );
          })}
        </div>
      </div>

      {/* Yeni başvuru → 4 kulvar seçim modalı */}
      {pickerOpen && (
        <div
          dir={langDir(lang)}
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="aura-display text-xl font-medium tracking-tight text-[var(--c-ink)]">{t(S.pickTitle)}</h2>
                <p className="mt-1 text-sm text-[var(--c-ink-2)]">{t(S.pickDesc)}</p>
              </div>
              <button onClick={() => setPickerOpen(false)} aria-label={t(S.cancel)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--c-ink-3)] hover:bg-[var(--c-surface)]">
                <X size={18} />
              </button>
            </div>
            <div className="mt-4 grid gap-2.5">
              {LANE_PICK.map((p) => {
                const L = LANES[p.key];
                const Icon = p.icon;
                return (
                  <Link
                    key={p.key}
                    href={p.href}
                    className="flex items-center gap-3 rounded-2xl border px-4 py-3 transition-transform hover:-translate-y-0.5"
                    style={{ borderColor: L.color + "59", background: L.color + "16" }}
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: L.color, color: L.on }}>
                      {createElement(Icon, { size: 18, color: L.on })}
                    </span>
                    <span className="font-semibold" style={{ color: L.ink }}>{t(L.name)}</span>
                    <ArrowRight size={16} className="ms-auto rtl:rotate-180" style={{ color: L.color }} />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Cam vaka kutusu — dış kutu kulvar renginde liquid glass; içteki header + footer branş renginde.
function GlassCase({
  lane,
  branchKey,
  branchName,
  laneName,
  stageLabel,
  stageInk,
  date,
  body,
  summaryHref,
  summaryLabel,
  patientName,
  country,
  alert,
}: {
  lane: Lane;
  branchKey?: string | null;
  branchName: string;
  laneName: string;
  stageLabel: string;
  stageInk: string;
  date: string;
  body: string;
  summaryHref: string;
  summaryLabel: string;
  patientName?: string;
  country?: string;
  alert: string | null;
}) {
  const L = LANES[lane];
  const bc = branchColor(branchKey);
  // Footer: kulvar renginin bir ton koyusu (sabit koyu bant, her iki temada koyu → beyaz metin okunur).
  const laneDeep = `color-mix(in srgb, ${L.color}, #000 34%)`;
  // Header: branş rengi tint + Higgsfield banner deseni (branchBannerBg — branş renginden türev CSS).
  // Metin tema-nötr (var(--c-ink)): bazı branş renkleri gündüz beyaz banner üstünde okunmaz →
  // branş kimliğini amblem (BranchAvatar) + banner deseni + renk tint taşır, metin daima okunur.
  const headerBg = `linear-gradient(135deg, ${bc}2b, ${bc}0d 44%, transparent 72%), ${branchBannerBg(branchKey)}`;
  return (
    <article
      className="rounded-[26px] border p-2.5"
      style={{ borderColor: L.color + "5c", background: `color-mix(in srgb, ${L.color}, var(--c-panel) 86%)` }}
    >
      {/* İÇ HEADER KUTUSU — branş rengi + banner deseni: sembol + branş adı BÜYÜK */}
      <div
        className="flex items-center gap-2.5 overflow-hidden rounded-2xl px-3 py-2.5"
        style={{ background: headerBg, border: `1px solid ${bc}40` }}
      >
        <BranchAvatar branchKey={branchKey} size={26} />
        <span className="aura-display min-w-0 flex-1 truncate text-[15px] font-semibold uppercase tracking-wide text-[var(--c-ink)]">
          {branchName}
        </span>
        {alert && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
            <Bell size={11} /> {alert}
          </span>
        )}
      </div>

      {/* GÖVDE — dış kutu kulvar tonu zemininde */}
      <div className="px-3 py-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {patientName && <span className="text-sm font-semibold text-[var(--c-ink)]">{patientName}</span>}
          {country && <span className="text-xs text-[var(--c-ink-3)]">{countryFlag(country)}</span>}
          <span className="text-xs text-[var(--c-ink-3)]">{date}</span>
        </div>
        <p className="mt-1.5 line-clamp-2 text-sm text-[var(--c-ink-2)]">{body}</p>
      </div>

      {/* İÇ FOOTER KUTUSU — kulvar renginin bir ton koyusu: kulvar adı + aşama + vaka özeti */}
      <div
        className="flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2.5"
        style={{ background: laneDeep, border: `1px solid ${L.color}66` }}
      >
        <span className="aura-mono text-[11px] uppercase tracking-[0.15em] text-white/95">{laneName}</span>
        <FooterBadge ink={stageInk} label={stageLabel} />
        <Link
          href={summaryHref}
          className="ms-auto inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[12px] font-semibold shadow-sm transition-opacity hover:opacity-90"
          style={{ color: L.ink }}
        >
          <FileText size={13} /> {summaryLabel} <ArrowRight size={12} className="rtl:rotate-180" />
        </Link>
      </div>
    </article>
  );
}

function FooterBadge({ ink, label }: { ink: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--c-bg)] px-2.5 py-0.5 text-[11px] font-semibold shadow-sm ring-1 ring-black/5" style={{ color: ink }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: ink }} /> {label}
    </span>
  );
}
