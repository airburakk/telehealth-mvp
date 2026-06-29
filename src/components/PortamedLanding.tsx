"use client";

// AURA landing — design_handoff_portamed_landing/README.md spesifikasyonunun birebir uygulaması.
// Tema: Light "Editorial Calm" (koyu tema token'ları spec'te hazır; ileride toggle eklenebilir).
// EN/TR dil anahtarı localStorage'da kalıcıdır. Eski tasarım: design-backup/ + git tag design-klasik-v2.6.
import { useEffect, useState } from "react";
import Link from "next/link";
import { Newsreader, Hanken_Grotesk } from "next/font/google";
import { PackArtHair, PackArtSmile, PackArtIvf, DoctorArt, TestimonialArt } from "@/components/PortamedArt";
import { PortamedLogo } from "@/components/PortamedLogo";
import { HeroShowcase } from "@/components/HeroShowcase";

const serif = Newsreader({ subsets: ["latin", "latin-ext"], weight: ["400", "500"] });
const sans = Hanken_Grotesk({ subsets: ["latin", "latin-ext"], weight: ["300", "400", "500", "600", "700"] });

// ── Design tokens (README "Colors — shared / light") ──
// ── Design tokens — koyu "AURA" tema (dark-first marka kimliği) ──
const T = {
  teal: "#14C3D0",
  tealDeep: "#0EA5B2",
  emerald: "#1B1E22", // yükseltilmiş koyu panel (feature) + beyaz buton üstü koyu metin
  ink: "#1B1E22",     // AI kartı paneli + beyaz buton üstü koyu metin
  bg: "#0A0A0B",      // sayfa + iç konteyner (en derin)
  surface: "#15161A", // kartlar (zeminden yükselir)
  surfaceAlt: "#0E0F12", // bölüm bantları (trust, doktor paneli, footer)
  text: "#FFFFFF",
  muted: "rgba(255,255,255,.58)",
  soft: "rgba(255,255,255,.72)",
  border: "rgba(255,255,255,.1)",
};

export interface LandingDoctor { name: string; title: string; branch: string; color: string }

interface Copy {
  nav: { treatments: string; how: string; doctors: string; clinics: string; signin: string; cta: string };
  hero: {
    eyebrow: string; h: string; p: string; cta2: string; cta3: string; cta4: string;
    stats: { n: string; l: string }[];
    cardDoctor: string; cardSpec: string; cardChip: string; badgeTop: string; badgePrice: string;
  };
  trust: string;
  packages: { eyebrow: string; h: string; viewAll: string; from: string; items: { t: string; m: string; p: string }[]; accentT: string; accentCta: string };
  how: { eyebrow: string; h: string; steps: { t: string; d: string }[] };
  doctors: { h: string; all: string };
  ai: { label: string; q: string; a: string; cta: string };
  testimonial: { quote: string; name: string; meta: string };
  cta: { h: string; p: string; b1: string; b2: string };
  footer: { desc: string; cols: { h: string; links: { t: string; href: string }[] }[] };
}

