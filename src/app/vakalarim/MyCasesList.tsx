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
import { countryFlag, CASE_STATUS, formatDateTime, langDir, LANG_BCP47 } from "@/lib/constants";
import { BRANCHES } from "@/lib/triage";
import { BranchAvatar } from "@/components/BranchAvatar";
import { SO_STATUS_LABELS, type SoStatus } from "@/lib/second-opinion";
import { FolderHeart, Plus, ArrowRight, Stethoscope, HeartPulse, Plane, FileText, HeartHandshake, Bell, X, SlidersHorizontal, ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  GROUP_LABELS, NEXT_STEP_TEXTS, PATIENT_CASE_GROUPS, PATIENT_PAGE_SIZE, type PatientCaseGroup, type PatientListFilters,
} from "@/lib/patient-cases";

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
  nextStep: string; // TR kanonik "sıradaki adım" cümlesi (lib/patient-cases; useT çevirir)
};

export type SoCaseRow = {
  id: string;
  branchLabel: string;
  status: string;
  diagnosisSummary: string;
  createdAt: string; // ISO
  hasPendingReq: boolean;
  nextStep: string;
};

// Sunucu (page.tsx) iki modeli (createdAt, id) keyset sırasıyla birleştirip sayfayı keser; burada sıralama YAPILMAZ.
export type MergedRow =
  | { kind: "general"; id: string; createdAt: string; row: MyCaseRow }
  | { kind: "so"; id: string; createdAt: string; row: SoCaseRow };

// 4 kulvar — adlar TR-kanonik (useT ile hedef dile çevrilir: TR'de Türkçe, EN'de "Telehealth"...).
// color = bant/aksan (açık zeminde AA), ink = başlık metni (koyu ton). telehealth = logo turkuazı.
// color = kulvar kimlik rengi (bant/buton), ink = koyu ton (metin), on = renk üstü metin
// (açık renklerde koyu, koyu renklerde beyaz — kontrast güvencesi).
const LANES: Record<Lane, { name: string; color: string; ink: string; on: string }> = {
  telehealth: { name: "Uzaktan Sağlık", color: "#be185d", ink: "#9d174d", on: "#ffffff" }, // pembe (v6.43 — eski mavi SO ile ayrışmıyordu)
  so: { name: "İkinci Görüş", color: "#1a2b45", ink: "#0f1a2b", on: "#ffffff" }, // derin gece mavisi
  tourism: { name: "Sağlık Turizmi", color: "#00c2b2", ink: "#00655d", on: "#00423c" }, // huzurlu turkuaz
  free: { name: "Ücretsiz Sağlık Hizmeti", color: "#ff7e67", ink: "#a83e28", on: "#5c1e10" }, // mercan turuncu
};

// Durum noktaları — TEMA-DUYARLI semantik token'lar (v6.22 + toggle): gece açık ton,
// gündüz koyu ton; değerler globals.css .theme-dark/.theme-light bloklarından gelir.
const STAGE_INK: Record<string, string> = {
  NEW: "var(--c-info)",
  IN_REVIEW: "var(--c-warning)",
  IN_CONSULT: "var(--c-indigo)",
  DONE: "var(--c-success)",
};

// Renk disiplini (v6.22, kullanıcı kararı — /palet-onizleme V2): kulvar rengi yüzey BOYAMAZ,
// yalnız kimlik vurgusudur (3px kenar şeridi + mono etiket). Değerler TEMA-DUYARLI CSS
// değişkenlerinden (globals.css --lane-*): gece açık tonlar (SO gece-mavisi düz halde okunmaz),
// gündüz koyu/kontrastlı tonlar.
const LANE_ACCENT: Record<Lane, string> = {
  telehealth: "var(--lane-telehealth)",
  so: "var(--lane-so)",
  tourism: "var(--lane-tourism)",
  free: "var(--lane-free)",
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
  // K09-hasta / H11 (v6.281): gruplar · filtre · sayfalama · sıradaki adım
  groupsAria: "Başvuru grupları",
  emptyGroup: "Bu grupta başvuru yok.",
  nextStep: "Sıradaki adım",
  filters: "Filtrele",
  filterBranch: "Branş",
  allBranches: "Tüm branşlar",
  filterFrom: "Başlangıç tarihi",
  filterTo: "Bitiş tarihi",
  filterApply: "Uygula",
  filterClear: "Temizle",
  nextPage: "Sonraki başvurular",
  firstPage: "Başa dön",
} as const;

