"use client";

// Hero görsel showcase — ana sayfada 3'lü animasyonlu slider.
// Temiz line-icon (lucide) + akıcı CSS hareket + HTML kompozisyon. Harici görsel/lib yok.
// 1) Laptop ekranında GERÇEK ana sayfamızın minyatürü → video görüşmeye geçer; 8 dilde tıbbi terimler fırlar
// 2) İkinci Görüş — teşhis raporunuz bağımsız uzmanca incelenir → onaylı ikinci görüş
// 3) Ücretsiz Sağlık Hizmeti — insani sorumluluk (eldeki kalp + ihtiyaç sahiplerine ulaşma)
// Tüm slaytlar TEK huniye bağlanır (href prop → /basla seçim ekranı); kopya landing-copy.ts'te (8 dil).
// Slider LTR'a sabitlenir (translateX animasyonu RTL'de kırılır); slayt metin blokları locale yönünü alır.
import Link from "next/link";
import { useEffect, useState } from "react";
import { UserRound, Search, BadgeCheck, FileText, Activity, HandHeart, Heart, ArrowRight, MousePointer2 } from "lucide-react";
import { PortamedLogo } from "@/components/PortamedLogo";
import { LANDING_COPY, landingDir, type LandingLocale, type LandingCopy } from "@/lib/landing-copy";

const TEAL = "#28C8D8";
type Show = LandingCopy["showcase"];
const BG = [
  "radial-gradient(120% 82% at 50% 12%, #0E2A2E 0%, #0A0B0D 56%)",
  "radial-gradient(120% 82% at 50% 12%, #102330 0%, #0A0B0D 56%)",
  "radial-gradient(120% 82% at 50% 14%, #1A2026 0%, #0A0B0D 56%)",
];

// Görüşmede ekrandan fırlayan tıbbi terimler — 8 dil (RU/AZ/KK/KY/AR/EN/FR/DE)
const TERMS = [
  { t: "Diagnosis", tx: "-138px", ty: "-78px", d: 0 },
  { t: "Diagnose", tx: "12px", ty: "-120px", d: 0.7 },
  { t: "Cardiologie", tx: "142px", ty: "-62px", d: 1.4 },
  { t: "Кардиолог", tx: "-156px", ty: "8px", d: 2.1 },
  { t: "تشخيص", tx: "152px", ty: "26px", d: 2.8 },
  { t: "Müayinə", tx: "-118px", ty: "94px", d: 3.5 },
  { t: "Дәрігер", tx: "124px", ty: "100px", d: 4.2 },
  { t: "Ден соолук", tx: "2px", ty: "126px", d: 4.9 },
];

const KF = `
@keyframes hs-fly{0%{opacity:0;transform:translate(0,0) scale(.7)}14%{opacity:1}74%{opacity:.95}100%{opacity:0;transform:translate(var(--tx,0),var(--ty,0)) scale(1.06)}}
@keyframes hs-phaseA{0%,40%{opacity:1}50%,92%{opacity:0}100%{opacity:1}}
@keyframes hs-phaseB{0%,40%{opacity:0}50%,92%{opacity:1}100%{opacity:0}}
@keyframes hs-cursor{0%{transform:translate(0,0)}26%{transform:translate(var(--cx),var(--cy))}42%{transform:translate(var(--cx),var(--cy))}58%{transform:translate(0,0)}100%{transform:translate(0,0)}}
@keyframes hs-blink{0%,100%{opacity:1}50%{opacity:.2}}
@keyframes hs-ring{0%{transform:translate(-50%,-50%) scale(.55);opacity:.7}100%{transform:translate(-50%,-50%) scale(1.7);opacity:0}}
@keyframes hs-beat{0%,100%{transform:scale(1)}50%{transform:scale(1.09)}}
@keyframes hs-glow{0%,100%{opacity:.45;transform:translate(-50%,-50%) scale(1)}50%{opacity:.82;transform:translate(-50%,-50%) scale(1.16)}}
@keyframes hs-rise{0%{opacity:0;transform:translateY(8px) scale(.4)}25%{opacity:1}100%{opacity:0;transform:translateY(-50px) scale(1)}}
@keyframes hs-scan{0%{transform:translateY(0);opacity:0}14%{opacity:1}86%{opacity:1}100%{transform:translateY(var(--scan,56px));opacity:0}}
@keyframes hs-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes hs-pop{0%{opacity:0;transform:scale(.5)}60%{opacity:1;transform:scale(1.12)}100%{opacity:1;transform:scale(1)}}
@keyframes hs-seq{0%,100%{opacity:.3}50%{opacity:1}}
@media (prefers-reduced-motion: reduce){.hs-root *{animation-duration:1ms!important;animation-iteration-count:1!important}}
`;

