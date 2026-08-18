"use client";

import Link from "next/link";
import { MessageSquareText, ClipboardCheck, Video, HeartPulse, ArrowRight, type LucideIcon } from "lucide-react";
import { AuraWordText } from "@/components/aura/aura-word";
import { useLang } from "@/lib/aura-landing/i18n";

// Nasıl çalışır (sandwich gündüz gövdesi): 4 adımlık süreç şeridi (Anlat → AI eşleştir →
// Video görüş → Takip) + /how-it-works detay sayfasına köprü. Chapters "ne sunuyoruz"u,
// bu bölüm "nasıl işliyor"u anlatır. Metin copy.ts howItWorks (8 dil).
//
// 2. adımın ikonu Sparkles DEĞİL (v6.16): yıldız-parıltı AI'yı ürünün öznesi gibi
// gösteriyordu; pano ikonu yapılan işi (vaka hazırlama) anlatır. Metin zaten doğruydu
// ([[public-claim-honesty]] v6.8) — ikon onunla çelişiyordu. Bölüm / ve /v2'de ORTAK.
const STEP_ICONS: LucideIcon[] = [MessageSquareText, ClipboardCheck, Video, HeartPulse];

export function AuraHowItWorks() {
  const { t } = useLang();

  return (
    <section id="how" className="mx-auto max-w-6xl px-5 py-24 md:px-8 md:py-32">
      <div className="text-center">
        <h2 className="aura-display text-3xl font-bold leading-none tracking-tighter md:text-5xl">
          {t.howItWorks.headline}
        </h2>
        <p className="aura-mono mt-3 text-[12px] text-[var(--aura-micro)]">{t.howItWorks.note}</p>
      </div>

      <ol className="mt-14 grid gap-8 md:grid-cols-4">
        {t.howItWorks.steps.map((s, i) => {
          const Icon = STEP_ICONS[i] ?? ClipboardCheck;
          return (
            <li key={i} className="relative">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--aura-accent)]/12 text-[var(--aura-accent-stronger)] ring-1 ring-[var(--aura-accent)]/25">
                  <Icon aria-hidden size={22} strokeWidth={2} />
                </span>
                <span className="aura-mono text-[11px] font-semibold text-[var(--aura-accent-stronger)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              {/* Metin içi AURA = wordmark görseli (kullanıcı kuralı 2026-08-17):
                  "AURA başvurunuzu hazırlar" adımındaki AURA logodaki yazımıyla çizilir. */}
              <h3 className="aura-display mt-4 text-lg font-bold text-[var(--aura-ink)]">
                <AuraWordText text={s.title} />
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--aura-grey)]">
                <AuraWordText text={s.desc} />
              </p>
            </li>
          );
        })}
      </ol>

      {/* AI sorumluluk notu (P0#5) — adımların hemen altında: AURA'nın desteklediği
          ile klinik yargının kime ait olduğunu ayırır. Sessiz ama gizlenmemiş. */}
      <p className="mx-auto mt-10 max-w-2xl text-center text-[13px] leading-relaxed text-[var(--aura-grey)]">
        <AuraWordText text={t.howItWorks.safety} />
      </p>

      <div className="mt-8 text-center">
        {/* Kapanış CTA giysisi (kullanıcı kararı 2026-08-18): closing.tsx'teki "Doktorla
            görüş" ve Doctorium bölümünün düğmesiyle AYNI efekt — hover'da bant yana kayar,
            kenardaki ince şerit bandı doldurur (opacity 15), ok ileri kayar. Renk buranın
            kendi accent'i kalır; efekt ortak, renk bölüme ait.
            🪤 Dolgu span'i absolute: konumlanmış öğe sonraki STATIC kardeşlerin üstünde
            çizilir → metin ve ok `relative` olmak ZORUNDA, yoksa dolgunun altında kalır.
            🪤 hover:bg-[...]/10 KALDIRILDI: dolgu şeridi artık aynı işi yapıyor, ikisi üst
            üste binerdi. Bu bölüm .aura-light içinde (beyaz) — accent açık tema değerini
            alır, opacity-15 dolgu beyazda da okunur kalır. */}
        <Link
          href="/how-it-works"
          className="group relative inline-flex min-h-[44px] items-center gap-2 overflow-hidden rounded-full border border-[var(--aura-accent)]/40 px-6 py-3 text-sm font-semibold text-[var(--aura-accent-stronger)] transition-transform duration-200 hover:translate-x-1 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aura-accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--aura-bg)] rtl:hover:-translate-x-1"
        >
          <span
            aria-hidden
            className="absolute inset-y-0 start-0 w-1 bg-[var(--aura-accent)] transition-all duration-300 group-hover:w-full group-hover:opacity-15"
          />
          <span className="relative">{t.howItWorks.cta}</span>
          <ArrowRight
            aria-hidden
            size={16}
            className="relative transition-transform duration-300 group-hover:translate-x-1.5 rtl:rotate-180 rtl:group-hover:-translate-x-1.5"
          />
        </Link>
      </div>
    </section>
  );
}
