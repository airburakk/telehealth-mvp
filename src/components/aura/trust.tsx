"use client";

import { FileCheck2, Lock, UsersRound, BadgeCheck, ScrollText, Stethoscope, type LucideIcon } from "lucide-react";
import { useLang } from "@/lib/aura-landing/i18n";

// Guven v4 — P0 DURUSTLUK YENIDEN KURGUSU (2026-07-15):
// ONCE: gsap sayacli demo metrikler (20k+ hasta / 40+ klinik / 4.9 puan) + uydurma
// hasta yorumlari (James W./Sofia M./Karim A.) + akreditasyon monogramlari
// (JCI/ISO 9001/TURSAB/TGA/KVKK — belgeli iliski YOK, 4'u 3. taraf markasi).
// SIMDI: yalniz URUNDE KANITLANABILIR (Tier A) 6 madde. Her maddenin kod karsiligi
// dogrulandi (consent.ts · crypto.ts · ownership.ts · admin/hekim-onay · audit.ts ·
// booking route agencySentAt kapisi). Eski Seffaflik bolumu buraya BIRLESTIRILDI
// (sifreleme iddiasi sayfada iki kez cikmasin) → transparency.tsx kaldirildi.
//
// KURAL: buraya madde eklemeden ONCE kod kanitini goster. Olculmemis metrik,
// dogrulanmamis yorum ve belgesiz kurum markasi bu bolume GIRMEZ.
// Metin copy.ts trust (8 dil).
const ITEM_ICONS: LucideIcon[] = [FileCheck2, Lock, UsersRound, BadgeCheck, ScrollText, Stethoscope];

export function AuraTrust() {
  const { t } = useLang();

  return (
    <section className="mx-auto max-w-6xl px-5 py-24 md:px-8 md:py-32">
      <div className="rounded-3xl border border-[var(--aura-hairline)] bg-[var(--aura-panel)] p-8 md:p-12">
        <h2 className="aura-display text-center text-2xl font-bold leading-tight tracking-tight text-[var(--aura-ink)] md:text-4xl">
          {t.trust.headline}
        </h2>
        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {t.trust.items.map((it, i) => {
            const Icon = ITEM_ICONS[i] ?? Lock;
            return (
              <div key={i} className="text-center md:text-start">
                <span className="inline-grid h-11 w-11 place-items-center rounded-xl bg-[var(--aura-accent)]/12 text-[var(--aura-accent-stronger)]">
                  <Icon size={20} strokeWidth={2} />
                </span>
                <h3 className="aura-display mt-4 text-base font-bold text-[var(--aura-ink)]">{it.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--aura-grey)]">{it.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
