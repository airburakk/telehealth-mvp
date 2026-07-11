"use client";

import Link from "next/link";
import { Stethoscope, FileSearch, Languages, ShieldCheck, ArrowRight, CheckCircle2 } from "lucide-react";
import { usePublicLocale, LocaleToggle } from "@/components/PublicLocale";

const COPY = {
  en: {
    badge: "Second Opinion",
    h1: "Be sure about your diagnosis — an independent second opinion from accredited specialists.",
    intro:
      "Have your current diagnosis and treatment reviewed through the eyes of an accredited specialist in the field. Meet the expert directly over video with live interpreting in 70 languages, and decide with confidence.",
    start: "Get started",
    seeDoctors: "See specialists",
    staffCta: "Go to your dashboard",
    staffNote:
      "The application flow is for patients. As a clinician you provide opinions — manage second-opinion requests from your dashboard.",
    disclaimer:
      "A second opinion is not binding and does not replace your current treatment. Its purpose is to support your decision with an independent specialist assessment.",
  },
  tr: {
    badge: "İkinci Görüş",
    h1: "Tanınızdan emin olun — akredite uzmanlardan bağımsız ikinci görüş.",
    intro:
      "Mevcut tanı ve tedavinizi, alanında akredite bir uzmanın gözünden değerlendirin. 70 dilde simültane tercüme hizmetiyle uzmanla doğrudan video görüşün; kararınızı güvenle verin.",
    start: "Hemen başla",
    seeDoctors: "Uzmanları gör",
    staffCta: "Panelinize gidin",
    staffNote:
      "Başvuru akışı hastalar içindir. Klinik personel görüş verir — ikinci görüş taleplerini panelinizden yönetin.",
    disclaimer:
      "İkinci görüş bağlayıcı değildir ve mevcut tedavinizin yerine geçmez. Amaç, kararınızı bağımsız bir uzman değerlendirmesiyle desteklemektir.",
  },
} as const;

const STEPS = [
  {
    icon: FileSearch,
    en: { t: "Share your records", d: "Securely upload your existing diagnosis, imaging and reports." },
    tr: { t: "Kayıtlarınızı paylaşın", d: "Mevcut tanı, görüntüleme ve raporlarınızı güvenle yükleyin." },
  },
  {
    icon: Stethoscope,
    en: { t: "A specialist reviews", d: "An accredited specialist independently reviews your file." },
    tr: { t: "Uzman değerlendirir", d: "Akredite bir uzman dosyanızı bağımsız olarak inceler." },
  },
  {
    icon: Languages,
    en: { t: "Video consultation", d: "Meet the expert face to face with live interpreting in 70 languages." },
    tr: { t: "Video görüşme", d: "70 dilde simültane tercümeyle uzmanla yüz yüze görüşün." },
  },
  {
    icon: ShieldCheck,
    en: { t: "Written second opinion", d: "Receive an independent, documented assessment for your decision." },
    tr: { t: "Yazılı ikinci görüş", d: "Kararınız için bağımsız, belgeli bir değerlendirme alın." },
  },
];

export function SecondOpinionContent({ canApply = true, staffHref = null }: { canApply?: boolean; staffHref?: string | null }) {
  const [locale, setLocale] = usePublicLocale();
  const C = COPY[locale];
  return (
    <div className="min-h-[calc(100vh-8rem)] bg-[#0D0E10]">
    <div lang={locale} className="mx-auto max-w-4xl px-5 py-12">
      <div className="flex items-center justify-between gap-4">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#28C8D8]/10 px-4 py-1.5 font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[#28C8D8]">
          <Stethoscope size={15} /> {C.badge}
        </span>
        <LocaleToggle locale={locale} onChange={setLocale} />
      </div>
      <h1 className="mt-5 font-serif text-3xl font-bold leading-tight tracking-[-0.02em] text-[#F4F5F3] sm:text-[40px]">{C.h1}</h1>
      <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-white/60">{C.intro}</p>
      <div className="mt-7 flex flex-wrap gap-3">
        {canApply ? (
          <Link href="/second-opinion/basvur" className="inline-flex items-center gap-2 rounded-full bg-[#28C8D8] px-6 py-3 text-[15px] font-semibold text-[#0D0E10] hover:bg-[#1FA9B8]">
            {C.start} <ArrowRight size={17} />
          </Link>
        ) : (
          <Link href={staffHref ?? "/"} className="inline-flex items-center gap-2 rounded-full bg-[#28C8D8] px-6 py-3 text-[15px] font-semibold text-[#0D0E10] hover:bg-[#1FA9B8]">
            {C.staffCta} <ArrowRight size={17} />
          </Link>
        )}
        <Link href="/hekimler" className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-[15px] font-semibold text-white/80 hover:border-white/30">
          {C.seeDoctors}
        </Link>
      </div>
      {!canApply && <p className="mt-3 text-[13px] leading-relaxed text-white/50">{C.staffNote}</p>}

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const txt = s[locale];
          return (
            <div key={i} className="rounded-[22px] border border-white/10 bg-[#161719] p-5">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#28C8D8] text-[#0D0E10]"><Icon size={20} /></span>
              <div className="mt-3 font-mono text-[11px] font-bold text-[#28C8D8]">0{i + 1}</div>
              <div className="mt-1 font-semibold text-[#F4F5F3]">{txt.t}</div>
              <p className="mt-1 text-sm leading-relaxed text-white/50">{txt.d}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex items-start gap-3 rounded-3xl border border-[#28C8D8]/25 bg-[#28C8D8]/[0.06] p-5 text-sm text-white/60">
        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#28C8D8]" />
        {C.disclaimer}
      </div>
    </div>
    </div>
  );
}
