"use client";

// Hero görsel showcase — ana sayfada İstanbul fotoğrafının yerini alan 3'lü "çizgi animasyon" slider.
// Stil: SVG line-art + kendini çizen çizgi (stroke-dashoffset, pathLength=1). Harici görsel/lib yok.
// 1) AURA ana sayfasından video başlar; ekrandan 8 dilde tıbbi terimler fırlar
// 2) İkinci Görüş (klinik → teşhis raporu → AURA'ya yükleme → uzmanla video)
// 3) Pro Bono — insani sorumluluk senaryosu (eller bir kalbi sahiplenir, ihtiyaç sahiplerine uzanır)
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

type Locale = "en" | "tr";

const SHOW = {
  en: {
    slides: [
      { tag: "Talk to a doctor now", title: "Open AURA — and your video visit begins.", sub: "Start right from our homepage on any device. As you speak, medical terms are interpreted live across 70 languages.", cta: "Start now" },
      { tag: "Second Opinion", title: "Already diagnosed? Get an independent expert review.", sub: "Upload your existing report, then meet an accredited specialist over video for a confident second opinion.", cta: "Get a second opinion" },
      { tag: "Pro Bono", title: "Health is a human right — not a privilege.", sub: "When care is out of reach, our volunteer doctors step in. Looking after one another is a responsibility we all share.", cta: "Join the cause" },
    ],
    s2: { steps: ["Clinic", "Report", "Upload", "Expert"], badge: "2nd opinion" },
  },
  tr: {
    slides: [
      { tag: "Hemen doktorla görüş", title: "AURA'yı açın — video görüşmeniz başlasın.", sub: "Görüşme doğrudan ana sayfamızdan başlar. Siz konuşurken tıbbi terimler 70 dilde anlık çevrilir.", cta: "Hemen başla" },
      { tag: "İkinci Görüş", title: "Teşhisiniz mi var? Bağımsız uzman değerlendirmesi alın.", sub: "Elinizdeki raporu yükleyin, ardından akredite uzmanla video görüşerek güvenle ikinci görüş alın.", cta: "İkinci görüş al" },
      { tag: "Pro Bono", title: "Sağlık bir insan hakkı — ayrıcalık değil.", sub: "Bakıma ulaşamayanların yanında gönüllü hekimlerimiz var. Birbirimize sahip çıkmak hepimizin sorumluluğudur.", cta: "Destek ol" },
    ],
    s2: { steps: ["Klinik", "Rapor", "Yükle", "Uzman"], badge: "İkinci görüş" },
  },
};

type Show = (typeof SHOW)["en"];

const HREFS = ["/giris", "/second-opinion", "/pro-bono"];
const BG = [
  "radial-gradient(120% 82% at 50% 12%, #0E2A2E 0%, #0A0B0D 56%)",
  "radial-gradient(120% 82% at 50% 12%, #102330 0%, #0A0B0D 56%)",
  "radial-gradient(120% 82% at 50% 12%, #16262B 0%, #0A0B0D 56%)",
];

// Görüşmede ekrandan fırlayan tıbbi terimler — 8 dil (RU/AZ/KK/KY/AR/EN/FR/DE)
const TERMS = [
  { t: "Diagnosis", tx: "-134px", ty: "-74px", d: 0 },     // EN
  { t: "Diagnose", tx: "10px", ty: "-118px", d: 0.7 },     // DE
  { t: "Cardiologie", tx: "140px", ty: "-58px", d: 1.4 },  // FR
  { t: "Кардиолог", tx: "-152px", ty: "10px", d: 2.1 },    // RU
  { t: "تشخيص", tx: "150px", ty: "26px", d: 2.8 },          // AR
  { t: "Müayinə", tx: "-116px", ty: "92px", d: 3.5 },      // AZ
  { t: "Дәрігер", tx: "122px", ty: "98px", d: 4.2 },       // KK
  { t: "Ден соолук", tx: "4px", ty: "124px", d: 4.9 },     // KY
];

