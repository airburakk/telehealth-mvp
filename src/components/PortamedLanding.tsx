"use client";

// AURA landing — sade & modern yeniden tasarım (2026-07, rapor: vault output/landing-yenileme-raporu-2026-07.md).
// Yapı: Nav+Hero (tek CTA) · Trust · Nasıl Çalışır · Doktorlar · Testimonial · CTA band · Footer.
// Kaldırılanlar: Tedavi Paketleri, AI kartı, İkinci Görüş/Ücretsiz Sağlık Hizmeti CTA'ları, Tedaviler/Doktorlar/
// Klinikler için nav linkleri — ürün seçimi giriş SONRASI /basla ekranında yapılır (tek huni).
// 8 dil statik kopya (lib/landing-copy.ts, pm_locale localStorage) + RTL (ar/fa). Tema: koyu AURA.
import { useEffect, useState } from "react";
import Link from "next/link";
import { Newsreader, Hanken_Grotesk } from "next/font/google";
import { DoctorArt, TestimonialArt } from "@/components/PortamedArt";
import { PortamedLogo } from "@/components/PortamedLogo";
import { HeroShowcase } from "@/components/HeroShowcase";
import { LANDING_COPY, LANDING_LOCALES, landingDir, type LandingLocale } from "@/lib/landing-copy";

const serif = Newsreader({ subsets: ["latin", "latin-ext"], weight: ["400", "500"] });
const sans = Hanken_Grotesk({ subsets: ["latin", "latin-ext"], weight: ["300", "400", "500", "600", "700"] });

// ── Design tokens — koyu "AURA" tema (dark-first marka kimliği) ──
const T = {
  teal: "#14C3D0",
  tealDeep: "#0EA5B2",
  emerald: "#1B1E22", // yükseltilmiş koyu panel
  bg: "#0A0A0B",      // sayfa + iç konteyner (en derin)
  surface: "#15161A",
  surfaceAlt: "#0E0F12", // bölüm bantları (trust, doktor paneli, footer)
  text: "#FFFFFF",
  muted: "rgba(255,255,255,.58)",
  soft: "rgba(255,255,255,.72)",
  border: "rgba(255,255,255,.1)",
};

export interface LandingDoctor { name: string; title: string; branch: string; color: string }

const VALID_LOCALES = new Set(LANDING_LOCALES.map((l) => l.code));
const pill = "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition";

