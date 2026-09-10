import { AuraMark } from "@/components/AuraLogo";
import { DoctoriumStudentLockup } from "@/components/aura/doctorium-brand";
import { EduOpportunityRow, TusKpiStrip } from "@/app/doktor/doctorium/CareerEduSections";
import { EDU_KINDS, EDU_KIND_SHORT } from "@/lib/edu-opportunities";
import { section } from "@/lib/doctorium-landing/content";
import type { LandingProof } from "@/lib/doctorium-landing/landing-feed";
import { LANDING_ROUTES } from "@/lib/doctorium-landing/routes";
import { CtaLink } from "../CtaLink";
import { ProductFrame } from "../ProductFrame";
import { Rich } from "../rich-text";
import { FadeInUp } from "../motion";
import { Eyebrow, LandingSection, Note } from "../primitives";

// ÖĞRENCİLER bölümü (v6.262, 2026-09-10 — 👤 Karar 3 = Seçenek A + C; görsel taslak vault
// output/doctorium-landing-taslak-2026-09-09 Main/OgrenciMobil artboard'ları birebir).
//
// Kulvar rengi: KORAL — eyebrow · madde numarası · not çizgisi · düğme dolgusu · STUDENT lockup'ı. Bölüm NUMARASI sitenin
// zümrüdünde kalır (sayfa sistemi), "ium" marka zümrüdü (LOGO SABİT, YÜZEY AKSANI DEĞİŞİR — globals.css öğrenci bloğu).
// Landing token'ları --dl-coral (metin, yalnız kalın/küçük etiketlerde) ve --dl-coral-fill (dolgu) palette.ts'te.
//
// Kanıt penceresi = GERÇEK ürün bileşenleri (EduOpportunityRow · TusKpiStrip — portalla aynı markup) + GERÇEK onaylı
// veri (landing-feed studentsProof: DB, düşerse onaylı seed; ÖSYM son dönem özeti). Sahte kart YOK. Metinde adet
// yazılmaz; çip sayıları ve "Daha fazlasını gör (N)" render'da hesaplanır (35 branş kuralıyla aynı).
//
// 🪤 Öğrenci kapsamı SARMALAYICI: globals.css'in gündüz koral bloğu `.theme-light .doctorium-scope[data-audience="student"]`
// DESCENDANT seçicidir — theme-light ATA elemanda, doctorium-scope + data-audience ALT elemanda olmalı. Aynı elemana
// yazılsaydı yalnız tema-bağımsız blok eşleşir, metin aksanı gece koralı (#fb923c) çözülürdü.
const StudentScope = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`theme-light ${className}`.trim()}>
    <div className="doctorium-scope" data-audience="student">{children}</div>
  </div>
);