const COPY: Record<"en" | "tr", Copy> = {
  en: {
    nav: { treatments: "Treatments", how: "How it works", doctors: "Doctors", clinics: "For clinics", signin: "Sign in", cta: "Free consultation" },
    hero: {
      eyebrow: "Health tourism & telehealth",
      h: "Your gateway to world-class care in Türkiye.",
      p: "Triage with AI, meet accredited specialists over video with live interpreting in 70 languages, and travel with an all-inclusive treatment plan — flights, hotel and aftercare handled.",
      cta2: "Talk to a doctor now", cta3: "Second Opinion", cta4: "Pro Bono",
      stats: [
        { n: "20k+", l: "International patients" },
        { n: "40+", l: "Accredited clinics" },
        { n: "4.9★", l: "Patient rating" },
      ],
      cardDoctor: "Dr. Elif Yıldız", cardSpec: "Hair transplant · Istanbul", cardChip: "Video consult — Today 16:30",
      badgeTop: "All-inclusive from", badgePrice: "€1,490",
    },
    trust: "Accredited & trusted",
    packages: {
      eyebrow: "Treatment packages", h: "Curated journeys, transparent pricing.", viewAll: "View all 60+ →", from: "from",
      items: [
        { t: "Hair transplant", m: "3 nights · Istanbul · All-inclusive", p: "€1,490" },
        { t: "Smile makeover", m: "5 nights · Antalya · Dental", p: "€2,200" },
        { t: "IVF program", m: "7 nights · Istanbul · Fertility", p: "€3,900" },
      ],
      accentT: "Not sure where to start?", accentCta: "Get my plan",
    },
    how: {
      eyebrow: "How it works", h: "Four steps, fully taken care of.",
      steps: [
        { t: "Free assessment", d: "Share your symptoms and records; our AI triage routes you to the right specialty." },
        { t: "Tailored plan", d: "Video consult with a specialist, then a transparent all-inclusive package." },
        { t: "Arrive & heal", d: "Flights, hotel, transfers and a medical translator — all arranged." },
        { t: "Follow-up at home", d: "Daily recovery check-ins and red-flag alerts, wherever you are." },
      ],
    },
    doctors: { h: "Meet the specialists", all: "All doctors →" },
    ai: {
      label: "AI health assistant",
      q: "I have knee pain when climbing stairs. What should I do?",
      a: "That pattern often points to a meniscus issue — an orthopedic video consult is the right first step. I can route you now.",
      cta: "Ask the assistant",
    },
    testimonial: {
      quote: "“From the first video call to the follow-ups after I flew home, everything was organised. I never felt alone in a foreign country.”",
      name: "James W. · United Kingdom", meta: "Hair transplant · 2 nights in Istanbul",
    },
    cta: { h: "Ready to open the door to your care?", p: "Start with a free assessment — get a specialty, an urgency score and a treatment plan in minutes.", b1: "Plan my treatment", b2: "Talk to a doctor" },
    footer: {
      desc: "Telehealth & health tourism, end to end.",
      cols: [
        { h: "Care", links: [{ t: "Treatments", href: "#packages" }, { t: "Doctors", href: "/hekimler" }, { t: "Free assessment", href: "/triyaj" }] },
        { h: "Company", links: [{ t: "How it works", href: "#how" }, { t: "For clinics", href: "/giris" }, { t: "Ethics board", href: "/giris" }] },
        { h: "Support", links: [{ t: "Sign in", href: "/giris" }, { t: "Patient portal", href: "/vakalarim" }, { t: "Contact", href: "#" }] },
      ],
    },
  },
  tr: {
    nav: { treatments: "Tedaviler", how: "Nasıl çalışır", doctors: "Doktorlar", clinics: "Klinikler için", signin: "Giriş yap", cta: "Ücretsiz ön görüşme" },
    hero: {
      eyebrow: "Sağlık turizmi & teletıp",
      h: "Türkiye'de birinci sınıf sağlık hizmetine açılan kapınız.",
      p: "AI ile triyaj olun, 70 dilde simültane tercüme hizmetiyle akredite uzmanlarla video görüşün ve her şey dahil tedavi planıyla seyahat edin — uçuş, otel ve iyileşme takibi bizden.",
      cta2: "Hemen doktorla görüş", cta3: "İkinci Görüş", cta4: "Pro Bono",
      stats: [
        { n: "20k+", l: "Uluslararası hasta" },
        { n: "40+", l: "Akredite klinik" },
        { n: "4.9★", l: "Hasta puanı" },
      ],
      cardDoctor: "Dr. Elif Yıldız", cardSpec: "Saç ekimi · İstanbul", cardChip: "Video görüşme — Bugün 16:30",
      badgeTop: "Her şey dahil", badgePrice: "€1.490",
    },
    trust: "Akredite & güvenilir",
    packages: {
      eyebrow: "Tedavi paketleri", h: "Özenle kurgulanmış yolculuklar, şeffaf fiyat.", viewAll: "60+ paketin tümü →", from: "başlangıç",
      items: [
        { t: "Saç ekimi", m: "3 gece · İstanbul · Her şey dahil", p: "€1.490" },
        { t: "Gülüş tasarımı", m: "5 gece · Antalya · Diş", p: "€2.200" },
        { t: "Tüp bebek programı", m: "7 gece · İstanbul · IVF", p: "€3.900" },
      ],
      accentT: "Nereden başlayacağınızdan emin değil misiniz?", accentCta: "Planımı al",
    },
    how: {
      eyebrow: "Nasıl çalışır", h: "Dört adım, her şey bizden.",
      steps: [
        { t: "Ücretsiz değerlendirme", d: "Şikayetinizi ve belgelerinizi paylaşın; AI triyaj sizi doğru branşa yönlendirsin." },
        { t: "Kişiye özel plan", d: "Uzmanla video görüşme, ardından şeffaf her-şey-dahil paket." },
        { t: "Gelin & iyileşin", d: "Uçuş, otel, transfer ve tıbbi tercüman — hepsi ayarlanır." },
        { t: "Evde takip", d: "Günlük iyileşme kontrolleri ve kırmızı bayrak uyarıları, nerede olursanız olun." },
      ],
    },
    doctors: { h: "Uzmanlarla tanışın", all: "Tüm doktorlar →" },
    ai: {
      label: "AI sağlık asistanı",
      q: "Merdiven çıkarken dizim ağrıyor. Ne yapmalıyım?",
      a: "Bu tablo sıklıkla menisküs sorununa işaret eder — ilk adım ortopedi video görüşmesi. Sizi hemen yönlendirebilirim.",
      cta: "Asistana sor",
    },
    testimonial: {
      quote: "“İlk video görüşmeden eve döndükten sonraki kontrollere kadar her şey organizeydi. Yabancı bir ülkede bir an bile yalnız hissetmedim.”",
      name: "James W. · Birleşik Krallık", meta: "Saç ekimi · İstanbul'da 2 gece",
    },
    cta: { h: "Bakımınıza açılan kapıyı aralamaya hazır mısınız?", p: "Ücretsiz değerlendirmeyle başlayın — dakikalar içinde branş, aciliyet skoru ve tedavi planı alın.", b1: "Tedavimi planla", b2: "Doktorla görüş" },
    footer: {
      desc: "Teletıp ve sağlık turizmi, uçtan uca.",
      cols: [
        { h: "Bakım", links: [{ t: "Tedaviler", href: "#packages" }, { t: "Doktorlar", href: "/hekimler" }, { t: "Ücretsiz değerlendirme", href: "/triyaj" }] },
        { h: "Şirket", links: [{ t: "Nasıl çalışır", href: "#how" }, { t: "Klinikler için", href: "/giris" }, { t: "Etik kurul", href: "/giris" }] },
        { h: "Destek", links: [{ t: "Giriş yap", href: "/giris" }, { t: "Hasta portalı", href: "/vakalarim" }, { t: "İletişim", href: "#" }] },
      ],
    },
  },
};

