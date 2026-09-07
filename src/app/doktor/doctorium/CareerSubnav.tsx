import Link from "next/link";
import { STUDENT_CAREER_TABS, type StudentCareerTabKey } from "@/lib/doctorium";
import { TUS_SECTIONS, tusSectionHref, type TusSectionKey } from "@/lib/tus";

/**
 * Kariyer bölümünün ALT GEZİNTİLERİ (2026-09-06, kullanıcı kararı: "öğrencinin Kariyer bölümü çok karmaşık; Hukuk'taki gibi
 * bölümlere ayır — bir tarafta staj/değişim/burs, diğer tarafta TUS; TUS'u da veriler · rehberler · sınav dönemleri diye böl").
 *
 *  · StudentCareerSubnav → 1. kademe: Fırsatlar | TUS. Hukuk şeridinin (page.tsx LEGAL_TABS) birebir eşleniği: küçük, alt çizgili
 *    aktiflik — modül pill'leriyle yarışmaz. Fırsatlar akış sayfasında (?m=kariyer), TUS ayrı rotada (/doktor/doctorium/tus —
 *    kurum tablosunun süzgeçleri o URL'de yaşar); çubuk İKİ sayfada da çizilir ki öğrenci tek bölümde iki sekme görsün.
 *  · TusSectionNav → 2. kademe (yalnız /tus): Veriler | Rehberler | Sınav dönemleri (?bolum=). Görsel olarak 1. kademeden
 *    ayrışsın diye çip dili (Etkinlik "Takip ettiklerim" çipiyle aynı aile), alt çizgi değil.
 * Sunucu bileşenleri; state yok. Renk: sabit hex YOK — kitle aksanı token'ı (öğrencide koral, doktorda zümrüt).
 */
export function StudentCareerSubnav({ active }: { active: StudentCareerTabKey }) {
  return (
    <nav className="mt-3.5 flex items-center gap-4 border-b border-[var(--c-hairline)]" aria-label="Kariyer bölümleri">
      {STUDENT_CAREER_TABS.map((t) => {
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={`-mb-px border-b-2 pb-2 text-xs font-semibold transition ${
              on ? "border-[var(--c-accent)] text-[var(--c-accent)]" : "border-transparent text-[var(--c-ink-2)] hover:text-[var(--c-ink)]"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function TusSectionNav({ active }: { active: TusSectionKey }) {
  const current = TUS_SECTIONS.find((s) => s.key === active) ?? TUS_SECTIONS[0];
  return (
    <div className="mt-6">
      <nav className="flex flex-wrap items-center gap-1.5" aria-label="TUS bölümleri">
        {TUS_SECTIONS.map((s) => {
          const on = s.key === active;
          return (
            <Link
              key={s.key}
              href={tusSectionHref(s.key)}
              aria-current={on ? "page" : undefined}
              className={`aura-mono inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition ${
                on
                  ? "bg-[var(--c-accent)]/15 text-[var(--c-accent)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--c-accent)_55%,transparent)]"
                  : "bg-[var(--c-surface)] text-[var(--c-ink-2)] shadow-[inset_0_0_0_1px_var(--c-hairline)] hover:text-[var(--c-ink)]"
              }`}
            >
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${on ? "bg-[var(--c-accent)]" : "bg-[var(--c-ink-3)]"}`} aria-hidden />
              {s.label}
            </Link>
          );
        })}
      </nav>
      <p className="mt-3 text-[12.5px] leading-relaxed text-[var(--c-ink-2)]">{current.desc}</p>
    </div>
  );
}
