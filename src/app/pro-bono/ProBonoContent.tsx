"use client";

import Link from "next/link";
import { HeartHandshake, Users, FileCheck2, ShieldCheck, ArrowRight, Info } from "lucide-react";
import { usePublicLocale, LocaleToggle } from "@/components/PublicLocale";

const COPY = {
  en: {
    badge: "Pro Bono",
    h1: "Access to health is a right, not a privilege.",
    introA: "The AURA Pro Bono program offers ",
    strong: "free",
    introB:
      " video consultations with accredited specialists for patients with limited financial means. Our volunteer doctors set aside a certain quota for this purpose each term.",
    apply: "Apply",
    note:
      "Quota is limited and applications are subject to a pre-assessment. Your application is reviewed for eligibility by our coordination team.",
  },
  tr: {
    badge: "Pro Bono",
    h1: "Sağlığa erişim bir ayrıcalık değil, haktır.",
    introA: "AURA Pro Bono programı, maddi imkânı kısıtlı hastalar için akredite uzmanlarla ",
    strong: "ücretsiz",
    introB:
      " video konsültasyon sunar. Gönüllü hekimlerimiz her dönem belirli bir kontenjanı bu amaca ayırır.",
    apply: "Başvur",
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
    tr: { t: "Nasıl başvurulur?", d: "Kısa bir ön değerlendirme doldurun; durumunuz gönüllü hekim havuzuna iletilir." },
  },
  {
    icon: HeartHandshake,
    en: { t: "Volunteer doctors", d: "Our accredited specialists set aside a certain quota for free consultations each term." },
    tr: { t: "Gönüllü hekimler", d: "Akredite uzmanlarımız her dönem belirli bir kontenjanı ücretsiz konsültasyona ayırır." },
  },
  {
    icon: ShieldCheck,
    en: { t: "Same standard", d: "Pro Bono consultations are also conducted with interpreting in 70 languages and full confidentiality." },
    tr: { t: "Aynı standart", d: "Pro Bono görüşmeler de 70 dilde tercüme ve tam gizlilikle yürütülür." },
  },
];

export function ProBonoContent() {
  const [locale, setLocale] = usePublicLocale();
  const C = COPY[locale];
  return (
    <div lang={locale} className="mx-auto max-w-4xl px-5 py-12">
      <div className="flex items-center justify-between gap-4">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#14C3D0]/10 px-4 py-1.5 text-[12.5px] font-semibold uppercase tracking-[0.1em] text-[#0E8A95]">
          <HeartHandshake size={15} /> {C.badge}
        </span>
        <LocaleToggle locale={locale} onChange={setLocale} />
      </div>
      <h1 className="mt-5 text-3xl font-bold leading-tight text-[#101010] sm:text-[40px]">{C.h1}</h1>
      <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-slate-600">
        {C.introA}
        <strong className="font-semibold text-slate-800">{C.strong}</strong>
        {C.introB}
      </p>
      <div className="mt-7 flex flex-wrap gap-3">
        <Link href="/giris?next=/triyaj" className="inline-flex items-center gap-2 rounded-full bg-[#14C3D0] px-6 py-3 text-[15px] font-semibold text-[#101010] hover:bg-[#0EA5B2]">
          {C.apply} <ArrowRight size={17} />
        </Link>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {POINTS.map((p, i) => {
          const Icon = p.icon;
          const txt = p[locale];
          return (
            <div key={i} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#14C3D0] text-[#101010]"><Icon size={20} /></span>
              <div className="mt-3 font-semibold text-[#101010]">{txt.t}</div>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">{txt.d}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex items-start gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
        <Info size={18} className="mt-0.5 shrink-0 text-slate-400" />
        {C.note}
      </div>
    </div>
  );
}