export function StudentsSection({ proof }: { proof: LandingProof["students"] }) {
  const copy = section("students");
  const cta = copy.ctas?.find((c) => c.to === "student");
  const total = proof.edu.length;
  const first = proof.edu.slice(0, 2);
  const rest = proof.edu.slice(2);
  const chips = [
    { key: "hepsi", label: "Hepsi", n: total, on: true },
    ...EDU_KINDS.map((k) => ({ key: k, label: EDU_KIND_SHORT[k], n: proof.counts[k], on: false })),
  ];
  return (
    <LandingSection copy={copy}>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[.85fr_1.15fr] lg:gap-16">
        <FadeInUp>
          {copy.eyebrow && <Eyebrow color="var(--dl-coral)">{copy.eyebrow}</Eyebrow>}
          {/* Lockup damgası: küre + "Doctorium [ STUDENT ]" (Header/portal footer ile aynı bileşen, DoctoriumStudentLockup
              aria-hidden'dır → erişilebilir ad sr-only). */}
          <div className="mt-4 flex items-center gap-3.5">
            <AuraMark size={48} tone="emerald" className="shrink-0" />
            <StudentScope><DoctoriumStudentLockup className="text-[32px] sm:text-[40px]" /></StudentScope>
            <span className="sr-only">Doctorium Student</span>
          </div>
          <h2 className="mt-5 max-w-[760px] text-[clamp(30px,4.4vw,52px)] font-medium leading-[1.08] tracking-[-0.02em]">
            <Rich text={copy.title} />
          </h2>
          {copy.lead && <p className="mt-5 text-[19px] leading-relaxed text-[var(--dl-body)]"><Rich text={copy.lead} /></p>}
          <ol className="mt-10 divide-y divide-[var(--dl-line)] border-y border-[var(--dl-line)]">
            {copy.items?.map((it) => (
              <li key={it.k} className="grid gap-2 py-5 sm:grid-cols-[64px_1fr]">
                <span className="text-[12px] font-semibold tracking-[0.04em] text-[var(--dl-coral)]">{it.k}</span>
                <div>
                  <div className="text-xl font-medium tracking-[-0.01em]">{it.t}</div>
                  {it.b && <p className="mt-1 text-[15px] leading-relaxed text-[var(--dl-body)]">{it.b}</p>}
                </div>
              </li>
            ))}
          </ol>
          {copy.note && <Note text={copy.note} tone="coral" className="mt-8" />}
          {cta && (
            <div className="mt-9">
              <CtaLink href={LANDING_ROUTES.student} variant="student" event="student_click" placement="ogrenci">
                <Rich text={cta.label} />
              </CtaLink>
            </div>
          )}
        </FadeInUp>
        <FadeInUp delay={0.08}>
          <StudentScope>
            <ProductFrame title="Kariyer · Fırsatlar" meta={proof.source === "live" ? "gerçek kayıtlar" : "onaylı kayıtlar"}>
              <ul className="mb-2 flex flex-wrap items-center gap-1.5" aria-label="Fırsat türü (örnek görünüm)">
                {chips.map((c) => (
                  <li
                    key={c.key}
                    className={`aura-mono inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      c.on
                        ? "bg-[var(--c-accent)]/15 text-[var(--c-accent)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--c-accent)_55%,transparent)]"
                        : "bg-[var(--c-surface)] text-[var(--c-ink-2)] shadow-[inset_0_0_0_1px_var(--c-hairline)]"
                    }`}
                  >
                    {c.label} <span className="tabular-nums opacity-70">{c.n}</span>
                  </li>
                ))}
              </ul>
              <ul className="divide-y divide-[var(--c-hairline)]">
                {first.map((o) => <EduOpportunityRow key={o.id} o={o} clampEligibility />)}
              </ul>
              {rest.length > 0 && (
                <details className="group mt-1 border-t border-[var(--c-hairline)] pt-3">
                  <summary className="cursor-pointer list-none text-[12px] font-semibold text-[var(--c-ink-2)] hover:text-[var(--c-ink)]">
                    <span className="group-open:hidden">Daha fazlasını gör ({rest.length})</span>
                    <span className="hidden group-open:inline">Daha az göster</span>
                  </summary>
                  <ul className="mt-1 divide-y divide-[var(--c-hairline)]">
                    {rest.map((o) => <EduOpportunityRow key={o.id} o={o} clampEligibility />)}
                  </ul>
                </details>
              )}
              {proof.tusLast && (
                <div className="mt-4 border-t border-[var(--c-hairline)] pt-3">
                  <div className="aura-mono mb-1 flex flex-wrap items-center justify-between gap-x-3 text-[11px] uppercase tracking-wider text-[var(--c-ink-3)]">
                    <span><span className="font-semibold text-[var(--c-accent)]">TUS</span> · ÖSYM yerleştirme verisi</span>
                    <span>{proof.tusPeriods} dönem</span>
                  </div>
                  <TusKpiStrip last={proof.tusLast} />
                </div>
              )}
              <p className="mt-3 border-t border-[var(--c-hairline)] pt-2.5 text-[11px] leading-relaxed text-[var(--c-ink-3)]">
                Geçmiş veridir; tercih tavsiyesi değildir. Başvuru daima kurumun kendi sayfasında yapılır; bu liste ilan değil,
                süreç bilgisidir. Takip ve hatırlatma giriş yapınca açılır.
              </p>
            </ProductFrame>
          </StudentScope>
        </FadeInUp>
      </div>
    </LandingSection>
  );
}
