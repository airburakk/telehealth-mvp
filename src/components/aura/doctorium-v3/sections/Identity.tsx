import { GraduationCap, Mail } from "lucide-react";
import { section } from "@/lib/doctorium-landing/content";
import { LANDING_ROUTES } from "@/lib/doctorium-landing/routes";
import { TRIAL_LANDING_LINE } from "@/lib/doctorium-trial-copy";
import { isTrialEnabled } from "@/lib/doctorium-trial-flag";
import { statusRozet } from "@/lib/doc-status";
import { CtaLink } from "../CtaLink";
import { ProductFrame } from "../ProductFrame";
import { FadeInUp } from "../motion";
import { LandingSection, Note, SectionHead } from "../primitives";

// GÜVEN HUB'I (v6.262, 2026-09-10 — 👤 Karar 1): eski 09 "Profesyonel alan" + eski 11 "Güven" (şeffaflık) tek bölümde —
// kimlik doğrulama (Belgelerim çerçevesi) + özetin sınırı (4 madde) + bayrak açıkken deneme satırı + öğrenci CTA'sı.
// id/analytics yerleşimi "identity" sürer; nav çapası #guven buraya taşındı (content.ts). Görsel taslak: vault
// output/doctorium-landing-taslak-2026-09-09 GuvenHub artboard'ı.
//
// Satır verisi v2 ile birebir (temsilî görünüm sözleşmesi + v6.143 öğrenci e-posta kapısı notu oradadır); rozet sınıfları
// ProductFrame'in --c-* temasında yaşar, bölüm temasından bağımsız.
const ROWS = [
  { Icon: GraduationCap, label: "Tıp Diploması", sub: "Doktor üyeliği — e-Devlet barkodlu mezun belgesi", doc: { type: "DIPLOMA", status: "ACCEPTED", verifiedSource: "EDEVLET" } as const, badge: null },
  { Icon: GraduationCap, label: "Tıp Diploması", sub: "Doktor üyeliği — belge incelemesi", doc: { type: "DIPLOMA", status: "PENDING", verifiedSource: null } as const, badge: null },
  { Icon: Mail, label: "Üniversite E-postası", sub: "Tıp/Diş Hekimliği öğrencisi üyeliği — pazarlama yüzeyleri kapalı", doc: null, badge: { text: "Doğrulandı", cls: "bg-emerald-500/15 text-emerald-300" } },
] as const;

export function IdentitySection() {
  // Gövde v3-lokal kullanıcı metni (2026-08-26; content.ts gövdesi ".edu.tr" cümlesiyle registry testinin okuduğu kayıt
  // olarak kalır). Tırnaklar tipografik ("…") — düz " react/no-unescaped-entities lint'ine takılır. Sponsor/anket/ödül-kapalı
  // bilgisi sağdaki kartın üçüncü satırında yaşar.
  const copy = {
    ...section("identity"),
    body: "Doktor üyeliği, e-Devlet barkodlu “Mezun Belgesi”, Tıp öğrencisi üyeliği “üniversite e-postası doğrulaması” ile onaylanır.",
  };
  const student = copy.ctas?.find((c) => c.to === "student");
  // Deneme satırı yalnız bayrak açıkken (env iki Vercel projesine ayrı girer); metin tek kaynak doctorium-trial-copy.
  const trial = isTrialEnabled();
  return (
    <LandingSection copy={copy}>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[1fr_.9fr] lg:gap-16">
        <FadeInUp>
          <SectionHead copy={copy} />
          {/* Eski 11 "Güven"in dört maddesi — 2×2 ızgara (v6.262). */}
          <ol className="mt-10 grid border-y border-[var(--dl-line)] sm:grid-cols-2">
            {copy.items?.map((it, i) => (
              <li
                key={it.t}
                className={`py-5 pr-6 ${i % 2 === 1 ? "sm:border-l sm:border-[var(--dl-line)] sm:pl-6" : ""} ${i >= 2 ? "border-t border-[var(--dl-line)]" : i === 1 ? "border-t border-[var(--dl-line)] sm:border-t-0" : ""}`}
              >
                <span className="text-[12px] font-semibold tracking-[0.04em] text-[var(--dl-emerald)]">0{i + 1}</span>
                <div className="mt-2 text-[17px] font-medium leading-snug">{it.t}</div>
              </li>
            ))}
          </ol>
          {copy.note && <Note text={copy.note} className="mt-8" />}
          {trial && (
            <div className="mt-6 rounded-xl border border-[var(--dl-line)] bg-[var(--dl-panel)] px-4 py-3.5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--dl-muted)]">Deneme üyeliği</div>
              <p className="mt-1.5 text-[15px] leading-relaxed text-[var(--dl-ink)]">{TRIAL_LANDING_LINE}</p>
            </div>
          )}
          {student && (
            <div className="mt-8">
              <CtaLink href={LANDING_ROUTES.student} event="student_click" placement="identity">{student.label}</CtaLink>
            </div>
          )}
        </FadeInUp>
        <ProductFrame className="theme-light doctorium-scope" title="Belgelerim" meta="temsilî görünüm">
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
