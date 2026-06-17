"use client";

// Hero görsel showcase — ana sayfada İstanbul fotoğrafının yerini alan 3'lü animasyonlu slider.
// Saf CSS/SVG animasyon (harici görsel/kütüphane yok), AURA koyu teması, EN/TR çift dilli.
// 1) Hemen doktorla görüş (PC+mobil video + AI triyaj/70 dil tercüme/sağlık turizmi rozetleri)
// 2) İkinci Görüş (klinik → teşhis raporu → AURA'ya yükleme → uzmanla video)
// 3) Pro Bono (hasta↔gönüllü hekim eşleşmesi, ücretsiz)
import Link from "next/link";
import { useEffect, useState } from "react";
import { Brain, Languages, Plane, Stethoscope, FileText, UploadCloud, Video, Check, Globe, Heart, ArrowRight } from "lucide-react";

type Locale = "en" | "tr";

const SHOW = {
  en: {
    slides: [
      { tag: "Talk to a doctor now", title: "See a specialist over video — from your phone or your computer.", sub: "AI triage routes you to the right doctor, with live interpreting in 70 languages — and your doctor can plan the whole treatment journey.", cta: "Start now" },
      { tag: "Second Opinion", title: "Already diagnosed? Get an independent expert review.", sub: "Upload your existing report, then meet an accredited specialist over video for a confident second opinion.", cta: "Get a second opinion" },
      { tag: "Pro Bono", title: "Care that shouldn’t wait for a budget.", sub: "We match patients in need with volunteer specialists — at no cost.", cta: "Apply free" },
    ],
    s1: { triage: "AI triage", interpret: "70-language interpreting", tourism: "Health-tourism plan", rec: "LIVE" },
    live: ["Hello, how can I help you today?", "Merhaba, bugün nasıl yardımcı olabilirim?", "Здравствуйте, чем могу помочь?", "مرحبًا، كيف يمكنني مساعدتك؟"],
    s2: { steps: ["Clinic", "Report", "Upload", "Expert"], doc: "Diagnosis report", badge: "2nd opinion" },
    s3: { free: "Free · €0", was: "€1,490", volunteer: "Volunteer specialist", patient: "Patient in need" },
  },
  tr: {
    slides: [
      { tag: "Hemen doktorla görüş", title: "Telefonunuzdan ya da bilgisayarınızdan uzmanla video görüşün.", sub: "AI triyaj sizi doğru doktora yönlendirir, 70 dilde simültane tercüme yapılır — ve doktorunuz tüm tedavi yolculuğunu planlayabilir.", cta: "Hemen başla" },
      { tag: "İkinci Görüş", title: "Teşhisiniz mi var? Bağımsız uzman değerlendirmesi alın.", sub: "Elinizdeki raporu yükleyin, ardından akredite uzmanla video görüşerek güvenle ikinci görüş alın.", cta: "İkinci görüş al" },
      { tag: "Pro Bono", title: "Bütçe bekleyemeyecek bir bakım.", sub: "İhtiyaç sahibi hastaları gönüllü uzmanlarla ücretsiz buluştururuz.", cta: "Ücretsiz başvur" },
    ],
    s1: { triage: "AI triyaj", interpret: "70 dilde tercüme", tourism: "Sağlık turizmi planı", rec: "CANLI" },
    live: ["Merhaba, bugün nasıl yardımcı olabilirim?", "Hello, how can I help you today?", "Здравствуйте, чем могу помочь?", "مرحبًا، كيف يمكنني مساعدتك؟"],
    s2: { steps: ["Klinik", "Rapor", "Yükle", "Uzman"], doc: "Teşhis raporu", badge: "İkinci görüş" },
    s3: { free: "Ücretsiz · €0", was: "€1.490", volunteer: "Gönüllü uzman", patient: "İhtiyaç sahibi hasta" },
  },
};

type Show = (typeof SHOW)["en"];

const HREFS = ["/giris", "/second-opinion", "/pro-bono"];
const BG = [
  "radial-gradient(120% 82% at 50% 14%, #0E2A2E 0%, #0A0B0D 58%)",
  "radial-gradient(120% 82% at 50% 14%, #102330 0%, #0A0B0D 58%)",
  "radial-gradient(120% 82% at 50% 14%, #14272B 0%, #0A0B0D 58%)",
];

