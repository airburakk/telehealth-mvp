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
function DesignAndLimits({ summary }: { summary: ClinicalSummary }) {
  return (
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
  );
}

export function AcademicSummaryBlock({
  summary, compact = false, disclaimer = true,
}: { summary: ClinicalSummary; compact?: boolean; disclaimer?: boolean }) {
  return (
    <section className={`rounded-2xl border border-[var(--c-accent)]/25 bg-[var(--c-accent)]/10 ${compact ? "p-4" : "mt-6 p-5"}`}>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--c-accent)]">
        <Sparkles size={16} /> {compact ? "Klinik özet — yapay zekâ ile üretildi" : "2 dakikalık klinik özet"}
      </h2>

      <div className="mt-3.5">
        <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--c-ink-3)]">
          <ListChecks size={13} /> Ana çıkarımlar
        </h3>
        <ul className="mt-1.5 grid gap-1.5">
          {/* compact (landing): 2 çıkarım — pre-freeze polish 2026-08-23 ("2 kısa ana çıkarım +
              devamını gör"; ilk çıkarım tam[5 satır], ikinci kısaltılmış[3 satır] mobilde); portal tam liste. */}
          {(compact ? summary.takeaways.slice(0, 2) : summary.takeaways).map((t, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed text-[var(--c-ink)]">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--c-accent)]" />
              <span className={compact ? (i === 0 ? "max-sm:line-clamp-5" : "max-sm:line-clamp-3") : ""}>{t}</span>
            </li>
          ))}
        </ul>
      </div>

      {compact ? (
        /* Tasarım + kısıtlılıklar katlanır (native details — klavye/ekran okuyucu uyumlu, JS yok). */
        <details className="group mt-3">
          <summary className="cursor-pointer list-none text-[12px] font-semibold text-[var(--c-accent)] hover:underline">
            <span className="group-open:hidden">Devamını gör — çalışma tasarımı ve kısıtlılıklar</span>
            <span className="hidden group-open:inline">Daha az göster</span>
          </summary>
          <DesignAndLimits summary={summary} />
        </details>
      ) : (
        <DesignAndLimits summary={summary} />
      )}

      {disclaimer && (
        // ⚠️ flex + gap içinde ikon DIŞINDAKİ metin TEK span'e sarılı olmalı: serbest metin +
        // <strong> karışımı flex'in DOĞRUDAN çocuğu olursa her metin parçası (2 text node +
        // strong) AYRI flex item sayılır ve `gap` aralarına da girer — kelime boşluğu yerine
        // ~30px'lik yapay kopukluklar oluşur, metin "3 ayrı parça" gibi görünür (2026-09-04
        // kullanıcı bildirimi; hafıza [[aura-wordtext-flex-bosluk]] ile aynı sınıf hata).
        <p className="mt-4 flex items-start gap-2 border-t border-[var(--c-accent)]/20 pt-3 text-[11px] leading-relaxed text-amber-200/90">
          <AlertTriangle size={13} className="mt-px shrink-0" />
          <span>
            Bu özet, Yapay Zekâ ile üretilmiştir ve <strong>KLİNİK KARAR ARACI DEĞİLDİR</strong>.
            Aşağıdaki link üzerinden orijinal metne ulaşabilir; gerekli akademik ve mesleki
            incelemenizi gerçekleştirebilirsiniz.
          </span>
        </p>
      )}
    </section>
  );
}