export function PortamedLanding({ doctors, loggedIn }: { doctors: LandingDoctor[]; loggedIn: boolean }) {
  const [locale, setLocale] = useState<LandingLocale>("en");
  useEffect(() => {
    const saved = localStorage.getItem("pm_locale");
    if (saved && VALID_LOCALES.has(saved as LandingLocale)) setLocale(saved as LandingLocale); // eski "en"/"tr" değerleri geçerli kalır
  }, []);
  function switchLocale(l: LandingLocale) { setLocale(l); localStorage.setItem("pm_locale", l); }

  const C = LANDING_COPY[locale];
  const dir = landingDir(locale);
  // Tek huni: tüm birincil CTA'lar hasta girişi → /basla ("Nasıl İlerlemek İstersiniz?") ekranına akar.
  const startHref = loggedIn ? "/basla" : "/giris?next=/basla";

  return (
    <div dir={dir} lang={locale} className={sans.className} style={{ background: T.bg, color: T.text }}>
      <div className="mx-auto" style={{ maxWidth: 1320, background: T.bg }}>

        {/* 1+2 · Koyu "AURA" bandı — Nav + Hero (aura glow) */}
        <div className="relative" style={{ background: "#101010", color: "#fff" }}>
          <style>{`@keyframes auraFloat{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-26px,22px) scale(1.1)}}@keyframes auraFloat2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(22px,-16px) scale(1.12)}}`}</style>
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute" style={{ right: "-6%", top: "-10%", width: 560, height: 560, borderRadius: "50%", background: "radial-gradient(circle, rgba(20,195,208,.45) 0%, rgba(20,195,208,0) 68%)", filter: "blur(46px)", animation: "auraFloat 11s ease-in-out infinite" }} />
            <div className="absolute" style={{ right: "16%", top: "30%", width: 360, height: 360, borderRadius: "50%", background: "radial-gradient(circle, rgba(95,211,226,.28) 0%, rgba(95,211,226,0) 70%)", filter: "blur(44px)", animation: "auraFloat2 14s ease-in-out infinite" }} />
          </div>

          {/* Nav — logo · 8-dil seçici (renkli oval pill). Doktorla Görüş + Nasıl Çalışır kaldırıldı;
              Kurumsal Giriş yalnız footer'da (aşağıda). */}
          <header className="relative z-10 flex items-center justify-between gap-3 px-6 py-5 sm:gap-6 sm:px-12" style={{ borderBottom: "1px solid rgba(255,255,255,.08)" }}>
            <Link href="/" className="shrink-0"><PortamedLogo size={26} ink="#FFFFFF" /></Link>
            <select
              value={locale}
              onChange={(e) => switchLocale(e.target.value as LandingLocale)}
              aria-label="Language"
              className="shrink-0 cursor-pointer rounded-full px-4 py-[10px] text-[14px] font-semibold outline-none transition hover:brightness-110"
              style={{ background: T.teal, color: "#101010" }}
            >
              {LANDING_LOCALES.map((l) => <option key={l.code} value={l.code} style={{ background: "#fff", color: "#101010" }}>{l.native}</option>)}
            </select>
          </header>

          {/* Hero — başlık + paragraf + TEK CTA + istatistikler + showcase */}
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
                <Link href={startHref} className={`${pill} px-6 py-[13px] text-[15px] text-[#101010] hover:brightness-110`} style={{ background: T.teal, boxShadow: "0 14px 40px -12px rgba(20,195,208,.6)" }}>
                  <span className="grid h-5 w-5 place-items-center rounded-full text-[9px] text-[#14C3D0]" style={{ background: "#101010" }}>▶</span>
                  {C.nav.cta}
                </Link>
              </div>
              <div className="mt-10 flex items-center">
                {C.hero.stats.map((s, i) => (
                  <div key={s.l} className={i > 0 ? "ps-6 sm:ps-8" : ""} style={i > 0 ? { borderInlineStart: "1px solid rgba(255,255,255,.14)", marginInlineStart: 24 } : undefined}>
                    <div className={`${serif.className} text-[28px] font-medium leading-none sm:text-[30px]`} style={{ color: "#fff" }}>{s.n}</div>
                    <div className="mt-1.5 text-[13px] font-light" style={{ color: "rgba(255,255,255,.55)" }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <HeroShowcase locale={locale} href={startHref} />
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

        {/* 4 · Nasıl Çalışır */}
        <section id="how" className="px-6 py-16 sm:px-12">
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

        {/* 5 · Doktorlar — tam genişlik tek bant (AI kartı kaldırıldı) */}
        <section className="px-6 pb-16 sm:px-12">
          <div className="rounded-[20px] p-7" style={{ background: T.surfaceAlt, border: `1px solid ${T.border}` }}>
            <h3 className={`${serif.className} text-[26px] font-medium tracking-[-0.01em]`}>{C.doctors.h}</h3>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
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
        </section>

        {/* 6 · Testimonial */}
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

        {/* 7 · CTA band — tek buton */}
        <section className="px-6 pb-16 sm:px-12">
          <div className="rounded-[20px] px-6 py-14 text-center text-white" style={{ background: T.emerald }}>
            <h2 className={`${serif.className} mx-auto max-w-[24ch] text-[30px] font-medium leading-[1.1] tracking-[-0.015em] sm:text-[40px]`}>{C.cta.h}</h2>
            <p className="mx-auto mt-4 max-w-[52ch] text-[15.5px] leading-[1.6] opacity-90">{C.cta.p}</p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link href={startHref} className={`${pill} bg-white px-6 py-[13px] text-[15px] hover:brightness-95`} style={{ color: "#101010" }}>{C.cta.b}</Link>
            </div>
          </div>
        </section>

        {/* 8 · Footer — tek satır link grubu */}
        <footer className="flex flex-wrap items-start justify-between gap-10 px-6 py-11 sm:px-12" style={{ background: T.surfaceAlt, borderTop: `1px solid ${T.border}` }}>
          <div className="max-w-xs">
            <PortamedLogo size={22} ink="#FFFFFF" />
            <p className="mt-2 text-[13.5px]" style={{ color: T.muted }}>{C.footer.desc}</p>
            <p className="mt-4 text-[11.5px]" style={{ color: "#9AA5A1" }}>© {new Date().getFullYear()} AURA · MVP demo</p>
          </div>
          <ul className="flex flex-wrap items-center gap-x-8 gap-y-3 text-[14px] font-medium">
            <li><a href="#how" className="hover:text-[#0EA5B2]" style={{ color: T.soft }}>{C.footer.how}</a></li>
            <li><Link href="/giris" className="hover:text-[#0EA5B2]" style={{ color: T.soft }}>{C.footer.patientLogin}</Link></li>
            <li><Link href="/kayit/hasta" className="hover:text-[#0EA5B2]" style={{ color: T.soft }}>{C.footer.patientSignup}</Link></li>
            <li><Link href="/kurumsal-giris" className="hover:text-[#0EA5B2]" style={{ color: T.soft }}>{C.footer.corporate}</Link></li>
            <li><Link href="/kayit" className="hover:text-[#0EA5B2]" style={{ color: T.soft }}>{C.footer.doctorSignup}</Link></li>
          </ul>
        </footer>
      </div>
    </div>
  );
}
