import { GraduationCap, Mail } from "lucide-react";
import { section } from "@/lib/doctorium-landing/content";
import { LANDING_ROUTES } from "@/lib/doctorium-landing/routes";
import { statusRozet } from "@/lib/doc-status";
import { CtaLink } from "../CtaLink";
import { ProductFrame } from "../../doctorium-v2/ProductFrame";
import { FadeInUp } from "../motion";
import { LandingSection, SectionHead } from "../primitives";

// Satır verisi v2 ile birebir (temsilî görünüm sözleşmesi + v6.143 öğrenci e-posta kapısı notu
// oradadır); rozet sınıfları ProductFrame'in --c-* temasında yaşar, bölüm temasından bağımsız.
const ROWS = [
  { Icon: GraduationCap, label: "Tıp Diploması", sub: "Doktor üyeliği — e-Devlet barkodlu mezun belgesi", doc: { type: "DIPLOMA", status: "ACCEPTED", verifiedSource: "EDEVLET" } as const, badge: null },
  { Icon: GraduationCap, label: "Tıp Diploması", sub: "Doktor üyeliği — belge incelemesi", doc: { type: "DIPLOMA", status: "PENDING", verifiedSource: null } as const, badge: null },
  { Icon: Mail, label: "Üniversite E-postası", sub: "Tıp/Diş Hekimliği öğrencisi üyeliği — pazarlama yüzeyleri kapalı", doc: null, badge: { text: "Doğrulandı", cls: "bg-emerald-500/15 text-emerald-300" } },
] as const;

export function IdentitySection() {
  const copy = section("identity");
  const student = copy.ctas?.find((c) => c.to === "student");
  return (
    <LandingSection copy={copy}>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[1fr_.9fr] lg:gap-16">
        <FadeInUp>
          <SectionHead copy={copy} />
          {student && (
            <div className="mt-8">
              <CtaLink href={LANDING_ROUTES.student} event="student_click" placement="identity">{student.label}</CtaLink>
            </div>
          )}
        </FadeInUp>
        <ProductFrame title="Belgelerim" meta="temsilî görünüm">
          <ul className="grid grid-cols-[minmax(0,1fr)]">
            {ROWS.map((r, i) => {
              const badge = r.doc ? statusRozet(r.doc) : r.badge;
              return (
                <li key={i} className="flex items-center justify-between gap-3 border-t border-[var(--c-hairline)] py-3.5 first:border-t-0 first:pt-1">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface-2)] text-[var(--c-ink-2)]">
                      <r.Icon size={16} />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-semibold text-[var(--c-ink)]">{r.label}</div>
                      <div className="truncate text-[12px] text-[var(--c-ink-3)]">{r.sub}</div>
                    </div>
                  </div>
                  {badge && (
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.cls}`}>{badge.text}</span>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 border-t border-[var(--c-hairline)] pt-3 text-[11px] leading-relaxed text-[var(--c-ink-3)]">
            Rozet metinleri ürünün gerçek durum kuralından gelir; satırlar temsilîdir, gerçek üye verisi değildir.
            Doğrulama belge incelemesidir; akreditasyon anlamına gelmez.
          </p>
        </ProductFrame>
      </div>
    </LandingSection>
  );
}
