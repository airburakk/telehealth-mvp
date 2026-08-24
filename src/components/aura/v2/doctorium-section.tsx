"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AuraInlineWord, AuraWordText } from "@/components/aura/aura-word";
import { useLang } from "@/lib/aura-landing/i18n";

// Doctorium köprü bölümü (2026-08-17, ana sayfa sadeleşmesi) — ai/accessibility/
// clinicians bölümlerinin yerini alan TEK köprü: /doctorium landing'ine götürür.
// Ritimde KOYU bölümdür (2026-08-18 takas sonrası; home.tsx'te sarmalayıcısız —
// .aura-page gece token'larını miras alır, trust(A) ile closing(K) arasında).
//
// Marka lockup kuralı (doctorium-landing sözleşmesi, 2026-08-16): "Doctorium"
// geçen her metinde Doctor ink + ium zümrüt; açık zeminde zümrüt = #047857
// (.doctorium-ium gündüz değeri, beyazda AA). Lockup SÖZLÜKTE DEĞİL burada
// çizilir — çevrilebilir metinler t.v2.doctorium'dan gelir (9 dil).
//
// İddia disiplini (v6.8): sayılan alanlar canlı portal modüllerinin adlarıdır
// (akademik/sektörel/hukuk/kariyer/kongre) — ölçülmemiş oran/süre iddiası YOK.
const IUM_LIGHT = "#047857";
// KOYU zemin karsiligi (2026-08-18): ana sayfa ritmi degisti, bu bolum artik KOYU
// (hero K -> how A -> entry K -> connected A -> doctors K -> trust A -> doctorium K).
// #047857 beyazda AA idi ama gece zemininde okunmaz — .doctorium-ium'un gece degeri
// #34d399 kullanilir. 🪤 IUM_LIGHT topluca degistirilemez: DoctoriumLockup export'tur
// ve /for-clinicians onu ACIK zeminde kullanir — ton PROP ile secilir.
const IUM_DARK = "#34d399";

// export: for-clinicians'taki Doctorium tanıtım bölümü de aynı lockup'ı kullanır.
export function DoctoriumLockup({ dark = false }: { dark?: boolean } = {}) {
  return (
    <span className="whitespace-nowrap">
      <span className="text-[var(--aura-ink)]">Doctor</span>
      <span style={{ color: dark ? IUM_DARK : IUM_LIGHT }}>ium</span>
    </span>
  );
}

// Metin İÇİNDEKİ "Doctorium" kelimesini marka lockup'ına çevirir (kullanıcı kararı
// 2026-08-18): CTA düğmesi tüm metni tek ton zümrüt çiziyordu, "Doctor" hecesi de dahil.
// Marka kuralı gereği (doctorium-landing sözleşmesi) "Doctorium" geçen HER metinde
// Doctor = ink, ium = zümrüt. Kelimenin dışındaki metin ("'u keşfet", "Explore ") düğmenin
// kendi rengini korur — AuraWordText'in "AURA"yı wordmark'a çevirmesiyle aynı desen.
// 9 dilde CTA'da kelime Latin harfleriyle geçiyor (Explore Doctorium · Doctorium'u keşfet ·
// Doctorium entdecken · Découvrir Doctorium …); geçmediği bir dil eklenirse split hiçbir şey
// yapmaz, metin olduğu gibi çizilir (zararsız).
function DoctoriumInText({ text, dark = false }: { text: string; dark?: boolean }) {
  return (
    <>
      {text.split(/(Doctorium)/g).map((part, i) =>
        part === "Doctorium" ? (
          <DoctoriumLockup key={i} dark={dark} />
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
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
          style={{ color: IUM_DARK }}
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
          <DoctoriumLockup dark />{" "}
          <span className="text-[var(--aura-grey)]">
            by <AuraInlineWord />
          </span>
        </h2>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-[var(--aura-grey)] md:text-lg">
          <AuraWordText text={d.body} />
        </p>
        <div className="mt-8">
          {/* Kapanış CTA giysisi (kullanıcı kararı 2026-08-18): closing.tsx'teki "Doktorla
              görüş" düğmesiyle AYNI efekt — hover'da tüm bant yana kayar, sol kenardaki
              ince şerit bandı doldurur (opacity 15), ok ileri kayar. Renk buranın kendi
              zümrüdü kalır (accent turkuazı DEĞİL) — efekt ortak, marka rengi bölüme ait.
              🪤 Dolgu span'i absolute: konumlanmış öğe sonraki STATIC kardeşlerin üstünde
              çizilir → metin ve ok `relative` olmak ZORUNDA, yoksa dolgunun altında kalır
              (closing'de de bu yüzden relative). start-0 + rtl: varyantları closing'in
              left-0'ının RTL düzeltilmiş hali — bu bölüm ar/fa'da da yayında. */}
          <Link
            href="/doctorium"
            className="group relative inline-flex min-h-[44px] items-center gap-2 overflow-hidden rounded-full border px-6 py-3 text-sm font-semibold transition-transform duration-200 hover:translate-x-1 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34d399] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--aura-bg)] rtl:hover:-translate-x-1"
            style={{ borderColor: "rgba(52,211,153,.4)", color: IUM_DARK }}
          >
            <span
              aria-hidden
              className="absolute inset-y-0 start-0 w-1 transition-all duration-300 group-hover:w-full group-hover:opacity-15"
              style={{ backgroundColor: IUM_DARK }}
            />
            <span className="relative">
              <DoctoriumInText text={d.cta} dark />
            </span>
            <ArrowRight
              aria-hidden
              size={16}
              className="relative transition-transform duration-300 group-hover:translate-x-1.5 rtl:rotate-180 rtl:group-hover:-translate-x-1.5"
            />
          </Link>
        </div>
      </div>

      {/* Sol-şeritli panel kartı — doctorium-landing kart dili (aura token'larıyla). */}
      {/* Şerit border-inline-start ile: RTL'de (ar/fa) kendiliğinden sağa geçer. */}
      <article
        className="rounded-2xl border border-[var(--aura-hairline)] bg-[var(--aura-surface)]/60 p-6 md:p-8"
        style={{ borderInlineStartWidth: 3, borderInlineStartColor: IUM_DARK }}
      >
        <p className="aura-mono text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: IUM_DARK }}>
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
