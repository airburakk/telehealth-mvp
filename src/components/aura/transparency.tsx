"use client";

import { ShieldCheck, ReceiptText, UserCheck, type LucideIcon } from "lucide-react";
import { useLang } from "@/lib/aura-landing/i18n";

// Şeffaflık şeridi (sandwich gündüz gövdesi): 3 güvence — KVKK/GDPR şifreleme, şeffaf
// fiyat, bağımsız ikinci görüş. Trust'tan sonra, closing'den önce; panel kartı içinde.
// Metin copy.ts transparency (8 dil).
const ITEM_ICONS: LucideIcon[] = [ShieldCheck, ReceiptText, UserCheck];

export function AuraTransparency() {
  const { t } = useLang();

  return (
    <section className="mx-auto max-w-6xl px-5 pb-24 md:px-8 md:pb-32">
      <div className="rounded-3xl border border-[var(--aura-hairline)] bg-[var(--aura-panel)] p-8 md:p-12">
        <h2 className="aura-display text-center text-2xl font-bold leading-tight tracking-tight text-[var(--aura-ink)] md:text-4xl">
          {t.transparency.headline}
        </h2>
        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {t.transparency.items.map((it, i) => {
            const Icon = ITEM_ICONS[i] ?? ShieldCheck;
            return (
              <div key={i} className="text-center md:text-start">
                <span className="inline-grid h-11 w-11 place-items-center rounded-xl bg-[var(--aura-accent)]/12 text-[var(--aura-accent)]">
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