const KF = `
@keyframes hs-glow{0%,100%{opacity:.5;transform:translate(-50%,-50%) scale(1)}50%{opacity:.85;transform:translate(-50%,-50%) scale(1.16)}}
@keyframes hs-pulse{0%{transform:scale(.5);opacity:.7}100%{transform:scale(1.7);opacity:0}}
@keyframes hs-blink{0%,100%{opacity:1}50%{opacity:.2}}
@keyframes hs-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes hs-beat{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
@keyframes hs-third{0%{opacity:0;transform:translateY(9px) scale(.95)}5%{opacity:1;transform:translateY(0) scale(1)}29%{opacity:1;transform:translateY(0) scale(1)}34%{opacity:0;transform:translateY(-8px) scale(.98)}100%{opacity:0}}
@keyframes hs-quarter{0%{opacity:0;transform:translateY(8px)}3%{opacity:1;transform:translateY(0)}22%{opacity:1;transform:translateY(0)}25%{opacity:0;transform:translateY(-8px)}100%{opacity:0}}
@keyframes hs-progress{0%{width:8%}65%{width:100%}100%{width:100%}}
@media (prefers-reduced-motion: reduce){.hs-root *{animation-duration:1ms!important;animation-iteration-count:1!important}}
`;

function DocAvatar({ s = 54 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 54 54" style={{ display: "block" }}>
      <circle cx="27" cy="27" r="27" fill="rgba(255,255,255,.06)" />
      <circle cx="27" cy="20" r="9" fill="#14C3D0" />
      <path d="M8 51c0-10 8.5-16 19-16s19 6 19 16z" fill="#14C3D0" />
      <path d="M22 33v5c0 3.4 10 3.4 10 0v-5" fill="none" stroke="#06181a" strokeWidth="1.6" />
      <circle cx="32" cy="44" r="2.2" fill="#06181a" />
    </svg>
  );
}
function PatientAvatar({ s = 54 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 54 54" style={{ display: "block" }}>
      <circle cx="27" cy="27" r="27" fill="rgba(255,255,255,.06)" />
      <circle cx="27" cy="20" r="9" fill="#9FBEC4" />
      <path d="M8 51c0-10 8.5-16 19-16s19 6 19 16z" fill="#9FBEC4" />
    </svg>
  );
}

function Chip({ pos, delay, icon, label }: { pos: React.CSSProperties; delay: string; icon: React.ReactNode; label: string }) {
  return (
    <div style={{ position: "absolute", ...pos, display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 999, background: "rgba(11,13,15,.8)", border: "1px solid rgba(20,195,208,.42)", color: "#fff", fontSize: 11.5, fontWeight: 600, backdropFilter: "blur(6px)", boxShadow: "0 12px 26px -14px rgba(0,0,0,.7)", whiteSpace: "nowrap", opacity: 0, animation: "hs-third 9s ease-in-out infinite", animationDelay: delay }}>
      <span style={{ color: "#14C3D0", display: "grid", placeItems: "center" }}>{icon}</span>
      {label}
    </div>
  );
}

