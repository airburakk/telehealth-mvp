"use client";

// Post Op hub listesi — hastanın takipli vakaları (çok dilli; sunum katmanı).
import { useMemo } from "react";
import Link from "next/link";
import { HeartPulse, ArrowRight } from "lucide-react";
import { useT } from "@/components/useT";
import { usePatientLang, PatientLangSelect } from "@/components/PatientLocale";
import { langDir } from "@/lib/constants";

export interface TakipRow {
  caseId: string;
  branch: string;
  status: string; // ACTIVE | COMPLETED
  startedAt: string;
  completedAt: string | null;
}

const TEXTS = [
  "Post-Op Takip",
  "Operasyon sonrası iyileşme takipleriniz — günlük kontrol girişleri ve doktor gözetimi.",
  "Aktif",
  "Tamamlandı",
  "Başlangıç",
  "Henüz post-op takibiniz yok.",
  "Takip, operasyonunuz sonrası doktorunuz yönlendirdiğinde burada görünür.",
  "Takibi aç",
];

export function TakipList({ rows }: { rows: TakipRow[] }) {
  const [lang, setLang] = usePatientLang();
  const texts = useMemo(() => TEXTS, []); // sabit referans — useT yarış dersi (v3.5)
  const { t } = useT(lang, texts);
  const dir = langDir(lang);

  return (
    <div dir={dir}>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-serif text-2xl font-semibold text-[#0D0E10]">
            <HeartPulse size={22} className="text-[#1FA9B8]" /> {t("Post-Op Takip")}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{t("Operasyon sonrası iyileşme takipleriniz — günlük kontrol girişleri ve doktor gözetimi.")}</p>
        </div>
        <PatientLangSelect lang={lang} onChange={setLang} />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-600">{t("Henüz post-op takibiniz yok.")}</p>
          <p className="mt-1 text-sm text-slate-400">{t("Takip, operasyonunuz sonrası doktorunuz yönlendirdiğinde burada görünür.")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Link key={r.caseId} href={`/takip/${r.caseId}`}
              className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#28C8D8]/50 hover:shadow">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#0D0E10]">{r.branch}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    r.status === "COMPLETED" ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-600"
                  }`}>
                    {r.status === "COMPLETED" ? t("Tamamlandı") : t("Aktif")}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">
                  {t("Başlangıç")}: {new Date(r.startedAt).toLocaleDateString("tr-TR")}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#1FA9B8]">
                {t("Takibi aç")} <ArrowRight size={15} className="transition group-hover:translate-x-0.5 rtl:rotate-180" />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
