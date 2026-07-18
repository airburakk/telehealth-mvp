"use client";

// Post Op hub listesi — hastanın takipli vakaları (çok dilli; sunum katmanı).
import { useMemo } from "react";
import Link from "next/link";
import { HeartPulse, ArrowRight } from "lucide-react";
import { useT } from "@/components/useT";
import { usePatientLang, PatientLangSelect } from "@/components/PatientLocale";
import { langDir, LANG_BCP47 } from "@/lib/constants";

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
    <div dir={dir} lang={LANG_BCP47[lang]}>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="aura-display flex items-center gap-2 text-3xl font-medium tracking-tight text-[var(--c-ink)]">
            <HeartPulse size={22} className="text-[var(--c-accent-strong)]" /> {t("Post-Op Takip")}
          </h1>
          <p className="mt-1 text-sm text-[var(--c-ink-2)]">{t("Operasyon sonrası iyileşme takipleriniz — günlük kontrol girişleri ve doktor gözetimi.")}</p>
        </div>
        <PatientLangSelect lang={lang} onChange={setLang} />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-[var(--c-ink-2)]">{t("Henüz post-op takibiniz yok.")}</p>
          <p className="mt-1 text-sm text-[var(--c-ink-3)]">{t("Takip, operasyonunuz sonrası doktorunuz yönlendirdiğinde burada görünür.")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Link key={r.caseId} href={`/takip/${r.caseId}`}
              className="group flex items-center justify-between gap-3 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-4 shadow-sm transition hover:border-[var(--c-accent)]/50 hover:shadow">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--c-ink)]">{r.branch}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    r.status === "COMPLETED" ? "bg-[var(--c-ink)]/10 text-[var(--c-ink-3)]" : "bg-emerald-500/10 text-emerald-300"
                  }`}>
                    {r.status === "COMPLETED" ? t("Tamamlandı") : t("Aktif")}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-[var(--c-ink-3)]">
                  {t("Başlangıç")}: {new Date(r.startedAt).toLocaleDateString("tr-TR")}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--c-accent-strong)]">
                {t("Takibi aç")} <ArrowRight size={15} className="transition group-hover:translate-x-0.5 rtl:rotate-180" />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