// ── Slayt 1: PC + mobil video görüşme ──
function Scene1({ S }: { S: Show }) {
  return (
    <div className="absolute inset-0">
      <div style={{ position: "absolute", left: "50%", top: "32%", width: 290, height: 290, borderRadius: "50%", background: "radial-gradient(circle, rgba(20,195,208,.3), rgba(20,195,208,0) 68%)", filter: "blur(26px)", animation: "hs-glow 6s ease-in-out infinite" }} />

      {/* Laptop */}
      <div style={{ position: "absolute", left: "52%", top: "31%", width: "70%", transform: "translate(-50%,-50%)" }}>
        <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,.14)", background: "#15171B", padding: 7, boxShadow: "0 26px 54px -22px rgba(0,0,0,.75)" }}>
          <div style={{ position: "relative", aspectRatio: "16 / 10", borderRadius: 8, overflow: "hidden", background: "linear-gradient(150deg,#0E3034,#0A1618)" }}>
            <div style={{ position: "absolute", left: "50%", top: "44%", transform: "translate(-50%,-50%)", display: "grid", placeItems: "center" }}>
              <span style={{ position: "absolute", width: 64, height: 64, borderRadius: "50%", border: "2px solid rgba(20,195,208,.55)", animation: "hs-pulse 2.2s ease-out infinite" }} />
              <DocAvatar s={56} />
            </div>
            <div style={{ position: "absolute", left: 8, top: 7, display: "flex", alignItems: "center", gap: 5, fontSize: 9, fontWeight: 700, letterSpacing: ".06em", color: "#fff", background: "rgba(0,0,0,.4)", padding: "3px 7px", borderRadius: 999 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff5b5b", animation: "hs-blink 1.4s infinite" }} /> {S.s1.rec}
            </div>
            <div style={{ position: "absolute", right: 7, bottom: 26, width: "26%", aspectRatio: "4 / 3", borderRadius: 6, overflow: "hidden", border: "1px solid rgba(255,255,255,.2)", background: "linear-gradient(150deg,#1c2a2e,#121a1c)", display: "grid", placeItems: "center" }}>
              <PatientAvatar s={26} />
            </div>
            <div style={{ position: "absolute", left: 6, right: 6, bottom: 6, display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,.48)", borderRadius: 8, padding: "5px 8px", minHeight: 25 }}>
              <Globe size={13} color="#5FD3E2" style={{ flexShrink: 0 }} />
              <div style={{ position: "relative", flex: 1, height: 15 }}>
                {S.live.map((t, i) => (
                  <span key={i} style={{ position: "absolute", inset: 0, fontSize: 11, lineHeight: "15px", color: "rgba(255,255,255,.92)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", opacity: 0, animation: "hs-quarter 8s linear infinite", animationDelay: `${-i * 2}s` }}>{t}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div style={{ margin: "0 auto", height: 6, width: "84%", borderRadius: "0 0 9px 9px", background: "rgba(255,255,255,.13)" }} />
        <div style={{ margin: "0 auto", height: 2, width: "30%", borderRadius: 9, background: "rgba(255,255,255,.18)" }} />
      </div>

      {/* Telefon (mobil) */}
      <div style={{ position: "absolute", left: "11%", top: "46%", width: "18%", transform: "rotate(-7deg)" }}>
        <div style={{ animation: "hs-float 5s ease-in-out infinite" }}>
          <div style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,.16)", background: "#15171B", padding: 4, boxShadow: "0 18px 38px -16px rgba(0,0,0,.75)" }}>
            <div style={{ position: "relative", aspectRatio: "9 / 17", borderRadius: 8, overflow: "hidden", background: "linear-gradient(160deg,#0E3034,#0A1618)", display: "grid", placeItems: "center" }}>
              <DocAvatar s={30} />
              <span style={{ position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)", display: "grid", placeItems: "center", width: 18, height: 18, borderRadius: "50%", background: "#14C3D0" }}><Video size={10} color="#06181a" /></span>
            </div>
          </div>
        </div>
      </div>

      <Chip pos={{ top: "8%", right: "6%" }} delay="0s" icon={<Brain size={13} />} label={S.s1.triage} />
      <Chip pos={{ top: "19%", left: "4%" }} delay="-3s" icon={<Languages size={13} />} label={S.s1.interpret} />
      <Chip pos={{ top: "50%", right: "5%" }} delay="-6s" icon={<Plane size={13} />} label={S.s1.tourism} />
    </div>
  );
}

// ── Slayt 2: İkinci görüş yolculuğu (klinik → rapor → yükleme → uzman) ──
function Scene2({ S }: { S: Show }) {
  const stepIcons = [<Stethoscope size={14} key="a" />, <FileText size={14} key="b" />, <UploadCloud size={14} key="c" />, <Video size={14} key="d" />];
  const stageWrap: React.CSSProperties = { position: "absolute", left: 0, right: 0, top: "32%", transform: "translateY(-50%)", display: "grid", placeItems: "center" };
  return (
    <div className="absolute inset-0">
      {/* Adım göstergesi */}
      <div style={{ position: "absolute", top: "8%", left: "8%", right: "8%", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ position: "absolute", top: 15, left: "12%", right: "12%", height: 2, background: "rgba(255,255,255,.12)" }} />
        {S.s2.steps.map((st, i) => (
          <div key={st} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flex: 1, zIndex: 1 }}>
            <div style={{ position: "relative", width: 30, height: 30, display: "grid", placeItems: "center", borderRadius: "50%", background: "#0E1113", border: "1px solid rgba(255,255,255,.14)", color: "rgba(255,255,255,.5)" }}>
              {stepIcons[i]}
              <div style={{ position: "absolute", inset: -1, borderRadius: "50%", background: "#14C3D0", display: "grid", placeItems: "center", color: "#06181a", opacity: 0, animation: "hs-quarter 12s linear infinite", animationDelay: `${-i * 3}s` }}>{stepIcons[i]}</div>
            </div>
            <span style={{ fontSize: 9.5, fontWeight: 600, color: "rgba(255,255,255,.55)" }}>{st}</span>
          </div>
        ))}
      </div>

      {/* Aşama 1 — Klinik */}
      <div style={{ ...stageWrap, opacity: 0, animation: "hs-quarter 12s ease-in-out infinite", animationDelay: "0s" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <PatientAvatar s={50} />
          <div style={{ display: "flex", gap: 5 }}>
            {[0, 1, 2].map((d) => <span key={d} style={{ width: 6, height: 6, borderRadius: "50%", background: "#14C3D0", animation: "hs-blink 1.2s infinite", animationDelay: `${d * 0.2}s` }} />)}
          </div>
          <DocAvatar s={50} />
        </div>
      </div>

      {/* Aşama 2 — Teşhis raporu */}
      <div style={{ ...stageWrap, opacity: 0, animation: "hs-quarter 12s ease-in-out infinite", animationDelay: "-3s" }}>
        <div style={{ width: 180, maxWidth: "62%", borderRadius: 12, background: "#15171B", border: "1px solid rgba(255,255,255,.14)", padding: 14, boxShadow: "0 22px 46px -20px rgba(0,0,0,.7)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ display: "grid", placeItems: "center", width: 24, height: 24, borderRadius: 7, background: "rgba(20,195,208,.16)", color: "#14C3D0" }}><FileText size={14} /></span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{S.s2.doc}</span>
          </div>
          {["86%", "96%", "70%"].map((w, i) => <div key={i} style={{ marginTop: 9, height: 5, width: w, borderRadius: 4, background: "rgba(255,255,255,.14)" }} />)}
          <div style={{ marginTop: 11, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9.5, fontWeight: 700, color: "#06181a", background: "#14C3D0", padding: "2px 7px", borderRadius: 999 }}><Check size={10} /> ICD-10</div>
        </div>
      </div>

      {/* Aşama 3 — AURA'ya yükleme */}
      <div style={{ ...stageWrap, opacity: 0, animation: "hs-quarter 12s ease-in-out infinite", animationDelay: "-6s" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <div style={{ animation: "hs-float 2.4s ease-in-out infinite", color: "#14C3D0" }}><UploadCloud size={36} /></div>
          <div style={{ width: 92, borderRadius: 8, background: "#15171B", border: "1px solid rgba(255,255,255,.14)", padding: "8px 9px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}><FileText size={11} color="#5FD3E2" /><span style={{ fontSize: 9.5, color: "rgba(255,255,255,.7)" }}>report.pdf</span></div>
            <div style={{ marginTop: 7, height: 4, width: "100%", borderRadius: 4, background: "rgba(255,255,255,.12)", overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 4, background: "#14C3D0", animation: "hs-progress 3s ease-out infinite" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Aşama 4 — Uzmanla video */}
      <div style={{ ...stageWrap, opacity: 0, animation: "hs-quarter 12s ease-in-out infinite", animationDelay: "-9s" }}>
        <div style={{ width: 200, maxWidth: "66%", borderRadius: 12, border: "1px solid rgba(255,255,255,.14)", background: "#15171B", padding: 7, boxShadow: "0 22px 46px -20px rgba(0,0,0,.7)" }}>
          <div style={{ position: "relative", aspectRatio: "16 / 11", borderRadius: 8, overflow: "hidden", background: "linear-gradient(150deg,#0E3034,#0A1618)", display: "grid", placeItems: "center" }}>
            <DocAvatar s={48} />
            <span style={{ position: "absolute", left: 7, top: 7, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9.5, fontWeight: 700, color: "#06181a", background: "#14C3D0", padding: "2px 7px", borderRadius: 999 }}><Check size={10} /> {S.s2.badge}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Slayt 3: Pro Bono — hasta ↔ gönüllü hekim ──
function Scene3({ S }: { S: Show }) {
  return (
    <div className="absolute inset-0">
      <div style={{ position: "absolute", left: "50%", top: "34%", width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle, rgba(198,166,100,.22), rgba(20,195,208,.16) 45%, rgba(20,195,208,0) 70%)", filter: "blur(28px)", animation: "hs-glow 6s ease-in-out infinite" }} />

      <svg viewBox="0 0 300 170" style={{ position: "absolute", left: "50%", top: "40%", width: "84%", transform: "translate(-50%,-50%)", overflow: "visible" }}>
        <path d="M42,128 C100,40 200,40 258,128" fill="none" stroke="rgba(20,195,208,.45)" strokeWidth="2" strokeDasharray="4 7" strokeLinecap="round" />
        <circle r="5" fill="#14C3D0" style={{ filter: "drop-shadow(0 0 6px #14C3D0)" }}>
          <animateMotion dur="2.6s" repeatCount="indefinite" path="M42,128 C100,40 200,40 258,128" />
        </circle>
      </svg>

      {/* Kalp */}
      <div style={{ position: "absolute", left: "50%", top: "20%", transform: "translate(-50%,-50%)" }}>
        <div style={{ display: "grid", placeItems: "center", width: 44, height: 44, borderRadius: "50%", background: "rgba(20,195,208,.14)", border: "1px solid rgba(20,195,208,.4)", animation: "hs-beat 1.6s ease-in-out infinite" }}>
          <Heart size={20} color="#14C3D0" fill="#14C3D0" />
        </div>
      </div>

      {/* Ücretsiz rozeti */}
      <div style={{ position: "absolute", left: "50%", top: "42%", transform: "translate(-50%,-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.45)", textDecoration: "line-through" }}>{S.s3.was}</span>
        <div style={{ animation: "hs-beat 1.8s ease-in-out infinite" }}>
          <span style={{ display: "inline-block", fontSize: 16, fontWeight: 800, color: "#06181a", background: "#14C3D0", padding: "5px 14px", borderRadius: 999, boxShadow: "0 14px 30px -12px rgba(20,195,208,.7)" }}>{S.s3.free}</span>
        </div>
      </div>

      {/* Hasta */}
      <div style={{ position: "absolute", left: "15%", top: "60%", transform: "translate(-50%,-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
        <PatientAvatar s={48} />
        <span style={{ fontSize: 9.5, fontWeight: 600, color: "rgba(255,255,255,.55)", textAlign: "center", maxWidth: 78 }}>{S.s3.patient}</span>
      </div>
      {/* Gönüllü hekim */}
      <div style={{ position: "absolute", left: "85%", top: "60%", transform: "translate(-50%,-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
        <DocAvatar s={48} />
        <span style={{ fontSize: 9.5, fontWeight: 600, color: "rgba(255,255,255,.55)", textAlign: "center", maxWidth: 78 }}>{S.s3.volunteer}</span>
      </div>
    </div>
  );
}

export function HeroShowcase({ locale }: { locale: Locale }) {
  const S = SHOW[locale];
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setActive((a) => (a + 1) % 3), 6500);
    return () => clearInterval(id);
  }, [paused]);

  return (
    <div
      className="hs-root relative aspect-[4/5] w-full overflow-hidden rounded-[24px]"
      style={{ border: "1px solid rgba(255,255,255,.12)", boxShadow: "0 30px 80px -28px rgba(20,195,208,.5)", background: "#0A0B0D" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <style>{KF}</style>
      <div className="flex h-full w-full" style={{ transform: `translateX(-${active * 100}%)`, transition: "transform .7s cubic-bezier(.7,0,.2,1)" }}>
        {S.slides.map((sl, i) => (
          <Link key={i} href={HREFS[i]} aria-label={sl.tag} className="relative block h-full w-full shrink-0 overflow-hidden" style={{ background: BG[i] }}>
            {i === 0 ? <Scene1 S={S} /> : i === 1 ? <Scene2 S={S} /> : <Scene3 S={S} />}
            <div className="absolute inset-x-0 bottom-0 z-10 px-5 pb-11 pt-16 sm:px-6" style={{ background: "linear-gradient(180deg, rgba(8,9,11,0) 0%, rgba(8,9,11,.8) 50%, rgba(8,9,11,.97) 100%)" }}>
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.12em]" style={{ background: "rgba(20,195,208,.16)", color: "#5FD3E2" }}>{sl.tag}</span>
              <div className="mt-2.5 text-[17px] font-semibold leading-[1.22] text-white sm:text-[19px]">{sl.title}</div>
              <p className="mt-1.5 text-[12.5px] leading-[1.5] sm:text-[13.5px]" style={{ color: "rgba(255,255,255,.62)" }}>{sl.sub}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold" style={{ color: "#14C3D0" }}>{sl.cta} <ArrowRight size={14} /></span>
            </div>
          </Link>
        ))}
      </div>
      <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2">
        {S.slides.map((_, i) => (
          <button key={i} type="button" onClick={() => setActive(i)} aria-label={`${i + 1}. slayt`} className="h-1.5 rounded-full transition-all" style={{ width: i === active ? 26 : 7, background: i === active ? "#14C3D0" : "rgba(255,255,255,.32)" }} />
        ))}
      </div>
    </div>
  );
}
