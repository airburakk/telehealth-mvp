"use client";

import Link from "next/link";
import { ArrowRight, ShieldCheck, Scale, Route, Stethoscope, type LucideIcon } from "lucide-react";
import { useLang, type Copy } from "@/lib/aura-landing/i18n";

// /v2 FAZ 2 (v6.16) — "iddia bölümü" iskeleti: AI sorumluluğu + Erişilebilirlik.
//
// TEK BİLEŞEN, İKİ BESLEME: iki bölüm de aynı şekle sahip (eyebrow/headline/intro +
// 4 madde + "neyi iddia etmiyoruz" notu) ⇒ ayrı ayrı yazmak kopya olurdu. Sözlükteki
// yapı da aynı (copy.ts `v2.ai` / `v2.accessibility`) — 8 dilin yapı imzası testi
// (tests/unit/aura-landing-copy.test.ts) bu tekliği zaten şart koşuyor.
//
// ⚠️ NOT KUTUSU BÖLÜMÜN OMURGASI — sessizce kaldırma. /guven-ve-gizlilik'te kullanıcı
// kararı: "sayfanın asıl değeri 'neyi iddia etmiyoruz' kutularında" ([[public-claim-honesty]]).
// Burada da aynı: AI bölümü AI'nın klinik yargı üretmediğini, erişilebilirlik bölümü
// WCAG beyanımız olmadığını ve Braille'in GÖRSEL marka öğesi olduğunu açıkça söyler.
//
// Her maddenin kod kanıtı copy.ts'te haritalı (v2.ai / v2.accessibility başlığı).
// 🪤 Yeni madde: önce KOD KANITI, sonra metin. Kanıtlanamayan madde girmez.
type ClaimCopy = Copy["v2"]["ai"];

export function V2ClaimSection({
  id,
  copy,
  icon: Icon = ShieldCheck,
  cta,
  headingLevel: Heading = "h2",
}: {
  id: string;
  copy: ClaimCopy;
  icon?: LucideIcon;
  // Opsiyonel köprü (v6.17): bölümün tam sayfası varsa not kutusundan sonra
  // tek link — ai/accessibility/connected'da YOK, clinicians → /for-clinicians.
  cta?: { label: string; href: string };
  // Ray D a11y (2026-07-17): ana sayfada bölüm başlığı = h2 (h1 hero'da); ama bu
  // iskelet /for-clinicians'ta SAYFANIN tepe başlığıdır → h1 verilmezse sayfa h1'siz
  // kalır (sentetik kalibrasyon bulgusu). Görsel/metin AYNI, yalnız semantik seviye.
  headingLevel?: "h1" | "h2";
}) {
  const headingId = `${id}-heading`;

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="mx-auto max-w-6xl px-5 py-24 md:px-8 md:py-32"
    >
      <div className="max-w-3xl">
        <p className="aura-mono text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--aura-accent-stronger)]">
          {copy.eyebrow}
        </p>
        <Heading
          id={headingId}
          className="aura-display mt-4 text-3xl font-bold leading-[1.02] tracking-tighter text-[var(--aura-ink)] md:text-5xl"
        >
          {copy.headline}
        </Heading>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-[var(--aura-grey)] md:text-lg">
          {copy.intro}
        </p>
      </div>

      {/* Maddeler: numara sözlükten (n) — index'ten DEĞİL; render key ile bağlanır
          (copy.ts yapı notu: dizi sırası değişirse numara metinle birlikte taşınsın). */}
      <ol className="mt-14 grid gap-x-8 gap-y-10 md:grid-cols-2">
        {copy.items.map((item) => (
          <li key={item.key} className="relative">
            <span className="aura-mono text-[11px] font-semibold text-[var(--aura-accent-stronger)]">
              {item.n}
            </span>
            <h3 className="aura-display mt-3 text-lg font-bold text-[var(--aura-ink)]">
              {item.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--aura-grey)]">{item.body}</p>
          </li>
        ))}
      </ol>

      {/* "Neyi iddia etmiyoruz" — bölümün omurgası (yukarıdaki nota bak). Vurgu değil
          ölçülü bir kenar: iddia değil, iddianın SINIRI. */}
      <div className="mt-14 rounded-2xl border border-[var(--aura-hairline)] bg-[var(--aura-surface)]/60 p-6 md:p-8">
        <div className="flex items-start gap-4">
          <span
            aria-hidden
            className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--aura-accent)]/10 text-[var(--aura-accent-stronger)] ring-1 ring-[var(--aura-accent)]/20"
          >
            <Icon size={18} strokeWidth={1.9} />
          </span>
          <div>
            <p className="aura-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--aura-micro)]">
              {copy.note.label}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--aura-grey)]">{copy.note.text}</p>
          </div>
        </div>
      </div>

      {cta && (
        <div className="mt-8">
          <Link
            href={cta.href}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[var(--aura-accent)]/40 px-6 py-3 text-sm font-semibold text-[var(--aura-accent-stronger)] transition-colors hover:bg-[var(--aura-accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aura-accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--aura-bg)]"
          >
            {cta.label}
            <ArrowRight aria-hidden size={16} className="rtl:rotate-180" />
          </Link>
        </div>
      )}
    </section>
  );
}

// İki bölüm = aynı iskelet, farklı sözlük dalı + ikon.
export function V2AiResponsibility() {
  const { t } = useLang();
  return <V2ClaimSection id="ai" copy={t.v2.ai} />;
}

export function V2Accessibility() {
  const { t } = useLang();
  // Accessibility notu da ShieldCheck değil — ayrı ikon: kutu "güvenlik" değil "sınır" anlatıyor.
  return <V2ClaimSection id="accessibility" copy={t.v2.accessibility} icon={Scale} />;
}

// Üçüncü besleme (v6.17, Faz 2 kalanı): Connected care — yolculuk sürekliliği.
// Not kutusu erişim SINIRINI söyler (postop-access: takip bitince personel erişimi
// kapanır) → ikon Route (yolculuk), kutu yine "sınır" tonunda.
export function V2ConnectedCare() {
  const { t } = useLang();
  return <V2ClaimSection id="connected" copy={t.v2.connected} icon={Route} />;
}

// Dördüncü besleme (v6.17): Clinicians — /v2'de kompakt bölüm; tam sayfa
// /for-clinicians (cta.more oraya köprü). Sözlük İKİ yüzeyi de besler.
export function V2Clinicians() {
  const { t } = useLang();
  const c = t.v2.clinicians;
  return (
    <V2ClaimSection
      id="clinicians"
      copy={c}
      icon={Stethoscope}
      cta={{ label: c.cta.more, href: "/for-clinicians" }}
    />
  );
}
