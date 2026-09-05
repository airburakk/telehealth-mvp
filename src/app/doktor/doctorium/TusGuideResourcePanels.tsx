import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { approvedTusGuides, TUS_GUIDE_DISCLAIMER, TUS_GUIDE_SOURCE } from "@/lib/tus-guides";
import {
  approvedCourseProviders, approvedResources, TUS_COURSE_FORMAT_LABEL, TUS_RESOURCE_KIND_LABEL,
} from "@/lib/tus-resources";
import { formatIsoDayTr } from "@/lib/iso-day";
import { AuraPanel } from "@/components/ui/AuraPanel";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * TUS REHBERLERİ (K3) + KAYNAKÇA / KURS DİZİNİ (K4) panelleri — 2026-09-05, 👤 kararlar: rehber = YALNIZ resmî kılavuz özeti;
 * kurs/kaynakça = TARAFSIZ KÜNYE (sıralama/puan/fiyat/öneri/bağlı link YOK, "sponsorlu değil, tanıtım değil" dipnotu).
 * Sunucu bileşenleri; veri saf modüllerden (lib/tus-guides · lib/tus-resources), 👤 approvedAt dolu kayıtlar. Onaylı kayıt yoksa
 * dürüst "hazırlanıyor" — uydurma satır YOK. CareerEduSections bu dosyayı import eder (tersi DEĞİL — döngü yok).
 * Renk: sabit hex yok; kitle aksanı token'ı (--c-accent).
 */
export const TUS_REHBER_HREF = (slug: string) => `/doktor/doctorium/tus/rehber/${slug}`;
export const TUS_RESOURCES_ANCHOR = "/doktor/doctorium/tus#kaynakca";

export function TusGuidesPanel({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const guides = approvedTusGuides();
  if (guides.length === 0) {
    return (
      <EmptyState
        className={className}
        title="Kılavuz özetleri hazırlanıyor"
        sub="ÖSYM kılavuzunun bölüm özetleri kaynak ve tarihle doğrulanıp onaylandığında burada görünecek."
      />
    );
  }
  return (
    <AuraPanel title="Rehberler" meta="ÖSYM KILAVUZU ÖZETLERİ" className={className}>
      <ul className={compact ? "grid gap-2 sm:grid-cols-2" : "grid gap-3 sm:grid-cols-2"}>
        {guides.map((g) => (
          <li key={g.slug} className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] p-4">
            <Link href={TUS_REHBER_HREF(g.slug)} className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-[var(--c-ink)] hover:text-[var(--c-accent)]">
              {g.title} <ArrowRight size={14} aria-hidden />
            </Link>
            {!compact && <p className="mt-1 text-[13px] leading-relaxed text-[var(--c-ink-2)]">{g.summary}</p>}
            <div className="aura-mono mt-2 text-[10.5px] uppercase tracking-wider text-[var(--c-ink-3)]">
              {g.sections.length} bölüm · doğrulama {formatIsoDayTr(g.verifiedAt)}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] leading-relaxed text-[var(--c-ink-3)]">
        {TUS_GUIDE_DISCLAIMER} Kaynak:{" "}
        <a href={TUS_GUIDE_SOURCE.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
          {TUS_GUIDE_SOURCE.label} <ExternalLink size={11} aria-hidden />
        </a>
      </p>
    </AuraPanel>
  );
}

export function TusResourcesPanel({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const resources = approvedResources();
  const courses = approvedCourseProviders();
  if (resources.length === 0 && courses.length === 0) {
    return (
      <EmptyState
        className={className}
        title="Kaynakça ve kurs dizini hazırlanıyor"
        sub="Künyeler kurumların kendi sitelerinden doğrulanıp onaylandığında burada alfabetik listelenecek."
      />
    );
  }
  if (compact) {
    return (
      <p className={`text-[12.5px] leading-relaxed text-[var(--c-ink-2)] ${className}`}>
        Kaynakça ve hazırlık kurumları dizini ({resources.length} kaynak · {courses.length} kurum; tarafsız künye, alfabetik) TUS sayfasında —{" "}
        <Link href={TUS_RESOURCES_ANCHOR} className="font-semibold text-[var(--c-accent)] hover:underline">Ayrıntı</Link>.
      </p>
    );
  }
  return (
    <AuraPanel title={<span id="kaynakca">Kaynakça ve kurs dizini</span>} meta="TARAFSIZ KÜNYE · ALFABETİK" className={className}>
      <p className="max-w-[72ch] text-[12.5px] leading-relaxed text-[var(--c-ink-2)]">
        Bu dizin sponsorlu değildir, tanıtım değildir. Kayıtlar yalnız künyedir (ad, kurum, resmî site, biçim); fiyat, puan, sıralama ve öneri
        içermez, sıra alfabetiktir. Doctorium&apos;un listelenen kurumlarla ticari ilişkisi yoktur; her künye kurumun kendi sitesinden doğrulanmıştır.
      </p>

      {resources.length > 0 && (
        <section className="mt-5">
          <h3 className="aura-mono text-[11px] font-bold tracking-[0.16em] text-[var(--c-ink-3)]">KAYNAKLAR</h3>
          <ul className="mt-2 divide-y divide-[var(--c-hairline)]">
            {resources.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:gap-4">
                <span className="aura-mono w-32 shrink-0 text-[10.5px] uppercase tracking-wider text-[var(--c-ink-3)]">{TUS_RESOURCE_KIND_LABEL[r.kind]}</span>
                <div className="min-w-0">
                  <a href={r.officialUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[var(--c-ink)] hover:text-[var(--c-accent)]">
                    {r.name} <ExternalLink size={13} aria-hidden />
                  </a>
                  {r.organization && <div className="text-[12px] text-[var(--c-ink-3)]">{r.organization}</div>}
                  <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--c-ink-2)]">{r.note}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {courses.length > 0 && (
        <section className="mt-6">
          <h3 className="aura-mono text-[11px] font-bold tracking-[0.16em] text-[var(--c-ink-3)]">HAZIRLIK KURUMLARI</h3>
          <ul className="mt-2 grid gap-3 sm:grid-cols-2">
            {courses.map((c) => (
              <li key={c.id} className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] p-4">
                <a href={c.officialUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[var(--c-ink)] hover:text-[var(--c-accent)]">
                  {c.name} <ExternalLink size={13} aria-hidden />
                </a>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12.5px]">
                  <dt className="text-[var(--c-ink-3)]">Biçim</dt><dd className="text-[var(--c-ink-2)]">{TUS_COURSE_FORMAT_LABEL[c.format]}</dd>
                  {c.cities && <><dt className="text-[var(--c-ink-3)]">Merkez</dt><dd className="text-[var(--c-ink-2)]">{c.cities.join(", ")}</dd></>}
                  {c.founded !== null && <><dt className="text-[var(--c-ink-3)]">Kuruluş</dt><dd className="tabular-nums text-[var(--c-ink-2)]">{c.founded}</dd></>}
                  <dt className="text-[var(--c-ink-3)]">Hizmet</dt><dd className="text-[var(--c-ink-2)]">{c.services.join(" · ")}</dd>
                </dl>
                <div className="aura-mono mt-2 text-[10.5px] uppercase tracking-wider text-[var(--c-ink-3)]">doğrulama {formatIsoDayTr(c.verifiedAt)}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-[var(--c-ink-3)]">
        Kurumların sitelerindeki iddia, karşılaştırma ve fiyat bilgileri aktarılmaz. Bir künyenin güncelliğini yitirdiğini görürseniz Doctorium&apos;a bildirin.
      </p>
    </AuraPanel>
  );
}
