"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HeartHandshake, Users, FileCheck2, ShieldCheck, ArrowRight, Info } from "lucide-react";
import { usePublicLocale, LocaleToggle } from "@/components/PublicLocale";

const COPY = {
  en: {
    badge: "Free Care",
    h1: "Access to health is a right, not a privilege.",
    introA: "The AURA Free Care program offers ",
    strong: "free",
    introB:
      " video consultations with volunteer specialists for patients with limited financial means. Our volunteer doctors set aside a certain quota for this purpose each term.",
    apply: "Apply",
    online: "Free Care service is online",
    onlineN: "volunteer doctor(s) available now",
    offline: "No volunteer doctor is online right now",
    offlineHint: "you can apply once a doctor comes online",
    checking: "Checking availability…",
    note:
      "Quota is limited and applications are subject to a pre-assessment. Your application is reviewed for eligibility by our coordination team.",
  },
  tr: {
    badge: "Ücretsiz Sağlık Hizmeti",
    h1: "Sağlığa erişim bir ayrıcalık değil, haktır.",
    introA: "AURA Ücretsiz Sağlık Hizmeti programı, maddi imkânı kısıtlı hastalar için gönüllü uzmanlarla ",
    strong: "ücretsiz",
    introB:
      " video konsültasyon sunar. Gönüllü doktorlarımiz her dönem belirli bir kontenjanı bu amaca ayırır.",
    apply: "Başvur",
    online: "Ücretsiz Sağlık Hizmeti çevrimiçi",
    onlineN: "gönüllü doktor şu an müsait",
    offline: "Şu an çevrimiçi gönüllü doktor yok",
    offlineHint: "bir doktor çevrimiçi olduğunda başvurabilirsiniz",
    checking: "Müsaitlik kontrol ediliyor…",
    note:
      "Kontenjan sınırlıdır ve başvurular ön değerlendirmeye tabidir. Başvurunuz, uygunluk açısından koordinasyon ekibimizce incelenir.",
  },
} as const;

const POINTS = [
  {
    icon: Users,
    en: { t: "Who is it for?", d: "Patients with limited means and difficult access to care, and disadvantaged groups." },
    tr: { t: "Kimler için?", d: "Maddi imkânı kısıtlı, tedaviye erişimi zor hastalar ve dezavantajlı gruplar." },
  },
  {
    icon: FileCheck2,
    en: { t: "How to apply?", d: "Complete a short pre-assessment; your case is forwarded to the volunteer doctor pool." },
    tr: { t: "Nasıl başvurulur?", d: "Kısa bir ön değerlendirme doldurun; durumunuz gönüllü doktor havuzuna iletilir." },
  },
  {
    icon: HeartHandshake,
    en: { t: "Volunteer doctors", d: "Our specialists set aside a certain quota for free consultations each term." },
    tr: { t: "Gönüllü doktorlar", d: "Uzmanlarımız her dönem belirli bir kontenjanı ücretsiz konsültasyona ayırır." },
  },
  {
    icon: ShieldCheck,
    en: { t: "Same standard", d: "Free Care consultations are also conducted with interpreting support and the same confidentiality." },
    tr: { t: "Aynı standart", d: "Ücretsiz sağlık hizmeti görüşmeleri de tercüme desteği ve aynı gizlilikle yürütülür." },
  },
];

export function FreeCareContent() {
  const [locale, setLocale] = usePublicLocale();
  const C = COPY[locale];
  const [online, setOnline] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch("/api/free-care/status");
        if (!r.ok) return;
        const d = await r.json();
        if (alive) setOnline(typeof d.online === "number" ? d.online : 0);
      } catch {
        /* sessiz — sonraki tick tekrar dener */
      }
    };
    tick();
    const iv = setInterval(tick, 8000);
    return () => { alive = false; clearInterval(iv); };
  }, []);
  return (
    <div className="min-h-[calc(100vh-8rem)] bg-[var(--c-bg)]">
    <div lang={locale} className="mx-auto max-w-4xl px-5 py-12">
      <div className="flex items-center justify-between gap-4">
        <span className="inline-flex items-center gap-2 rounded-full bg-[var(--c-accent)]/10 px-4 py-1.5 font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[var(--c-accent)]">
          <HeartHandshake size={15} /> {C.badge}
        </span>
        <LocaleToggle locale={locale} onChange={setLocale} />
      </div>
      <h1 className="mt-5 font-serif text-3xl font-bold leading-tight tracking-[-0.02em] text-[var(--c-ink)] sm:text-[40px]">{C.h1}</h1>
      <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-[var(--c-ink-2)]">
        {C.introA}
        <strong className="font-semibold text-[var(--c-ink)]">{C.strong}</strong>
        {C.introB}
      </p>
      <div className="mt-7">
        {online && online > 0 ? (
          <Link href="/ucretsiz-saglik/basvur" className="inline-flex items-center gap-2 rounded-full bg-[var(--c-accent)] px-6 py-3 text-[15px] font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)]">
            {C.apply} <ArrowRight size={17} />
          </Link>
        ) : (
          <button disabled className="inline-flex cursor-not-allowed items-center gap-2 rounded-full bg-[var(--c-ink)]/10 px-6 py-3 text-[15px] font-semibold text-[var(--c-ink-3)]">
            {C.apply} <ArrowRight size={17} />
          </button>
        )}
        {/* Çevrimiçi/çevrimdışı indikatörü — butonun altında */}
        <div className="mt-2.5 flex items-center gap-2 text-[13px]">
          <span className={`h-2.5 w-2.5 rounded-full ${online === null ? "bg-[var(--c-ink)]/25" : online > 0 ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
          <span className="text-[var(--c-ink-2)]">
            {online === null ? C.checking : online > 0 ? `${C.online} · ${online} ${C.onlineN}` : `${C.offline} — ${C.offlineHint}`}
          </span>
        </div>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {POINTS.map((p, i) => {
          const Icon = p.icon;
          const txt = p[locale];
          return (
            <div key={i} className="rounded-[22px] border border-[var(--c-hairline)] bg-[var(--c-panel)] p-6">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--c-accent)] text-[var(--c-bg)]"><Icon size={20} /></span>
              <div className="mt-3 font-semibold text-[var(--c-ink)]">{txt.t}</div>
              <p className="mt-1 text-sm leading-relaxed text-[var(--c-ink-2)]">{txt.d}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex items-start gap-3 rounded-[22px] border border-[var(--c-hairline)] bg-[var(--c-panel)] p-5 text-sm text-[var(--c-ink-2)]">
        <Info size={18} className="mt-0.5 shrink-0 text-[var(--c-ink-3)]" />
        {C.note}
      </div>
    </div>
    </div>
  );
}
