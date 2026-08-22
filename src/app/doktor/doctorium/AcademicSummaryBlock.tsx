import { Sparkles, AlertTriangle, FlaskConical, ListChecks, ShieldQuestion } from "lucide-react";
import type { ClinicalSummary } from "@/lib/doctorium";

// AI klinik özet bloğu — [id]/page.tsx'ten ÇIKARILDI (2026-08-23; landing V2 "Akademik" bölümü
// aynı bileşeni salt-okunur gösterir; kopya = drift). Prop-only, DB'siz, hook'suz (sunucu/istemci
// fark etmez). Başlık "2 dakikalık" ibaresi portalda kalır; landing `compact` modunda ölçülmemiş
// süre iddiası YAZILMAZ ([[public-claim-honesty]]).
//
// Uyarı bandı: PORTALDA KALDIRILAMAZ (karar destek aracı değildir; `disclaimer` varsayılanı true,
// [id]/page.tsx prop geçmez). Landing V2 `disclaimer={false}` verir — kullanıcı kararı 2026-08-23:
// uyarı metinleri REVİZE EDİLECEK, tanıtım sayfası eski hâlini sergilemesin. "Yapay zekâ ile
// üretildi" İŞARETİ compact başlıkta sürer (registry academic.ai_flag kanıtı bozulmaz).
export function AcademicSummaryBlock({
  summary, compact = false, disclaimer = true,
}: { summary: ClinicalSummary; compact?: boolean; disclaimer?: boolean }) {
  return (
    <section className={`rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.07] ${compact ? "p-4" : "mt-6 p-5"}`}>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
        <Sparkles size={16} /> {compact ? "Klinik özet — yapay zekâ ile üretildi" : "2 dakikalık klinik özet"}
      </h2>

      <div className="mt-3.5">
        <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--c-ink-3)]">
          <ListChecks size={13} /> Ana çıkarımlar
        </h3>
        <ul className="mt-1.5 grid gap-1.5">
          {summary.takeaways.map((t, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed text-[var(--c-ink)]">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
              {t}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--c-ink-3)]">
            <FlaskConical size={13} /> Çalışma tasarımı
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-[var(--c-ink-2)]">{summary.design}</p>
        </div>
        <div>
          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--c-ink-3)]">
            <ShieldQuestion size={13} /> Kısıtlılıklar
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-[var(--c-ink-2)]">{summary.limits}</p>
        </div>
      </div>

      {disclaimer && (
        <p className="mt-4 flex items-start gap-2 border-t border-emerald-400/20 pt-3 text-[11px] leading-relaxed text-amber-200/90">
          <AlertTriangle size={13} className="mt-px shrink-0" />
          Bu özet yapay zekâ ile üretilmiştir ve <strong>klinik karar aracı değildir</strong>. Hasta
          bakımına ilişkin her karardan önce yayının tam metnini kendiniz değerlendirin.
        </p>
      )}
    </section>
  );
}
