"use client";

import Link from "next/link";
import { MessageSquareText, ClipboardCheck, Video, HeartPulse, ArrowRight, type LucideIcon } from "lucide-react";
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
              <h3 className="aura-display mt-4 text-lg font-bold text-[var(--aura-ink)]">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--aura-grey)]">{s.desc}</p>
            </li>
          );
        })}
      </ol>

      {/* AI sorumluluk notu (P0#5) — adımların hemen altında: AURA'nın desteklediği
          ile klinik yargının kime ait olduğunu ayırır. Sessiz ama gizlenmemiş. */}
      <p className="mx-auto mt-10 max-w-2xl text-center text-[13px] leading-relaxed text-[var(--aura-grey)]">
        {t.howItWorks.safety}
      </p>

      <div className="mt-8 text-center">
        <Link
          href="/how-it-works"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[var(--aura-accent)]/40 px-6 py-3 text-sm font-semibold text-[var(--aura-accent-stronger)] transition-colors hover:bg-[var(--aura-accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aura-accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--aura-bg)]"
        >
          {t.howItWorks.cta}
          <ArrowRight aria-hidden size={16} className="rtl:rotate-180" />
        </Link>
      </div>
    </section>
  );
}
