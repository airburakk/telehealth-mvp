"use client";

import { Fragment } from "react";
import Link from "next/link";
import { ArrowRight, Stethoscope } from "lucide-react";
import { AuraClosing } from "./closing";
import { AuraInlineWord, AuraWordText } from "./aura-word";
import { V2Nav } from "./v2/nav";
import { V2ClaimSection } from "./v2/claim-section";
import { DoctoriumLockup } from "./v2/doctorium-section";
import { LangProvider, langDir, useLang } from "@/lib/aura-landing/i18n";

// /for-clinicians (v6.17, Faz 2 kalanı) — doktor-yüzü vitrin sayfası.
// Sözlük /v2'deki kompakt bölümle ORTAK (copy.ts v2.clinicians — kanıt haritası
// orada): sayfa aynı dört maddeyi + "neyi iddia etmiyoruz" kutusunu gösterir,
// üstüne iki eylem koyar: doktor başvurusu (/kayit) + personel girişi
// (/kurumsal-giris). how-it-works sayfa sözleşmesiyle aynı: kök AuraNav +
// AuraClosing; global Header/SiteFooter bu rotada gizli (Header.tsx listesi).
// dir/lang KÖKE değil konteynere ([[nextfont-fallback-unicode-trap]] — lang ŞART).
export function ForClinicians() {
  return (
    <LangProvider>
      <Shell />
    </LangProvider>
  );
}

function Shell() {
  const { lang, t } = useLang();
  const c = t.v2.clinicians;

  return (
    <div dir={langDir(lang)} lang={lang} className="aura-page min-h-dvh">
      {/* V2Nav (taşıma 2026-07-16): kök AuraNav'ın /#ch-* çapaları yeni ana
          sayfada karşılıksız — site geneli nav artık tek bakım mimarisi. */}
      <V2Nav />
      <main className="pt-16">
        {/* Gündüz gövde: iddia bölümü /v2'dekiyle aynı iskeletten çizilir
            (tek kaynak) — yalnız cta.more köprüsü YOK (zaten bu sayfadayız),
            yerine iki eylem düğmesi. */}
        <div className="aura-light bg-[var(--aura-bg)]">
          {/* headingLevel=h1: bu sayfada iskelet başlığı SAYFA başlığıdır (Ray D a11y). */}
          <V2ClaimSection id="clinicians" copy={c} icon={Stethoscope} headingLevel="h1" />

          {/* Düz yazı köprüsü (kullanıcı isteği 2026-08-17, 2. tur): iddia bölümü ile
              Doctorium paneli ARASINDA tek paragraf — Doctorium ile doktorun neler
              yapabildiğini nesir diliyle anlatır (v2.doctorium.bridge, 9 dil). */}
          <DoctoriumBridgeProse />

          {/* Doctorium tanıtımı (kullanıcı isteği 2026-08-17): "bizimle çalışırsanız
              Doctorium'dan ne kazanırsınız" — başvuru/personel CTA'larından HEMEN ÖNCE
              (fayda anlatımı dönüşüm düğmelerini güçlendirsin). Metin v2.doctorium
              sözlüğünden (9 dil); maddeler canlı portal modülleri, ölçüsüz iddia yok.
              Zümrüt #047857 = lockup'ın gündüz değeri (beyazda AA — doctorium kuralı). */}
          <DoctoriumPromo />

          <div className="mx-auto max-w-6xl px-5 pb-24 md:px-8 md:pb-32">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {/* Ray D (axe, ölçüldü): gündüz --aura-accent (#17919e) üstü beyaz 3.76:1 = AA altı →
                  zemin accent-stronger (#0d6470, beyazla 6.83:1). Token zaten gündüz-kontrast için var. */}
              <Link
                href="/kayit"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[var(--aura-accent-stronger)] px-7 py-3.5 text-base font-semibold text-[var(--aura-white)] transition-transform duration-200 hover:translate-x-0.5 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aura-ink)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--aura-bg)]"
              >
                {c.cta.signup}
                <ArrowRight aria-hidden size={16} className="rtl:rotate-180" />
              </Link>
              {/* Doktor girişi (kullanıcı isteği 2026-08-17): başvurunun HEMEN yanında —
                  hedef /doctorium/giris kapısı (Doktor/Tıp Öğrencisi rolleri; iki aşamalı
                  giriş oradan yürür). Zümrüt kenar = Doctorium alt-marka vurgusu. */}
              <Link
                href="/doctorium/giris"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full border px-7 py-3.5 text-base font-semibold transition-colors hover:bg-[#047857]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#047857] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--aura-bg)]"
                style={{ borderColor: "rgba(4,120,87,.4)", color: "#047857" }}
              >
                {c.cta.doctorLogin}
              </Link>
              {/* Personel girişi düğmesi KALDIRILDI (kullanıcı kararı 2026-08-17):
                  sayfa doktora konuşuyor — personel /kurumsal-giris'e footer'daki
                  "Kurumsal giriş" linkinden ulaşır. c.cta.login sözlükte duruyor
                  (yapı imzası 9 dilde aynı kalsın). */}
            </div>
          </div>
        </div>
      </main>
      <AuraClosing />
    </div>
  );
}