// "Yeni başvuru" seçim modalı — 4 kulvar → ilgili başvuru akışı.
// İkonlar hasta↔doktor ORTAK kulvar seti (2026-07-31, kullanıcı kararı): telehealth=HeartPulse ·
// so=Stethoscope · tourism=Plane · free=HeartHandshake (+ doktor-yüzü consult=Inbox). Değiştirirken
// doktor ana sayfa panelleri + DutyConsole ile birlikte güncelle.
const LANE_PICK: { key: Lane; href: string; icon: typeof HeartPulse }[] = [
  { key: "telehealth", href: "/triyaj", icon: HeartPulse },
  { key: "so", href: "/second-opinion/basvur", icon: Stethoscope },
  { key: "tourism", href: "/saglik-turizmi", icon: Plane },
  { key: "free", href: "/ucretsiz-saglik/basvur", icon: HeartHandshake },
];

// Grup sekmesi / sayfa bağlantısı için URL — filtreler korunur, imleç yalnız "sonraki" bağlantısında taşınır.
function listHref(group: PatientCaseGroup, f: PatientListFilters, cursor?: string): string {
  const p = new URLSearchParams();
  p.set("grup", group);
  if (f.branch) p.set("branch", f.branch);
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (cursor) p.set("cursor", cursor);
  return `/vakalarim?${p.toString()}`;
}