function Avatar({ size = 46, tone = TEAL, bg = "rgba(40,200,216,.12)" }: { size?: number; tone?: string; bg?: string }) {
  return (
    <span style={{ display: "grid", placeItems: "center", width: size, height: size, borderRadius: "50%", background: bg, border: `1.5px solid ${tone}` }}>
      <UserRound size={Math.round(size * 0.5)} color={tone} />
    </span>
  );
}

// ── Slayt 1: Laptop ekranında gerçek ana sayfa minyatürü → video; fırlayan terimler ──
function Scene1({ S }: { S: Show }) {
  return (
    <div className="absolute inset-0">
      <div style={{ position: "absolute", left: "50%", top: "30%", width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle, rgba(40,200,216,.26), rgba(40,200,216,0) 68%)", filter: "blur(26px)", animation: "hs-glow 7s ease-in-out infinite" }} />

      {/* Laptop */}
      <div style={{ position: "absolute", left: "50%", top: "30%", width: "80%", transform: "translate(-50%,-50%)" }}>
        <div style={{ borderRadius: 13, border: "1px solid rgba(255,255,255,.16)", background: "#1b1d22", padding: 6, boxShadow: "0 26px 56px -22px rgba(0,0,0,.8)" }}>
          <div style={{ position: "relative", aspectRatio: "16 / 10", borderRadius: 7, overflow: "hidden", background: "#0D0E10" }}>

            {/* FAZ A — gerçek ana sayfa minyatürü */}
            <div style={{ position: "absolute", inset: 0, animation: "hs-phaseA 8s ease-in-out infinite" }}>
              {/* tarayıcı çubuğu */}
              <div style={{ height: "15%", display: "flex", alignItems: "center", gap: 5, padding: "0 8px", background: "#0A0B0D", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#ff5f57" }} />
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#febc2e" }} />
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#28c840" }} />
                <span style={{ marginLeft: 6, flex: 1, height: 11, borderRadius: 6, background: "rgba(255,255,255,.07)", display: "flex", alignItems: "center", paddingLeft: 8, fontSize: 7, color: "rgba(255,255,255,.4)" }}>aura.health</span>
              </div>
              {/* hero minyatürü */}
              <div style={{ position: "relative", height: "85%", padding: "9px 11px", background: "linear-gradient(160deg,#0D0E10,#0c1416)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <PortamedLogo size={12} ink="#FFFFFF" />
                  <div style={{ display: "flex", gap: 5 }}>{[0, 1, 2].map((i) => <span key={i} style={{ width: 9, height: 2, borderRadius: 2, background: "rgba(255,255,255,.3)" }} />)}</div>
                </div>
                <span style={{ display: "inline-block", marginTop: 9, fontSize: 6, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#6FDCE8", background: "rgba(40,200,216,.14)", borderRadius: 999, padding: "2px 6px" }}>{S.hp.eyebrow}</span>
                <div style={{ marginTop: 7, fontSize: 12, fontWeight: 700, lineHeight: 1.12, color: "#fff" }}>{S.hp.t1}<br />{S.hp.t2}</div>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 9, fontSize: 7.5, fontWeight: 700, color: "#06181a", background: TEAL, borderRadius: 999, padding: "4px 9px" }}>
                  <span style={{ display: "grid", placeItems: "center", width: 9, height: 9, borderRadius: "50%", background: "#06181a", color: TEAL, fontSize: 5 }}>▶</span>{S.hp.btn}
                </span>
                <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
                  {[["20k+", ""], ["40+", ""], ["4.9★", ""]].map((v, i) => <span key={i} style={{ fontSize: 9, fontWeight: 700, color: "#fff" }}>{v[0]}</span>)}
                </div>
                {/* imleç */}
                <div style={{ position: "absolute", left: 64, top: 70, color: "#fff", ["--cx" as string]: "-22px", ["--cy" as string]: "16px", animation: "hs-cursor 8s ease-in-out infinite" } as React.CSSProperties}>
                  <MousePointer2 size={13} fill="#fff" />
                </div>
              </div>
            </div>

            {/* FAZ B — video görüşme */}
            <div style={{ position: "absolute", inset: 0, opacity: 0, display: "grid", placeItems: "center", background: "linear-gradient(150deg,#0E3034,#0A1618)", animation: "hs-phaseB 8s ease-in-out infinite" }}>
              <div style={{ position: "relative", display: "grid", placeItems: "center" }}>
                <span style={{ position: "absolute", left: "50%", top: "50%", width: 60, height: 60, borderRadius: "50%", border: "2px solid rgba(40,200,216,.5)", animation: "hs-ring 2.2s ease-out infinite" }} />
                <Avatar size={48} />
              </div>
              <div style={{ position: "absolute", left: 8, top: 7, display: "flex", alignItems: "center", gap: 4, fontSize: 8, fontWeight: 700, color: "#fff", background: "rgba(0,0,0,.4)", padding: "2px 6px", borderRadius: 999 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#ff5b5b", animation: "hs-blink 1.4s infinite" }} /> {S.live}
              </div>
              <div style={{ position: "absolute", right: 7, bottom: 7, width: "24%", aspectRatio: "4 / 3", borderRadius: 5, border: "1px solid rgba(255,255,255,.2)", background: "linear-gradient(150deg,#1c2a2e,#121a1c)", display: "grid", placeItems: "center" }}>
                <UserRound size={14} color="rgba(255,255,255,.55)" />
              </div>
            </div>

          </div>
        </div>
        {/* taban */}
        <div style={{ margin: "0 auto", height: 6, width: "100%", borderRadius: "0 0 10px 10px", background: "linear-gradient(#26282e,#15171b)" }} />
        <div style={{ margin: "-1px auto 0", height: 3, width: "26%", borderRadius: "0 0 5px 5px", background: "rgba(255,255,255,.18)" }} />
      </div>

      {/* Fırlayan tıbbi terimler — 8 dil */}
      <div className="absolute inset-0" style={{ pointerEvents: "none" }}>
        {TERMS.map((t, i) => (
          <span key={i} style={{ position: "absolute", left: "50%", top: "29%", transform: "translate(-50%,-50%)" }}>
            <span style={{ display: "inline-block", whiteSpace: "nowrap", fontSize: 10.5, fontWeight: 600, color: i % 2 ? "#bdf0f5" : "#fff", border: "1px solid rgba(40,200,216,.5)", background: "rgba(11,13,15,.62)", borderRadius: 999, padding: "2px 9px", opacity: 0, ["--tx" as string]: t.tx, ["--ty" as string]: t.ty, animation: `hs-fly 5.2s ease-out ${t.d}s infinite` } as React.CSSProperties}>
              {t.t}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Slayt 2: İkinci görüş — rapor incelenir → onaylı ikinci görüş ──
function Scene2({ S }: { S: Show }) {
  return (
    <div className="absolute inset-0">
      <div style={{ position: "absolute", left: "50%", top: "33%", width: 240, height: 240, transform: "translate(-50%,-50%)", borderRadius: "50%", background: "radial-gradient(circle, rgba(40,200,216,.2), rgba(40,200,216,0) 70%)", filter: "blur(26px)" }} />
      <div style={{ position: "absolute", left: "50%", top: "33%", transform: "translate(-50%,-50%)", width: 168 }}>
        {/* Rapor kartı (her zaman) */}
        <div style={{ position: "relative", borderRadius: 14, background: "#15171B", border: "1px solid rgba(255,255,255,.14)", padding: 14, boxShadow: "0 24px 50px -22px rgba(0,0,0,.7)", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ display: "grid", placeItems: "center", width: 24, height: 24, borderRadius: 7, background: "rgba(40,200,216,.16)", color: TEAL }}><FileText size={14} /></span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{S.s2.doc}</span>
          </div>
          {["88%", "98%", "72%"].map((w, i) => <div key={i} style={{ marginTop: 9, height: 5, width: w, borderRadius: 4, background: "rgba(255,255,255,.13)" }} />)}
          <div style={{ marginTop: 11, display: "flex", alignItems: "center", gap: 4, color: TEAL }}><Activity size={13} /><div style={{ flex: 1, height: 5, borderRadius: 4, background: "rgba(40,200,216,.18)" }} /></div>
          {/* tarama çizgisi (faz A) */}
          <div style={{ position: "absolute", left: 0, right: 0, top: 8, height: 16, background: "linear-gradient(180deg, rgba(40,200,216,0), rgba(40,200,216,.28), rgba(40,200,216,0))", ["--scan" as string]: "92px", animation: "hs-phaseA 8s ease-in-out infinite, hs-scan 2.6s ease-in-out infinite" } as React.CSSProperties} />
        </div>

        {/* Faz A — büyüteç (inceleme) */}
        <div style={{ position: "absolute", right: -14, top: -14, animation: "hs-phaseA 8s ease-in-out infinite" }}>
          <span style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: "50%", background: "rgba(11,13,15,.9)", border: `1.5px solid ${TEAL}`, color: TEAL, boxShadow: "0 10px 22px -10px rgba(0,0,0,.7)", animation: "hs-float 3s ease-in-out infinite" }}><Search size={19} /></span>
        </div>
        <div style={{ position: "absolute", left: -10, bottom: 6, fontSize: 9.5, fontWeight: 600, color: "rgba(255,255,255,.6)", animation: "hs-phaseA 8s ease-in-out infinite" }}>{S.s2.reviewing}</div>

        {/* Faz B — onaylı ikinci görüş + uzman */}
        <div style={{ position: "absolute", right: -18, top: -18, opacity: 0, animation: "hs-phaseB 8s ease-in-out infinite" }}>
          <span style={{ display: "grid", placeItems: "center", width: 42, height: 42, borderRadius: "50%", background: TEAL, color: "#06181a", boxShadow: "0 12px 26px -10px rgba(40,200,216,.7)" }}><BadgeCheck size={24} /></span>
        </div>
        <div style={{ position: "absolute", left: -22, bottom: -16, display: "flex", alignItems: "center", gap: 7, opacity: 0, animation: "hs-phaseB 8s ease-in-out infinite" }}>
          <Avatar size={36} />
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#fff" }}>{S.s2.verified}</div>
            <div style={{ fontSize: 8.5, color: "rgba(255,255,255,.55)" }}>{S.s2.note}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Slayt 3: Ücretsiz Sağlık Hizmeti — insani sorumluluk (eldeki kalp + ihtiyaç sahiplerine ulaşma) ──
function Scene3() {
  const figs = [{ x: "16%", y: "62%", d: "0s" }, { x: "50%", y: "70%", d: "1s" }, { x: "84%", y: "62%", d: "2s" }];
  return (
    <div className="absolute inset-0">
      <div style={{ position: "absolute", left: "50%", top: "32%", width: 250, height: 250, borderRadius: "50%", background: "radial-gradient(circle, rgba(40,200,216,.28), rgba(198,166,100,.14) 48%, rgba(40,200,216,0) 72%)", filter: "blur(26px)", animation: "hs-glow 6s ease-in-out infinite" }} />

      {/* bağ çizgileri */}
      <svg viewBox="0 0 400 500" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet" style={{ pointerEvents: "none" }}>
        <path d="M200,180 C150,250 110,280 66,304" fill="none" stroke="rgba(40,200,216,.28)" strokeWidth="1.6" strokeDasharray="3 6" />
        <path d="M200,188 L200,338" fill="none" stroke="rgba(40,200,216,.28)" strokeWidth="1.6" strokeDasharray="3 6" />
        <path d="M200,180 C250,250 290,280 334,304" fill="none" stroke="rgba(40,200,216,.28)" strokeWidth="1.6" strokeDasharray="3 6" />
      </svg>

      {/* Yükselen küçük kalpler */}
      {[{ x: "40%", d: "0s" }, { x: "56%", d: "1.1s" }, { x: "48%", d: "2.2s" }].map((h, i) => (
        <span key={i} style={{ position: "absolute", left: h.x, top: "26%", color: TEAL, opacity: 0, animation: `hs-rise 3.3s ease-out ${h.d} infinite` }}><Heart size={11} fill={TEAL} /></span>
      ))}

      {/* Merkez — el + kalp (atan, ışıyan) */}
      <div style={{ position: "absolute", left: "50%", top: "30%", transform: "translate(-50%,-50%)" }}>
        <div style={{ position: "relative", display: "grid", placeItems: "center" }}>
          <span style={{ position: "absolute", left: "50%", top: "50%", width: 92, height: 92, borderRadius: "50%", border: "1.5px solid rgba(40,200,216,.4)", animation: "hs-ring 2.6s ease-out infinite" }} />
          <span style={{ display: "grid", placeItems: "center", width: 86, height: 86, borderRadius: "50%", background: "rgba(40,200,216,.1)", border: "1.5px solid rgba(40,200,216,.35)" }}>
            <span style={{ display: "grid", placeItems: "center", animation: "hs-beat 1.8s ease-in-out infinite" }}><HandHeart size={46} color={TEAL} /></span>
          </span>
        </div>
      </div>

      {/* İhtiyaç sahibi figürler (sırayla parlar) */}
      {figs.map((f, i) => (
        <div key={i} style={{ position: "absolute", left: f.x, top: f.y, transform: "translate(-50%,-50%)", animation: `hs-seq 4.5s ease-in-out ${f.d} infinite` }}>
          <Avatar size={34} tone="rgba(255,255,255,.8)" bg="rgba(255,255,255,.06)" />
        </div>
      ))}
    </div>
  );
}

export function HeroShowcase({ locale, href }: { locale: LandingLocale; href: string }) {
  const S = LANDING_COPY[locale].showcase;
  const textDir = landingDir(locale);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setActive((a) => (a + 1) % 3), 7000);
    return () => clearInterval(id);
  }, [paused]);

  return (
    <div
      dir="ltr" // slider translateX animasyonu RTL'de kırılır — kapsayıcı LTR sabit, metinler textDir alır
      className="hs-root relative aspect-[4/5] w-full overflow-hidden rounded-[24px]"
      style={{ border: "1px solid rgba(255,255,255,.12)", boxShadow: "0 30px 80px -28px rgba(40,200,216,.5)", background: "#0A0B0D" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <style>{KF}</style>
      <div className="flex h-full w-full" style={{ transform: `translateX(-${active * 100}%)`, transition: "transform .7s cubic-bezier(.7,0,.2,1)" }}>
        {S.slides.map((sl, i) => (
          <Link key={i} href={href} aria-label={sl.tag} className="relative block h-full w-full shrink-0 overflow-hidden" style={{ background: BG[i] }}>
            {i === 0 ? <Scene1 S={S} /> : i === 1 ? <Scene2 S={S} /> : <Scene3 />}
            <div dir={textDir} className="absolute inset-x-0 bottom-0 z-10 px-5 pb-11 pt-16 text-start sm:px-6" style={{ background: "linear-gradient(180deg, rgba(8,9,11,0) 0%, rgba(8,9,11,.8) 50%, rgba(8,9,11,.97) 100%)" }}>
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.12em]" style={{ background: "rgba(40,200,216,.16)", color: "#6FDCE8" }}>{sl.tag}</span>
              <div className="mt-2.5 text-[17px] font-semibold leading-[1.22] text-white sm:text-[19px]">{sl.title}</div>
              <p className="mt-1.5 text-[12.5px] leading-[1.5] sm:text-[13.5px]" style={{ color: "rgba(255,255,255,.62)" }}>{sl.sub}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold" style={{ color: TEAL }}>{sl.cta} <ArrowRight size={14} className="rtl:rotate-180" /></span>
            </div>
          </Link>
        ))}
      </div>
      <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2">
        {S.slides.map((_, i) => (
          <button key={i} type="button" onClick={() => setActive(i)} aria-label={`${i + 1}. slayt`} className="h-1.5 rounded-full transition-all" style={{ width: i === active ? 26 : 7, background: i === active ? TEAL : "rgba(255,255,255,.32)" }} />
        ))}
      </div>
    </div>
  );
}
