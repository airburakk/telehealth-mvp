"use client";

import { AuraClosing } from "./closing";
import { AuraNav } from "./nav";
import { LETTERS, LangProvider, langDir, useLang, type Copy } from "@/lib/aura-landing/i18n";

type Section = Copy["trustPage"]["sections"][number];

// /guven-ve-gizlilik — Güven ve Gizlilik sayfası (2026-07-15).
// Global Header/SiteFooter bu rotada gizlidir (Header.tsx/SiteFooter.tsx rota
// listesi) — sayfa kendi aura nav/footer'ını taşır; /how-it-works ile aynı desen.
//
// SAYFANIN SÖZLEŞMESİ [[public-claim-honesty]]: her madde kod kanıtlı, kanıt
// haritası vault'ta (output/trust-safety-sayfa-taslagi-2026-07-15.md). Buraya
// madde EKLEMEDEN önce kod kanıtını göster; "planlanan" olan ayrı işaretlenir.
// Sayfanın asıl değeri "neyi iddia etmiyoruz" kutuları (kullanıcı kararı) →
// note.text dolu olan bölümlerde turkuaz kenarlı kutu olarak çizilir; bu kutular
// bir istisna değil, sayfanın omurgasıdır — sessizce kaldırılmaz.
export function TrustSafety() {
  return (
    <LangProvider>
      <TrustShell />
    </LangProvider>
  );
}

function TrustShell() {
  const { lang } = useLang();
  return (
    <div dir={langDir(lang)} lang={lang} className="aura-page min-h-dvh">
      <AuraNav />
      <main className="pt-16">
        <TrustHero />
        <TrustSections />
      </main>
      <AuraClosing />
    </div>
  );
}

// Hero: /how-it-works ile aynı letterform dili (wordBefore / AURA dilimleri +
// wordAfter / lineAfter — boş parça render edilmez; diller söz dizimine göre
// parçaları farklı doldurur).
function TrustHero() {
  const { t } = useLang();
  const p = t.trustPage;
  const label = [p.wordBefore, p.word + p.wordAfter, p.lineAfter].filter(Boolean).join(" ");

  return (
    <section className="mx-auto max-w-6xl px-5 pb-6 pt-14 md:px-8 md:pt-24">
      <p className="aura-mono text-sm text-[var(--aura-accent)]">/ {p.eyebrow}</p>
      <h1
        aria-label={label}
        className="aura-display mt-4 text-4xl font-bold leading-tight tracking-tighter text-[var(--aura-ink)] md:text-6xl"
      >
        <span aria-hidden className="block">
          {p.wordBefore && <span className="block">{p.wordBefore}</span>}
          <span className="aura-word mt-3 flex items-end gap-[0.14em]">
            {LETTERS.map((letter) => (
              <img
                key={letter}
                src={`/assets/letters/${letter}.png`}
                alt=""
                draggable={false}
                className="h-[0.9em] w-auto"
              />
            ))}
            {p.wordAfter && <span className="ml-1">{p.wordAfter}</span>}
          </span>
          {p.lineAfter && <span className="mt-3 block">{p.lineAfter}</span>}
        </span>
      </h1>
      <p className="mt-6 max-w-2xl text-base leading-relaxed text-[var(--aura-grey)] md:text-lg">
        {p.sub}
      </p>
    </section>
  );
}

function TrustSections() {
  const { t } = useLang();
  const p = t.trustPage;

  return (
    <section className="mx-auto max-w-6xl px-5 pb-24 md:px-8">
      <div className="grid gap-4">
        {p.sections.map((s) => (
          <TrustCard key={s.key} section={s} />
        ))}
      </div>
    </section>
  );
}

// Bölüm kartı: numara + başlık + gövde; bölüme özgü iki parça kökte durduğu
// için (8 dilin yapı imzası birebir kalsın diye) burada KEY ile bağlanır —
// index ile değil: sıra değişirse sessizce yanlış bölüme düşmesin.
function TrustCard({ section }: { section: Section }) {
  const { t } = useLang();
  const p = t.trustPage;

  return (
    <article
      id={`trust-${section.key}`}
      className="scroll-mt-20 rounded-[18px] border border-[var(--aura-hairline)] bg-[var(--aura-panel)] p-6 md:p-8"
    >
      <p className="aura-mono text-[12px]">
        <span className="aura-badge">
          {section.n} / {p.sections.length}
        </span>
      </p>
      <h2 className="aura-display mt-3 text-xl font-bold leading-snug tracking-tight text-[var(--aura-ink)] md:text-2xl">
        {section.title}
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--aura-grey)] md:text-base">
        {section.body}
      </p>

      {/* 02 — AI destegi ile klinik yargi ayrimi (howItWorks.safety ile ayni sinir). */}
      {section.key === "consent" && (
        <p className="mt-4 max-w-3xl border-s-2 border-[var(--aura-accent)]/60 ps-4 text-sm leading-relaxed text-[var(--aura-ink)] md:text-base">
          {p.aiEmphasis}
        </p>
      )}

      {/* 08 — AB disina cikan sinirli durumlar. */}
      {section.key === "transfers" && (
        <ul className="mt-4 grid max-w-3xl gap-2.5">
          {p.transferItems.map((item, i) => (
            <li
              key={i}
              className="flex gap-2.5 text-sm leading-relaxed text-[var(--aura-grey)] md:text-base"
            >
              <span aria-hidden className="mt-[0.55em] h-1 w-1 shrink-0 rounded-full bg-[var(--aura-accent)]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}

      {/* "Neyi iddia etmiyoruz" / "Siniri" / "⚖️ Taslak" — sayfanin degeri burada. */}
      {section.note.text && (
        <div className="mt-5 max-w-3xl rounded-[14px] border border-[var(--aura-accent)]/30 bg-[var(--aura-accent)]/[0.06] p-4 md:p-5">
          <p className="aura-mono text-[12px] uppercase tracking-wider text-[var(--aura-accent)]">
            {section.note.label}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--aura-ink)]">{section.note.text}</p>
        </div>
      )}
    </article>
  );
}
