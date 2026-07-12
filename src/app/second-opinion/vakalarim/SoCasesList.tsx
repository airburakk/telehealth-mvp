"use client";

import Link from "next/link";
import { useMemo } from "react";
import { SO_STATUS_LABELS, type SoStatus } from "@/lib/second-opinion";
import { useT } from "@/components/useT";
import { useSoLang, SoLangSelect } from "@/components/SoLocale";
import { Stethoscope, Plus, ArrowRight, Inbox, Bell, FolderHeart } from "lucide-react";
import { langDir } from "@/lib/constants";

type Row = { id: string; branchLabel: string; status: string; diagnosisSummary: string; createdAt: string; hasPendingReq: boolean };

const S = {
  title: "İkinci Görüş Vakalarım",
  subtitle: "Uzmandan bağımsız değerlendirme başvurularınız.",
  newBtn: "Yeni ikinci görüş",
  allCases: "Tüm vakalarım",
  empty: "Henüz ikinci görüş başvurunuz yok.",
  createBtn: "Başvuru oluştur",
  actionNeeded: "İşlem gerekiyor",
} as const;

export function SoCasesList({ rows }: { rows: Row[] }) {
  const [lang, setLang] = useSoLang();
  const texts = useMemo(
    () => [...Object.values(S), ...Object.values(SO_STATUS_LABELS), ...rows.map((r) => r.branchLabel)],
    [rows],
  );
  const { t } = useT(lang, texts);

  return (
    <div dir={langDir(lang)} className="mx-auto max-w-3xl px-5 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#28C8D8] text-[#0D0E10]"><Stethoscope size={22} /></span>
          <div>
            <h1 className="text-2xl font-bold text-[#F4F5F3]">{t(S.title)}</h1>
            <p className="text-sm text-white/50">{t(S.subtitle)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <SoLangSelect lang={lang} onChange={setLang} />
          {/* Kulvar köprüsü — SO silosundan tüm vakalara/diğer kulvar kartlarına çıkış (karma-kulvar düzeltmesi) */}
          <Link href="/vakalarim" className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white/70 hover:border-[#28C8D8]/40 hover:text-[#F4F5F3]">
            <FolderHeart size={16} /> {t(S.allCases)}
          </Link>
          <Link href="/second-opinion/basvur" className="inline-flex items-center gap-1.5 rounded-lg bg-[#28C8D8] px-4 py-2 text-sm font-semibold text-[#0D0E10] hover:bg-[#1FA9B8]">
            <Plus size={16} /> {t(S.newBtn)}
          </Link>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {rows.length === 0 && (
          <div className="rounded-3xl border border-dashed border-white/15 bg-[#161719] py-14 text-center">
            <Inbox className="mx-auto mb-2 text-white/25" size={28} />
            <p className="text-sm text-white/50">{t(S.empty)}</p>
            <Link href="/second-opinion/basvur" className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#28C8D8] px-4 py-2 text-sm font-semibold text-[#0D0E10] hover:bg-[#1FA9B8]">
              <Plus size={15} /> {t(S.createBtn)}
            </Link>
          </div>
        )}

        {rows.map((c) => (
          <Link
            key={c.id}
            href={`/second-opinion/vaka/${c.id}`}
            className="block rounded-3xl border border-white/10 bg-[#161719] p-5 shadow-sm transition hover:border-[#28C8D8]/40 hover:shadow"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 font-semibold text-[#F4F5F3]">
                    <Stethoscope size={14} className="text-[#1FA9B8]" /> {t(c.branchLabel)}
                  </span>
                  <span className="rounded-full bg-[#28C8D8]/10 px-2 py-0.5 text-[11px] font-semibold text-[#17919E]">{t(SO_STATUS_LABELS[c.status as SoStatus] ?? c.status)}</span>
                  {c.hasPendingReq && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300 ring-1 ring-amber-400/25">
                      <Bell size={11} /> {t(S.actionNeeded)}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 line-clamp-2 text-sm text-white/65">{c.diagnosisSummary}</p>
                <div className="mt-1 text-xs text-white/40">{new Date(c.createdAt).toLocaleString(lang === "Türkçe" ? "tr-TR" : undefined, { dateStyle: "medium", timeStyle: "short" })}</div>
              </div>
              <ArrowRight size={16} className="mt-1 shrink-0 text-white/25" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