// ── Logo: AURA — paylaşılan marka bileşeni (Jost wordmark + üçgen "A") ──
function Logo({ size = 26 }: { size?: number }) {
  return <PortamedLogo size={size} ink="#FFFFFF" />;
}

const pill = "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition";

export function PortamedLanding({ doctors, loggedIn }: { doctors: LandingDoctor[]; loggedIn: boolean }) {
  const [locale, setLocale] = useState<"en" | "tr">("en");
  useEffect(() => {
    const saved = localStorage.getItem("pm_locale");
    if (saved === "tr" || saved === "en") setLocale(saved);
  }, []);
  function switchLocale(l: "en" | "tr") { setLocale(l); localStorage.setItem("pm_locale", l); }

  const C = COPY[locale];
  const planHref = loggedIn ? "/triyaj" : "/giris?next=/triyaj";

  return (
    <div className={sans.className} style={{ background: T.bg, color: T.text }}>
      <div className="mx-auto" style={{ maxWidth: 1320, background: T.bg }}>

        {/* 1+2 · Koyu "AURA" bandı — Nav + Hero (aura glow) */}
        <div className="relative" style={{ background: "#101010", color: "#fff" }}>
          <style>{`@keyframes auraFloat{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-26px,22px) scale(1.1)}}@keyframes auraFloat2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(22px,-16px) scale(1.12)}}`}</style>
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute" style={{ right: "-6%", top: "-10%", width: 560, height: 560, borderRadius: "50%", background: "radial-gradient(circle, rgba(20,195,208,.45) 0%, rgba(20,195,208,0) 68%)", filter: "blur(46px)", animation: "auraFloat 11s ease-in-out infinite" }} />
            <div className="absolute" style={{ right: "16%", top: "30%", width: 360, height: 360, borderRadius: "50%", background: "radial-gradient(circle, rgba(95,211,226,.28) 0%, rgba(95,211,226,0) 70%)", filter: "blur(44px)", animation: "auraFloat2 14s ease-in-out infinite" }} />
          </div>

          {/* Nav */}
          <header className="relative z-10 flex items-center justify-between gap-4 px-6 py-5 sm:gap-9 sm:px-12" style={{ borderBottom: "1px solid rgba(255,255,255,.08)" }}>
            <Link href="/" className="shrink-0"><PortamedLogo size={26} ink="#FFFFFF" /></Link>
            <nav className="hidden flex-1 items-center justify-center gap-8 text-[14px] font-medium lg:flex" style={{ color: "rgba(255,255,255,.72)" }}>
              <a href="#packages" className="transition-colors hover:text-[#14C3D0]">{C.nav.treatments}</a>
              <a href="#how" className="transition-colors hover:text-[#14C3D0]">{C.nav.how}</a>
              <a href="#doctors" className="transition-colors hover:text-[#14C3D0]">{C.nav.doctors}</a>
              <Link href="/giris" className="transition-colors hover:text-[#14C3D0]">{C.nav.clinics}</Link>
            </nav>
            <div className="flex shrink-0 items-center gap-4">
              <span className="text-[13px] font-semibold tracking-wide">
                <button onClick={() => switchLocale("en")} style={{ color: locale === "en" ? "#fff" : "rgba(255,255,255,.45)" }}>EN</button>
                <span style={{ color: "rgba(255,255,255,.35)" }}> · </span>
                <button onClick={() => switchLocale("tr")} style={{ color: locale === "tr" ? "#fff" : "rgba(255,255,255,.45)" }}>TR</button>
              </span>
              <Link href="/giris" className="hidden text-[14px] font-medium transition-colors hover:text-[#14C3D0] sm:block" style={{ color: "rgba(255,255,255,.72)" }}>{C.nav.signin}</Link>
              <Link href={planHref} className={`${pill} px-5 py-[11px] text-[14px] text-[#101010] hover:brightness-110`} style={{ background: T.teal }}>{C.nav.cta}</Link>
            </div>
          </header>

          {/* Hero */}
          <section className="relative z-10 grid items-center gap-11 px-6 pb-20 pt-14 sm:px-12 lg:grid-cols-[1.05fr_0.95fr] lg:pt-[72px]">
            <div>
              <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-[12.5px] font-semibold uppercase tracking-[0.12em]" style={{ background: "rgba(20,195,208,.14)", color: "#5FD3E2" }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: T.teal }} /> {C.hero.eyebrow}
              </span>
              <h1 className={`${serif.className} mt-6 text-[42px] font-medium leading-[1.04] tracking-[-0.015em] sm:text-[54px] lg:text-[62px]`} style={{ color: "#fff" }}>
                {C.hero.h}
              </h1>
              <p className="mt-5 max-w-[46ch] text-[18px] font-light leading-[1.6]" style={{ color: "rgba(255,255,255,.66)" }}>{C.hero.p}</p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/giris" className={`${pill} px-6 py-[13px] text-[15px] text-[#101010] hover:brightness-110`} style={{ background: T.teal, boxShadow: "0 14px 40px -12px rgba(20,195,208,.6)" }}>
                  <span className="grid h-5 w-5 place-items-center rounded-full text-[9px] text-[#14C3D0]" style={{ background: "#101010" }}>▶</span>
                  {C.hero.cta2}
                </Link>
                <Link href="/second-opinion" className={`${pill} px-6 py-[12px] text-[15px] text-white transition-colors hover:bg-white/[.08]`} style={{ border: "1.5px solid rgba(255,255,255,.22)" }}>{C.hero.cta3}</Link>
                <Link href="/pro-bono" className={`${pill} px-6 py-[12px] text-[15px] transition-colors hover:bg-white/[.08]`} style={{ border: "1.5px solid rgba(20,195,208,.55)", color: "#5FD3E2" }}>{C.hero.cta4}</Link>
              </div>
              <div className="mt-10 flex items-center">
                {C.hero.stats.map((s, i) => (
                  <div key={s.l} className={i > 0 ? "pl-6 sm:pl-8" : ""} style={i > 0 ? { borderLeft: "1px solid rgba(255,255,255,.14)", marginLeft: 24 } : undefined}>
                    <div className={`${serif.className} text-[28px] font-medium leading-none sm:text-[30px]`} style={{ color: "#fff" }}>{s.n}</div>
                    <div className="mt-1.5 text-[13px] font-light" style={{ color: "rgba(255,255,255,.55)" }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <HeroShowcase locale={locale} />
            </div>
          </section>
        </div>

        {/* 3 · Trust strip */}
        <section className="flex flex-wrap items-center gap-x-10 gap-y-4 px-6 py-6 sm:px-12" style={{ background: T.surfaceAlt, borderTop: `1px solid ${T.border}` }}>
          <span className="text-[12.5px] font-semibold uppercase tracking-[0.12em]" style={{ color: T.muted }}>{C.trust}</span>
          <div className="flex flex-1 flex-wrap items-center gap-8 opacity-50">
            {["JCI", "ISO 9001", "TÜRSAB", "TGA", "KVKK/GDPR"].map((m) => (
              <span key={m} className="rounded-md px-3 py-1.5 text-[12px] font-bold tracking-wider" style={{ background: "rgba(255,255,255,.06)", color: T.soft }}>{m}</span>
            ))}
          </div>
        </section>

        {/* 4 · Packages */}
        <section id="packages" className="px-6 py-16 sm:px-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-[12.5px] font-semibold uppercase tracking-[0.12em]" style={{ color: T.tealDeep }}>{C.packages.eyebrow}</div>
              <h2 className={`${serif.className} mt-2 text-[30px] font-medium leading-[1.08] tracking-[-0.015em] sm:text-[38px]`}>{C.packages.h}</h2>
            </div>
            <Link href="/triyaj" className="text-[14px] font-semibold hover:underline" style={{ color: T.tealDeep }}>{C.packages.viewAll}</Link>
          </div>
          <div className="mt-8 grid gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
            {C.packages.items.map((p, pi) => (
              <Link key={p.t} href={planHref} className="group overflow-hidden rounded-[18px] transition hover:-translate-y-0.5" style={{ background: T.surface, border: `1px solid ${T.border}`, boxShadow: "0 10px 28px -18px rgba(20,33,31,.35)" }}>
                <div className="aspect-[4/3] overflow-hidden">
                  {pi === 0 ? <PackArtHair /> : pi === 1 ? <PackArtSmile /> : <PackArtIvf />}
                </div>
                <div className="p-4">
                  <div className="text-[16.5px] font-semibold">{p.t}</div>
                  <div className="mt-0.5 text-[13px]" style={{ color: T.muted }}>{p.m}</div>
                  <div className="mt-3 text-[15px] font-bold" style={{ color: T.tealDeep }}>
                    {p.p} <span className="text-[12px] font-medium" style={{ color: T.muted }}>{C.packages.from}</span>
                  </div>
                </div>
              </Link>
            ))}
            <div className="flex flex-col justify-between rounded-[18px] p-6 text-white" style={{ background: T.emerald }}>
              <div className={`${serif.className} text-[24px] font-medium leading-[1.15]`}>{C.packages.accentT}</div>
              <Link href={planHref} className={`${pill} mt-6 self-start bg-white px-5 py-[11px] text-[14px] hover:brightness-95`} style={{ color: T.emerald }}>
                {C.packages.accentCta} →
              </Link>
            </div>
          </div>
        </section>

        {/* 5 · How it works */}
        <section id="how" className="px-6 pb-16 sm:px-12">
          <div className="text-center">
            <div className="text-[12.5px] font-semibold uppercase tracking-[0.12em]" style={{ color: T.tealDeep }}>{C.how.eyebrow}</div>
            <h2 className={`${serif.className} mt-2 text-[30px] font-medium leading-[1.08] tracking-[-0.015em] sm:text-[38px]`}>{C.how.h}</h2>
          </div>
          <div className="mt-10 grid gap-[22px] sm:grid-cols-2 lg:grid-cols-4">
            {C.how.steps.map((s, i) => (
              <div key={s.t} className="pt-5" style={{ borderTop: i === 0 ? `2px solid ${T.teal}` : `2px solid rgba(255,255,255,.14)` }}>
                <div className={`${serif.className} text-[34px] font-medium leading-none`} style={{ color: T.teal }}>0{i + 1}</div>
                <div className="mt-3 text-[16.5px] font-semibold">{s.t}</div>
                <p className="mt-1.5 text-[14px] leading-[1.6]" style={{ color: T.muted }}>{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 6 · Doctors + AI */}
        <section id="doctors" className="grid gap-5 px-6 pb-16 sm:px-12 lg:grid-cols-[1.3fr_1fr]">
          <div className="rounded-[20px] p-7" style={{ background: T.surfaceAlt, border: `1px solid ${T.border}` }}>
            <div className="flex items-center justify-between gap-3">
              <h3 className={`${serif.className} text-[26px] font-medium tracking-[-0.01em]`}>{C.doctors.h}</h3>
              <Link href="/hekimler" className="text-[14px] font-semibold hover:underline" style={{ color: T.tealDeep }}>{C.doctors.all}</Link>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-4">
              {doctors.map((d, di) => (
                <div key={d.name}>
                  <div className="relative aspect-square overflow-hidden rounded-[14px]" style={{ border: `1px solid ${T.border}` }}>
                    <DoctorArt i={di} />
                  </div>
                  <div className="mt-2.5 text-[14px] font-semibold leading-tight">{d.title} {d.name}</div>
                  <div className="text-[12.5px]" style={{ color: T.muted }}>{d.branch}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col rounded-[20px] p-7 text-white" style={{ background: T.ink }}>
            <div className="text-[12.5px] font-semibold uppercase tracking-[0.12em] opacity-70">{C.ai.label}</div>
            <div className="mt-5 space-y-3">
              <div className="ml-auto max-w-[85%] rounded-[14px] rounded-br-[4px] px-4 py-3 text-[14px]" style={{ background: "rgba(255,255,255,.12)" }}>{C.ai.q}</div>
              <div className="max-w-[90%] rounded-[14px] rounded-bl-[4px] px-4 py-3 text-[14px] leading-[1.55] text-[#101010]" style={{ background: T.teal }}>{C.ai.a}</div>
            </div>
            <Link href={planHref} className={`${pill} mt-auto self-start bg-white px-5 py-[11px] pt-3 text-[14px] hover:brightness-95`} style={{ color: T.ink, marginTop: "auto" }}>
              {C.ai.cta} →
            </Link>
          </div>
        </section>

        {/* 7 · Testimonial */}
        <section className="px-6 pb-16 sm:px-12">
          <div className="grid gap-8 rounded-[20px] p-8 text-white sm:p-12 lg:grid-cols-[0.9fr_1.4fr]" style={{ background: T.emerald }}>
            <div className="aspect-square max-h-72 overflow-hidden rounded-[16px]" style={{ border: "1px solid rgba(255,255,255,.12)" }}>
              <TestimonialArt />
            </div>
            <div className="flex flex-col justify-center">
              <div className="text-[15px] tracking-[0.2em]" style={{ color: "#C6A664" }}>★★★★★</div>
              <p className={`${serif.className} mt-4 text-[21px] font-normal leading-[1.3] sm:text-[27px]`}>{C.testimonial.quote}</p>
              <div className="mt-5 text-[14.5px] font-semibold">{C.testimonial.name}</div>
              <div className="text-[13px] opacity-70">{C.testimonial.meta}</div>
            </div>
          </div>
        </section>

        {/* 8 · CTA band */}
        <section className="px-6 pb-16 sm:px-12">
          <div className="rounded-[20px] px-6 py-14 text-center text-white" style={{ background: T.emerald }}>
            <h2 className={`${serif.className} mx-auto max-w-[24ch] text-[30px] font-medium leading-[1.1] tracking-[-0.015em] sm:text-[40px]`}>{C.cta.h}</h2>
            <p className="mx-auto mt-4 max-w-[52ch] text-[15.5px] leading-[1.6] opacity-90">{C.cta.p}</p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link href={planHref} className={`${pill} bg-white px-6 py-[13px] text-[15px] hover:brightness-95`} style={{ color: "#101010" }}>{C.cta.b1}</Link>
              <Link href="/giris" className={`${pill} px-6 py-[12px] text-[15px] text-white hover:bg-white/25`} style={{ background: "rgba(255,255,255,.16)", border: "1px solid rgba(255,255,255,.35)" }}>{C.cta.b2}</Link>
            </div>
          </div>
        </section>

        {/* 9 · Footer */}
        <footer className="flex flex-wrap items-start justify-between gap-10 px-6 py-11 sm:px-12" style={{ background: T.surfaceAlt, borderTop: `1px solid ${T.border}` }}>
          <div className="max-w-xs">
            <Logo size={22} />
            <p className="mt-2 text-[13.5px]" style={{ color: T.muted }}>{C.footer.desc}</p>
            <p className="mt-4 text-[11.5px]" style={{ color: "#9AA5A1" }}>© {new Date().getFullYear()} AURA · MVP demo</p>
          </div>
          <div className="flex flex-wrap gap-14">
            {C.footer.cols.map((col) => (
              <div key={col.h}>
                <div className="text-[12.5px] font-semibold uppercase tracking-[0.12em]" style={{ color: T.muted }}>{col.h}</div>
                <ul className="mt-3 space-y-2 text-[14px] font-medium">
                  {col.links.map((l) => (
                    <li key={l.t}>
                      {l.href.startsWith("#")
                        ? <a href={l.href} className="hover:text-[#0EA5B2]" style={{ color: T.soft }}>{l.t}</a>
                        : <Link href={l.href} className="hover:text-[#0EA5B2]" style={{ color: T.soft }}>{l.t}</Link>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </footer>
      </div>
    </div>
  );
}