export function MyCasesList({
  items,
  group,
  counts,
  filters,
  cursor,
  nextCursor,
}: {
  items: MergedRow[];
  group: PatientCaseGroup;
  counts: Record<PatientCaseGroup, number>;
  filters: PatientListFilters;
  cursor?: string;
  nextCursor: string | null;
}) {
  const [lang, setLang] = usePatientLang();
  const [pickerOpen, setPickerOpen] = useState(false);
  const texts = useMemo(
    () => [
      ...Object.values(S),
      ...Object.values(LANES).map((l) => l.name),
      ...Object.values(CASE_STATUS).map((s) => s.label),
      ...Object.values(SO_STATUS_LABELS),
      ...BRANCHES.map((b) => b.label),
      ...Object.values(GROUP_LABELS),
      ...NEXT_STEP_TEXTS,
    ],
    [],
  );
  const { t } = useT(lang, texts);
  const hasFilter = !!(filters.branch || filters.from || filters.to);

  return (
    <div className="min-h-full">
      {/* lang ŞART (denetim #27): globals.css Arapça/Farsça fontu yalnız :lang(ar|fa) ile bağlar (v6.9) */}
      <div dir={langDir(lang)} lang={LANG_BCP47[lang]} className="mx-auto max-w-4xl px-5 py-8">
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

        {/* Gruplar (H11): işlem gerekiyor · devam eden · tamamlanan — sayılar sunucudan (filtre uygulanmış). Sekme = bağlantı
            (JS'siz de çalışır); aktif sekme aria-current. */}
        <nav aria-label={t(S.groupsAria)} className="mt-6 flex flex-wrap gap-2">
          {PATIENT_CASE_GROUPS.map((g) => {
            const active = g === group;
            return (
              <Link
                key={g}
                href={listHref(g, filters)}
                aria-current={active ? "page" : undefined}
                className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-accent)] ${
                  active
                    ? "border-[var(--c-accent)] bg-[var(--c-accent)]/[0.08] text-[var(--c-ink)]"
                    : "border-[var(--c-hairline)] text-[var(--c-ink-2)] hover:bg-[var(--c-surface)]"
                }`}
              >
                {g === "aksiyon" && counts.aksiyon > 0 && <Bell size={13} className="text-amber-300" />}
                {t(GROUP_LABELS[g])}
                <span className="rounded-full bg-[var(--c-surface)] px-1.5 text-[11px] text-[var(--c-ink-3)]">{counts[g]}</span>
              </Link>
            );
          })}
        </nav>

        {/* Branş + tarih filtresi (K09-hasta): GET formu — sunucu uygular, URL paylaşılabilir. */}
        <form method="get" action="/vakalarim" className="mt-3 flex flex-wrap items-end gap-2 text-sm">
          <input type="hidden" name="grup" value={group} />
          <span className="inline-flex items-center gap-1 text-xs text-[var(--c-ink-3)]"><SlidersHorizontal size={13} /> {t(S.filters)}</span>
          <label className="flex flex-col gap-0.5 text-[11px] text-[var(--c-ink-3)]">
            {t(S.filterBranch)}
            <select name="branch" defaultValue={filters.branch ?? ""} className="rounded-lg border border-[var(--c-hairline)] bg-[var(--c-panel)] px-2.5 py-1.5 text-sm text-[var(--c-ink)] outline-none focus:border-[var(--c-accent)]">
              <option value="">{t(S.allBranches)}</option>
              {BRANCHES.map((b) => <option key={b.key} value={b.key}>{t(b.label)}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-0.5 text-[11px] text-[var(--c-ink-3)]">
            {t(S.filterFrom)}
            <input type="date" name="from" defaultValue={filters.from ?? ""} className="rounded-lg border border-[var(--c-hairline)] bg-[var(--c-panel)] px-2.5 py-1.5 text-sm text-[var(--c-ink)] outline-none focus:border-[var(--c-accent)]" />
          </label>
          <label className="flex flex-col gap-0.5 text-[11px] text-[var(--c-ink-3)]">
            {t(S.filterTo)}
            <input type="date" name="to" defaultValue={filters.to ?? ""} className="rounded-lg border border-[var(--c-hairline)] bg-[var(--c-panel)] px-2.5 py-1.5 text-sm text-[var(--c-ink)] outline-none focus:border-[var(--c-accent)]" />
          </label>
          <button type="submit" className="rounded-lg border border-[var(--c-hairline)] px-3 py-1.5 text-sm font-medium text-[var(--c-ink-2)] hover:bg-[var(--c-surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-accent)]">
            {t(S.filterApply)}
          </button>
          {hasFilter && (
            <Link href={listHref(group, {})} className="text-sm text-[var(--c-accent)] hover:underline">
              {t(S.filterClear)}
            </Link>
          )}
        </form>

        <div className="mt-5 space-y-4">
          {items.length === 0 && (
            <EmptyState
              title={hasFilter || counts.aksiyon + counts.devam + counts.tamam > 0 ? t(S.emptyGroup) : t(S.empty)}
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

          {items.map((m) => {
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
                  stageInk="var(--c-indigo)"
                  date={formatDateTime(c.createdAt)}
                  body={c.diagnosisSummary}
                  summaryHref={`/second-opinion/vaka/${c.id}`}
                  summaryLabel={t(S.caseSummary)}
                  alert={c.hasPendingReq ? t(S.actionNeeded) : null}
                  nextStepLabel={t(S.nextStep)}
                  nextStep={t(c.nextStep)}
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
                stageInk={STAGE_INK[c.status] ?? "var(--c-ink-3)"}
                date={formatDateTime(c.createdAt)}
                patientName={c.patientName}
                country={c.country}
                body={c.symptoms}
                summaryHref={`/vaka/${c.id}`}
                summaryLabel={t(S.caseSummary)}
                alert={c.status === "DOCS_PENDING" ? t(S.actionNeeded) : null}
                nextStepLabel={t(S.nextStep)}
                nextStep={t(c.nextStep)}
              />
            );
          })}
        </div>

        {/* Keyset sayfalama: "sonraki" = sayfanın son (createdAt, id) çifti; imleç varken başa dönüş bağlantısı. */}
        {(nextCursor || cursor) && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
            {cursor ? (
              <Link href={listHref(group, filters)} className="text-[var(--c-ink-2)] hover:text-[var(--c-ink)] hover:underline">
                {t(S.firstPage)}
              </Link>
            ) : <span />}
            {nextCursor && (
              <Link
                href={listHref(group, filters, nextCursor)}
                className="inline-flex items-center gap-1 font-medium text-[var(--c-accent)] hover:text-[var(--c-accent-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-accent)]"
              >
                {t(S.nextPage)} ({PATIENT_PAGE_SIZE}) <ChevronRight size={14} className="rtl:rotate-180" />
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Yeni başvuru → 4 kulvar seçim modalı */}
      {pickerOpen && (
        <div
          dir={langDir(lang)}
          lang={LANG_BCP47[lang]}
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
                const accent = LANE_ACCENT[p.key];
                return (
                  // Renk disiplini (v6.22): seçenek zeminleri nötr; kulvar kimliği ikon çipi +
                  // kenar şeridi + ok renginde. (Eski renkli-zemin + koyu ink metin gece okunmazdı.)
                  <Link
                    key={p.key}
                    href={p.href}
                    className="flex items-center gap-3 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-3 transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-accent)]"
                    style={{ borderInlineStart: `3px solid ${accent}` }}
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: L.color, color: L.on }}>
                      {createElement(Icon, { size: 18, color: L.on })}
                    </span>
                    <span className="font-semibold text-[var(--c-ink)]">{t(L.name)}</span>
                    <ArrowRight size={16} className="ms-auto rtl:rotate-180" style={{ color: accent }} />
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

// Sakin kulvar kartı (v6.22 — eski "cam kutu" tasarımının halefi; /palet-onizleme V2 kullanıcı
// seçimi): yüzeyler nötr gece paneli; kulvar rengi YALNIZ 3px kenar şeridi + mono etiket,
// branş yalnız amblem, etkileşim tek vurgu (turkuaz). Klinik durum noktası korunur.
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
  nextStepLabel,
  nextStep,
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
  /** H11: kart başına TEK sonraki adım — durum rozetinin altında, gövdeden sonra. */
  nextStepLabel: string;
  nextStep: string;
}) {
  const accent = LANE_ACCENT[lane];
  const dot = stageInk; // tema-duyarlı var(--c-*) token'ı (çağıran geçirir)
  return (
    <article
      className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-5"
      style={{ borderInlineStart: `3px solid ${accent}` }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <BranchAvatar branchKey={branchKey} size={24} />
          <span className="aura-display min-w-0 truncate text-[16px] font-medium tracking-tight text-[var(--c-ink)]">{branchName}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {alert && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200 ring-1 ring-amber-400/30">
              <Bell size={11} /> {alert}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--c-hairline)] bg-[var(--c-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--c-ink-2)]">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} /> {stageLabel}
          </span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--c-ink-3)]">
        {patientName && <span className="font-medium text-[var(--c-ink-2)]">{patientName}</span>}
        {country && <span>{countryFlag(country)}</span>}
        <span>{date}</span>
      </div>
      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--c-ink-2)]">{body}</p>
      <p className="mt-2.5 flex flex-wrap items-baseline gap-x-2 text-[13px] leading-relaxed text-[var(--c-ink)]">
        <span className="aura-mono text-[10px] uppercase tracking-[0.18em] text-[var(--c-ink-3)]">{nextStepLabel}</span>
        <span>{nextStep}</span>
      </p>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--c-hairline)] pt-3">
        <span className="aura-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: accent }}>{laneName}</span>
        <Link
          href={summaryHref}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--c-accent)] transition-colors duration-200 hover:text-[var(--c-accent-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-accent)]"
        >
          <FileText size={14} /> {summaryLabel} <ArrowRight size={13} className="rtl:rotate-180" />
        </Link>
      </div>
    </article>
  );
}
