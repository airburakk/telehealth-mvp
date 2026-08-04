"use client";

// Post Op hub listesi — hastanın takipli vakaları (çok dilli; sunum katmanı).
//
// GÖRSEL SÖZLEŞME (v6.64, kullanıcı isteği "post-op'ta yeknesaklık yok"): kart anatomisi
// /vakalarim kanonik vaka kartıyla BİREBİR aynı — 3px kulvar şeridi (post-op daima bir tedavi
// sürecinin devamı olduğu için `--lane-tourism` değil, vakanın kendi kulvarı kullanılamıyorsa
// nötr accent) · `BranchAvatar size={24}` + `aura-display text-[16px]` branş başlığı · durum
// rozeti = hairline çerçeve + TEMA-DUYARLI nokta (sabit emerald yerine `--c-success`) ·
// `rounded-2xl` + `p-5`. Kit dışına çıkmak DESIGN.md'de karar gerektirir.
import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useT } from "@/components/useT";
import { usePatientLang, PatientLangSelect } from "@/components/PatientLocale";
import { langDir, LANG_BCP47 } from "@/lib/constants";
import { BranchAvatar } from "@/components/BranchAvatar";
import { EmptyState } from "@/components/ui/EmptyState";

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
  // Kart gövdesi (v6.64.1) — kanonik vaka kartında gövde metni satırı var; post-op'ta
  // klinik veri gösterilmez (hasta beyanı doktor yüzeyine ait), durum cümlesi konur.
  "İyileşme takibiniz sürüyor — günlük kontrollerinizi bu ekrandan girebilirsiniz.",
  "Bu takip tamamlandı; geçmiş kayıtlarınız görüntülenmeye devam eder.",
  "Bitiş",
];

export function TakipList({ rows }: { rows: TakipRow[] }) {
  const [lang, setLang] = usePatientLang();
  const texts = useMemo(() => TEXTS, []); // sabit referans — useT yarış dersi (v3.5)
  const { t } = useT(lang, texts);
  const dir = langDir(lang);

  return (
    <div dir={dir} lang={LANG_BCP47[lang]}>
      {/* Başlık: /vakalarim ile aynı — dolu turkuaz ikon bloğu YOK (iç yüzeyde başka hiçbir
          sayfada kullanılmıyordu; post-op'u görsel olarak yalnızlaştırıyordu). */}
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="aura-display text-3xl font-medium tracking-tight text-[var(--c-ink)]">
            {t("Post-Op Takip")}
          </h1>
          <p className="mt-1 text-sm text-[var(--c-ink-2)]">{t("Operasyon sonrası iyileşme takipleriniz — günlük kontrol girişleri ve doktor gözetimi.")}</p>
        </div>
        <PatientLangSelect lang={lang} onChange={setLang} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={t("Henüz post-op takibiniz yok.")}
          sub={t("Takip, operasyonunuz sonrası doktorunuz yönlendirdiğinde burada görünür.")}
        />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const done = r.status === "COMPLETED";
            return (
              <Link key={r.caseId} href={`/takip/${r.caseId}`}
                className="group block rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-5 transition hover:border-[var(--c-accent)]/50"
                /* Post-op takibi sağlık turizmi kulvarının devamıdır → kulvar şeridi turkuaz. */
                style={{ borderInlineStart: "3px solid var(--lane-tourism)" }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <BranchAvatar branchKey={r.branch} size={24} />
                    <span className="aura-display min-w-0 truncate text-[16px] font-medium tracking-tight text-[var(--c-ink)]">
                      {r.branch}
                    </span>
                  </div>
                  {/* Durum rozeti = /vakalarim deseni: hairline çerçeve + tema-duyarlı nokta.
                      Sabit emerald yerine --c-success (gündüz temada okunaklı kalsın). */}
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--c-hairline)] bg-[var(--c-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--c-ink-2)]">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: done ? "var(--c-ink-3)" : "var(--c-success)" }} />
                    {done ? t("Tamamlandı") : t("Aktif")}
                  </span>
                </div>

                {/* Meta satırı + gövde: kanonik vaka kartıyla aynı ritim (mt-2 · xs/ink-3 → sm/ink-2) */}
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--c-ink-3)]">
                  <span>{t("Başlangıç")}: {new Date(r.startedAt).toLocaleDateString("tr-TR")}</span>
                  {done && r.completedAt && (
                    <span>· {t("Bitiş")}: {new Date(r.completedAt).toLocaleDateString("tr-TR")}</span>
                  )}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-[var(--c-ink-2)]">
                  {done
                    ? t("Bu takip tamamlandı; geçmiş kayıtlarınız görüntülenmeye devam eder.")
                    : t("İyileşme takibiniz sürüyor — günlük kontrollerinizi bu ekrandan girebilirsiniz.")}
                </p>

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--c-hairline)] pt-3">
                  <span className="aura-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: "var(--lane-tourism)" }}>
                    {t("Post-Op Takip")}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--c-accent)] transition-colors duration-200 group-hover:text-[var(--c-accent-2)]">
                    {t("Takibi aç")} <ArrowRight size={13} className="rtl:rotate-180" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
