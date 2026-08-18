"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AuraInlineWord, AuraWordText } from "@/components/aura/aura-word";
import { useLang } from "@/lib/aura-landing/i18n";

// Doctorium köprü bölümü (2026-08-17, ana sayfa sadeleşmesi) — ai/accessibility/
// clinicians bölümlerinin yerini alan TEK köprü: /doctorium landing'ine götürür.
// Ritimde AÇIK bölümdür (home.tsx'te .aura-light sarmalayıcısı içinde; trust(K)
// ile closing(K) arasındaki almaşık boşluğu doldurur).
//
// Marka lockup kuralı (doctorium-landing sözleşmesi, 2026-08-16): "Doctorium"
// geçen her metinde Doctor ink + ium zümrüt; açık zeminde zümrüt = #047857
// (.doctorium-ium gündüz değeri, beyazda AA). Lockup SÖZLÜKTE DEĞİL burada
// çizilir — çevrilebilir metinler t.v2.doctorium'dan gelir (9 dil).
//
// İddia disiplini (v6.8): sayılan alanlar canlı portal modüllerinin adlarıdır
// (akademik/sektörel/hukuk/kariyer/kongre) — ölçülmemiş oran/süre iddiası YOK.
const IUM_LIGHT = "#047857";

// export: for-clinicians'taki Doctorium tanıtım bölümü de aynı lockup'ı kullanır.
export function DoctoriumLockup() {
  return (
    <span className="whitespace-nowrap">
      <span className="text-[var(--aura-ink)]">Doctor</span>
      <span style={{ color: IUM_LIGHT }}>ium</span>
    </span>
  );
}

export function V2Doctorium() {
  const { t } = useLang();
  const d = t.v2.doctorium;

  return (
    <section
      id="doctorium"
      aria-labelledby="doctorium-heading"
      className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-24 md:px-8 md:py-32 lg:grid-cols-[1.2fr_.8fr] lg:gap-16"
    >
      <div>
        <p
          className="aura-mono text-[12px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: IUM_LIGHT }}
        >
          {d.eyebrow}
        </p>
        {/* Başlık = marka lockup'ı ("Doctorium by AURA") — dilden bağımsız, çevrilmez.
            AURA burada da düz yazı DEĞİL wordmark görseli (kullanıcı kuralı 2026-08-17;
            doctorium-landing ByAura emsali). */}
        <h2
          id="doctorium-heading"
          className="aura-display mt-4 text-3xl font-bold leading-[1.02] tracking-tighter text-[var(--aura-ink)] md:text-5xl"
        >
          <DoctoriumLockup />{" "}
          <span className="text-[var(--aura-grey)]">
            by <AuraInlineWord />
          </span>
        </h2>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-[var(--aura-grey)] md:text-lg">
          <AuraWordText text={d.body} />
        </p>
        <div className="mt-8">
          <Link
            href="/doctorium"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full border px-6 py-3 text-sm font-semibold transition-colors hover:bg-[#047857]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#047857] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--aura-bg)]"
            style={{ borderColor: "rgba(4,120,87,.4)", color: IUM_LIGHT }}
          >
            {d.cta}
            <ArrowRight aria-hidden size={16} className="rtl:rotate-180" />
          </Link>
        </div>
      </div>

      {/* Sol-şeritli panel kartı — doctorium-landing kart dili (aura token'larıyla). */}
      {/* Şerit border-inline-start ile: RTL'de (ar/fa) kendiliğinden sağa geçer. */}
      <article
        className="rounded-2xl border border-[var(--aura-hairline)] bg-[var(--aura-surface)]/60 p-6 md:p-8"
        style={{ borderInlineStartWidth: 3, borderInlineStartColor: IUM_LIGHT }}
      >
        <p className="aura-mono text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: IUM_LIGHT }}>
          {d.cardLabel}
        </p>
        <h3 className="aura-display mt-8 text-xl font-bold tracking-tight text-[var(--aura-ink)] md:mt-12 md:text-2xl">
          {d.cardTitle}
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-[var(--aura-grey)]">
          <AuraWordText text={d.cardBody} />
        </p>
      </article>
    </section>
  );
}