const KF = `
@keyframes hs-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
@keyframes hs-fly{0%{opacity:0;transform:translate(0,0) scale(.7)}14%{opacity:1}74%{opacity:.95}100%{opacity:0;transform:translate(var(--tx,0),var(--ty,0)) scale(1.06)}}
@keyframes hs-phaseA{0%,40%{opacity:1}50%,92%{opacity:0}100%{opacity:1}}
@keyframes hs-phaseB{0%,40%{opacity:0}50%,92%{opacity:1}100%{opacity:0}}
@keyframes hs-cursor{0%{transform:translate(0,0)}24%{transform:translate(-86px,16px)}40%{transform:translate(-86px,16px)}56%{transform:translate(0,0)}100%{transform:translate(0,0)}}
@keyframes hs-quarter{0%{opacity:1}21%{opacity:1}25%{opacity:0}96%{opacity:0}100%{opacity:1}}
@keyframes hs-blink{0%,100%{opacity:1}50%{opacity:.2}}
@keyframes hs-beat{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
@media (prefers-reduced-motion: reduce){.hs-root *{animation-duration:1ms!important;animation-iteration-count:1!important}}
`;

// Kendini çizen çizgi (pathLength=1 → tüm yollar normalize)
function P({ d, delay = 0, dur = 2.4, w = 2, c = "#9fe9f0", op = 1 }: { d: string; delay?: number; dur?: number; w?: number; c?: string; op?: number }) {
  return (
    <path d={d} fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" pathLength={1} opacity={op}
      style={{ strokeDasharray: 1, strokeDashoffset: 1, animation: `hs-draw ${dur}s ease-out ${delay}s forwards` }} />
  );
}
const cir = (cx: number, cy: number, r: number) => `M ${cx - r},${cy} a ${r},${r} 0 1,0 ${2 * r},0 a ${r},${r} 0 1,0 ${-2 * r},0`;
const TEAL = "#14C3D0";