// İki marka kuralını birden uygulayan nesir çizici: metin önce "Doctorium"
// geçişlerinden bölünür (→ Doctor ink + ium zümrüt lockup'ı), kalan parçalar
// AuraWordText'ten geçer (→ AURA wordmark görseli). "Doctorium'a" gibi ekler
// bölmeden sonra düz metin olarak lockup'ın hemen ardında kalır.
function BrandProse({ text }: { text: string }) {
  const parts = text.split("Doctorium");
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && <DoctoriumLockup />}
          <AuraWordText text={part} />
        </Fragment>
      ))}
    </>
  );
}

// Düz yazı köprüsü: bölüm değil, tek nesir paragrafı — iddia bölümünün ölçülü
// ritmiyle panel arasında nefes. Metin sözlükten (bridge), markalar BrandProse'la.
function DoctoriumBridgeProse() {
  const { t } = useLang();
  return (
    <section aria-label="Doctorium" className="mx-auto max-w-6xl px-5 pb-14 md:px-8">
      <p className="max-w-3xl text-base leading-relaxed text-[var(--aura-grey)] md:text-lg">
        <BrandProse text={t.v2.doctorium.bridge} />
      </p>
    </section>
  );
}

// "Doctorium'da neler var" paneli — doctorium-landing'in hairline satır dili
// (numara + başlık + gövde) aura gündüz token'larıyla.
function DoctoriumPromo() {
  const { t } = useLang();
  const d = t.v2.doctorium;
  const IUM = "#047857";

  return (
    <section aria-labelledby="fc-doctorium" className="mx-auto max-w-6xl px-5 pb-16 md:px-8">
      <div className="rounded-[22px] border border-[var(--aura-hairline)] bg-[var(--aura-panel)] p-6 md:p-10">
        <p
          className="aura-mono text-[12px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: IUM }}
        >
          {d.eyebrow}
        </p>
        <h2
          id="fc-doctorium"
          className="aura-display mt-3 text-2xl font-bold leading-[1.05] tracking-tighter text-[var(--aura-ink)] md:text-4xl"
        >
          <DoctoriumLockup />{" "}
          <span className="text-[var(--aura-grey)]">
            by <AuraInlineWord />
          </span>
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--aura-grey)]">
          <AuraWordText text={d.benefitsIntro} />
        </p>

        <ol className="mt-8 grid gap-x-10 gap-y-7 border-t border-[var(--aura-hairline)] pt-7 md:grid-cols-2">
          {d.benefits.map((b) => (
            <li key={b.n}>
              <span className="aura-mono text-[11px] font-semibold" style={{ color: IUM }}>
                {b.n}
              </span>
              <h3 className="aura-display mt-2 text-lg font-bold text-[var(--aura-ink)]">
                {b.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--aura-grey)]">{b.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-8">
          <Link
            href="/doctorium"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full border px-6 py-3 text-sm font-semibold transition-colors hover:bg-[#047857]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#047857] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--aura-bg)]"
            style={{ borderColor: "rgba(4,120,87,.4)", color: IUM }}
          >
            {d.cta}
            <ArrowRight aria-hidden size={16} className="rtl:rotate-180" />
          </Link>
        </div>
      </div>
    </section>
  );
}