// ── Slayt 1: AURA ana sayfası → video; 8 dilde fırlayan tıbbi terimler ──
function Scene1() {
  return (
    <div className="absolute inset-0">
      <div style={{ position: "absolute", left: "50%", top: "30%", width: 280, height: 280, transform: "translate(-50%,-50%)", borderRadius: "50%", background: "radial-gradient(circle, rgba(20,195,208,.26), rgba(20,195,208,0) 68%)", filter: "blur(26px)" }} />
      <svg viewBox="0 0 400 500" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet">
        {/* Laptop gövdesi */}
        <P d="M112,72 H288 q8,0 8,8 V190 q0,8 -8,8 H112 q-8,0 -8,-8 V80 q0,-8 8,-8 Z" w={2.4} c="#bdf0f5" />
        <P d="M84,198 H316 L334,226 H66 Z" delay={0.25} w={2.4} c="#bdf0f5" />
        <P d="M150,198 H250" delay={0.5} w={2} c="rgba(255,255,255,.35)" />

        {/* Faz A — AURA ana sayfası (logo + başlık + buton + imleç) */}
        <g style={{ animation: "hs-phaseA 8s ease-in-out infinite" }}>
          <P d="M200,90 L210,114 H190 Z" delay={0.6} w={2} c={TEAL} />
          <P d="M196,108 H204" delay={0.8} w={2} c={TEAL} />
          <P d="M134,130 H252" delay={0.9} w={2} c="rgba(255,255,255,.5)" />
          <P d="M134,142 H214" delay={1.0} w={2} c="rgba(255,255,255,.5)" />
          <P d="M134,156 H196 q6,0 6,6 V170 q0,6 -6,6 H134 q-6,0 -6,-6 V162 q0,-6 6,-6 Z" delay={1.1} w={2} c={TEAL} />
          <path d="M145,161 v12 l10,-6 Z" fill={TEAL} />
          <P d="M167,167 H190" delay={1.2} w={1.6} c="rgba(255,255,255,.6)" />
          <g style={{ animation: "hs-cursor 8s ease-in-out infinite" }}>
            <path d="M0,0 L0,15 L4,11 L7,17 L9,16 L6,10 L11,10 Z" fill="#fff" transform="translate(238,150)" />
          </g>
        </g>

        {/* Faz B — video görüşme (hekim + REC) */}
        <g style={{ opacity: 0, animation: "hs-phaseB 8s ease-in-out infinite" }}>
          <P d={cir(200, 122, 13)} dur={3} w={2} c={TEAL} />
          <P d="M174,160 q26,-22 52,0" delay={0.2} dur={3} w={2} c={TEAL} />
          <P d="M193,138 q-7,9 0,16" delay={0.3} dur={3} w={1.6} c="#bdf0f5" />
          <circle cx="132" cy="96" r="3.4" fill="#ff5b5b" style={{ animation: "hs-blink 1.4s infinite" }} />
          <P d="M142,96 H160" delay={0.4} dur={3} w={1.6} c="rgba(255,255,255,.55)" />
        </g>

        {/* Telefon (mobil) */}
        <g transform="rotate(-8 60 290)">
          <P d="M40,252 H80 q6,0 6,6 V324 q0,6 -6,6 H40 q-6,0 -6,-6 V258 q0,-6 6,-6 Z" delay={0.7} w={2} c="#bdf0f5" />
          <P d={cir(60, 291, 9)} delay={1.0} dur={3} w={1.6} c={TEAL} />
          <path d="M56,287 v8 l7,-4 Z" fill={TEAL} />
        </g>
      </svg>

      {/* Fırlayan tıbbi terimler — 8 dil */}
      <div className="absolute inset-0" style={{ pointerEvents: "none" }}>
        {TERMS.map((t, i) => (
          <span key={i} style={{ position: "absolute", left: "50%", top: "29%", transform: "translate(-50%,-50%)" }}>
            <span
              style={{
                display: "inline-block", whiteSpace: "nowrap", fontSize: 10.5, fontWeight: 600,
                color: i % 2 ? "#bdf0f5" : "#fff", border: "1px solid rgba(20,195,208,.5)",
                background: "rgba(11,13,15,.55)", borderRadius: 999, padding: "2px 9px", opacity: 0,
                ["--tx" as string]: t.tx, ["--ty" as string]: t.ty,
                animation: `hs-fly 5.2s ease-out ${t.d}s infinite`,
              } as React.CSSProperties}
            >
              {t.t}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Slayt 2: İkinci görüş yolculuğu (line-art, çapraz geçiş) ──
function Scene2({ S }: { S: Show }) {
  const nx = [72, 158, 244, 330];
  const stepIcon = [
    <P key="i0" d="M64,80 H80 M72,72 V88" dur={3} w={2} c={TEAL} />,
    <P key="i1" d="M151,71 H165 V89 H151 Z M155,77 H161 M155,82 H161" dur={3} w={1.8} c={TEAL} />,
    <P key="i2" d="M244,88 V72 M238,78 L244,72 L250,78" dur={3} w={1.8} c={TEAL} />,
    <P key="i3" d="M324,73 L336,80 L324,87 Z" dur={3} w={1.8} c={TEAL} />,
  ];
  return (
    <div className="absolute inset-0">
      <svg viewBox="0 0 400 500" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet">
        {/* Adım göstergesi */}
        <P d="M88,80 H312" w={1.6} c="rgba(255,255,255,.16)" />
        {nx.map((x, i) => (
          <g key={i}>
            <P d={cir(x, 80, 16)} delay={i * 0.15} dur={3} w={1.8} c="rgba(255,255,255,.3)" />
            <g style={{ opacity: 0, animation: `hs-quarter 12s ease-in-out ${-i * 3}s infinite` }}>
              <path d={cir(x, 80, 16)} fill="none" stroke={TEAL} strokeWidth={2.4} />
            </g>
            {stepIcon[i]}
            <text x={x} y={108} textAnchor="middle" fontSize="11" fontWeight="600" fill="rgba(255,255,255,.6)">{S.s2.steps[i]}</text>
          </g>
        ))}

        {/* Aşama 1 — Klinik */}
        <g style={{ opacity: 0, animation: "hs-quarter 12s ease-in-out 0s infinite" }}>
          <P d={cir(156, 196, 15)} dur={3} w={2} c="#bdf0f5" />
          <P d="M134,234 q22,-20 44,0" delay={0.2} dur={3} w={2} c="#bdf0f5" />
          <P d={cir(248, 196, 15)} delay={0.1} dur={3} w={2} c={TEAL} />
          <P d="M226,234 q22,-20 44,0" delay={0.3} dur={3} w={2} c={TEAL} />
          <P d="M222,178 q-6,8 0,14" delay={0.4} dur={3} w={1.5} c="#bdf0f5" />
          {[188, 202, 216].map((x, k) => <circle key={k} cx={x} cy="192" r="2.6" fill={TEAL} style={{ animation: `hs-blink 1.2s ${k * 0.2}s infinite` }} />)}
        </g>

        {/* Aşama 2 — Teşhis raporu */}
        <g style={{ opacity: 0, animation: "hs-quarter 12s ease-in-out -3s infinite" }}>
          <P d="M166,158 H234 q4,0 4,4 V252 q0,4 -4,4 H166 q-4,0 -4,-4 V162 q0,-4 4,-4 Z" dur={3} w={2} c="#bdf0f5" />
          <P d="M178,176 H222" delay={0.2} dur={3} w={2} c={TEAL} />
          <P d="M178,192 H222" delay={0.3} dur={3} w={1.8} c="rgba(255,255,255,.5)" />
          <P d="M178,204 H214" delay={0.35} dur={3} w={1.8} c="rgba(255,255,255,.5)" />
          <P d="M176,224 h10 l5,-12 l6,24 l5,-12 h12" delay={0.5} dur={3} w={2} c={TEAL} />
          <text x={200} y={246} textAnchor="middle" fontSize="10" fontWeight="700" fill="rgba(255,255,255,.55)">ICD-10</text>
        </g>

        {/* Aşama 3 — AURA'ya yükleme */}
        <g style={{ opacity: 0, animation: "hs-quarter 12s ease-in-out -6s infinite" }}>
          <P d="M168,206 q-12,0 -12,-13 q0,-13 15,-13 q3,-15 21,-15 q17,0 18,17 q12,0 12,12 q0,12 -13,12 Z" dur={3} w={2} c="#bdf0f5" />
          <P d="M191,202 V178 M182,187 L191,178 L200,187" delay={0.3} dur={3} w={2} c={TEAL} />
          <P d="M163,232 H237" delay={0.1} dur={3} w={2} c="rgba(255,255,255,.22)" />
          <P d="M163,232 H237" delay={0.5} dur={2.4} w={2.4} c={TEAL} />
        </g>

        {/* Aşama 4 — Uzmanla video */}
        <g style={{ opacity: 0, animation: "hs-quarter 12s ease-in-out -9s infinite" }}>
          <P d="M150,168 H250 q5,0 5,5 V247 q0,5 -5,5 H150 q-5,0 -5,-5 V173 q0,-5 5,-5 Z" dur={3} w={2} c="#bdf0f5" />
          <P d={cir(200, 202, 14)} delay={0.2} dur={3} w={2} c={TEAL} />
          <P d="M178,238 q22,-18 44,0" delay={0.35} dur={3} w={2} c={TEAL} />
          <P d="M160,180 l5,5 l9,-10" delay={0.5} dur={3} w={2.2} c={TEAL} />
        </g>
      </svg>
    </div>
  );
}

// ── Slayt 3: Pro Bono — insani sorumluluk (eller bir kalbi sahiplenir, ihtiyaç sahiplerine uzanır) ──
function Scene3() {
  return (
    <div className="absolute inset-0">
      <div style={{ position: "absolute", left: "50%", top: "28%", width: 260, height: 260, transform: "translate(-50%,-50%)", borderRadius: "50%", background: "radial-gradient(circle, rgba(198,166,100,.2), rgba(20,195,208,.16) 45%, rgba(20,195,208,0) 70%)", filter: "blur(28px)" }} />
      <svg viewBox="0 0 400 500" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet">
        {/* İhtiyaç sahiplerine uzanan ince bağ çizgileri */}
        <P d="M150,210 C120,232 96,250 74,256" delay={0.6} dur={5} w={1.4} c="rgba(20,195,208,.4)" />
        <P d="M250,210 C280,232 304,250 326,256" delay={0.7} dur={5} w={1.4} c="rgba(20,195,208,.4)" />

        {/* Kalp + medikal çarpı (atan) */}
        <g style={{ transformBox: "fill-box", transformOrigin: "center", animation: "hs-beat 1.8s ease-in-out infinite" }}>
          <P d="M200,178 C168,150 150,130 150,110 C150,94 162,84 176,84 C188,84 196,92 200,102 C204,92 212,84 224,84 C238,84 250,94 250,110 C250,130 232,150 200,178 Z" dur={4.5} w={2.4} c={TEAL} />
          <P d="M192,116 H208 M200,108 V124" delay={0.6} dur={4} w={2.2} c="#bdf0f5" />
        </g>

        {/* Sahiplenen eller (kalbi kavrayan iki avuç) */}
        <P d="M150,176 C130,188 124,210 134,228 C139,237 148,241 158,240" delay={0.3} w={2.2} c="#bdf0f5" />
        <P d="M250,176 C270,188 276,210 266,228 C261,237 252,241 242,240" delay={0.4} w={2.2} c="#bdf0f5" />
        <P d="M150,232 q50,26 100,0" delay={0.5} w={2.2} c="#bdf0f5" />
        {[170, 188, 212, 230].map((x, k) => <P key={k} d={`M${x},238 V${k === 0 || k === 3 ? 248 : 251}`} delay={0.6 + k * 0.05} dur={4} w={1.8} c="#bdf0f5" />)}

        {/* İhtiyaç sahibi figürler (sol & sağ) */}
        <P d={cir(74, 286, 12)} delay={0.8} dur={3.5} w={2} c="rgba(255,255,255,.7)" />
        <P d="M56,314 q18,-16 36,0" delay={0.9} dur={3.5} w={2} c="rgba(255,255,255,.7)" />
        <P d={cir(326, 286, 12)} delay={0.85} dur={3.5} w={2} c="rgba(255,255,255,.7)" />
        <P d="M308,314 q18,-16 36,0" delay={0.95} dur={3.5} w={2} c="rgba(255,255,255,.7)" />
      </svg>
    </div>
  );
}

export function HeroShowcase({ locale }: { locale: Locale }) {
  const S = SHOW[locale];
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setActive((a) => (a + 1) % 3), 7000);
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
            {i === 0 ? <Scene1 key={active === 0 ? "on" : "off"} /> : i === 1 ? <Scene2 S={S} key={active === 1 ? "on" : "off"} /> : <Scene3 key={active === 2 ? "on" : "off"} />}
            <div className="absolute inset-x-0 bottom-0 z-10 px-5 pb-11 pt-16 sm:px-6" style={{ background: "linear-gradient(180deg, rgba(8,9,11,0) 0%, rgba(8,9,11,.8) 50%, rgba(8,9,11,.97) 100%)" }}>
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.12em]" style={{ background: "rgba(20,195,208,.16)", color: "#5FD3E2" }}>{sl.tag}</span>
              <div className="mt-2.5 text-[17px] font-semibold leading-[1.22] text-white sm:text-[19px]">{sl.title}</div>
              <p className="mt-1.5 text-[12.5px] leading-[1.5] sm:text-[13.5px]" style={{ color: "rgba(255,255,255,.62)" }}>{sl.sub}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold" style={{ color: TEAL }}>{sl.cta} <ArrowRight size={14} /></span>
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
