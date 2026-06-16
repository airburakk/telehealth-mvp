// Üretilen animasyonlu "video kartvizit" — telifsiz (kod üretimi), dış bağımlılık yok, footage değil.
// Saf CSS keyframe: portal halkası + nabız çizgisi + sıralı giriş + ilerleme çubuğu → "oynuyor" hissi.
// Tek instance/sayfa olduğu için class adları sade; presentational (server component uyumlu).
export function DoctorVideoCard({
  name, title, branch, city, color, tagline,
}: {
  name: string; title: string; branch: string; city: string; color: string; tagline: string;
}) {
  return (
    <div className="dvc">
      <div className="dvc-ring" aria-hidden />
      <svg className="dvc-pulse" viewBox="0 0 260 40" preserveAspectRatio="none" aria-hidden>
        <path d="M0 20 H92 l7 -13 l9 26 l7 -20 l5 7 H260" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>

      <div className="dvc-content">
        <span className="dvc-avatar" style={{ background: color }}>{name.slice(0, 1)}</span>
        <span className="dvc-name">{title} {name}</span>
        <span className="dvc-branch">{branch} · {city}</span>
        <span className="dvc-tag">{tagline}</span>
      </div>

      <span className="dvc-badge"><i /> TANITIM · 60 sn</span>
      <div className="dvc-bar"><span /></div>

      <style>{`
        .dvc { position: relative; aspect-ratio: 16/9; width: 100%; overflow: hidden; border-radius: 0.75rem;
          background: radial-gradient(120% 120% at 30% 20%, #0E9E97 0%, #0A3F39 55%, #07221f 100%); color: #fff; }
        .dvc-ring { position: absolute; top: -40%; right: -25%; width: 80%; aspect-ratio: 1; border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.10); box-shadow: 0 0 0 18px rgba(255,255,255,0.04), inset 0 0 60px rgba(255,255,255,0.06);
          animation: dvc-spin 18s linear infinite; }
        .dvc-pulse { position: absolute; left: 0; right: 0; bottom: 18%; width: 100%; height: 18%; opacity: 0.7;
          stroke-dasharray: 360; stroke-dashoffset: 360; animation: dvc-draw 3.2s ease-in-out infinite; }
        .dvc-content { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: flex-start;
          justify-content: center; gap: 0.35rem; padding: 0 1.25rem; }
        .dvc-avatar { display: grid; place-items: center; height: 2.6rem; width: 2.6rem; border-radius: 0.7rem;
          font-weight: 800; font-size: 1.25rem; box-shadow: 0 6px 18px rgba(0,0,0,0.3); opacity: 0;
          animation: dvc-pop 0.7s cubic-bezier(.2,.8,.2,1) 0.2s forwards; }
        .dvc-name { font-weight: 800; font-size: 1.05rem; letter-spacing: -0.01em; opacity: 0; transform: translateY(8px);
          animation: dvc-in 0.7s ease 0.9s forwards; }
        .dvc-branch { font-size: 0.8rem; color: rgba(255,255,255,0.85); opacity: 0; transform: translateY(8px);
          animation: dvc-in 0.7s ease 1.4s forwards; }
        .dvc-tag { margin-top: 0.15rem; font-size: 0.7rem; color: rgba(255,255,255,0.75); max-width: 90%;
          opacity: 0; transform: translateY(8px); animation: dvc-in 0.7s ease 1.9s forwards; }
        .dvc-badge { position: absolute; top: 0.6rem; left: 0.75rem; display: inline-flex; align-items: center; gap: 0.3rem;
          font-size: 0.6rem; font-weight: 700; letter-spacing: 0.04em; color: rgba(255,255,255,0.9);
          background: rgba(0,0,0,0.25); padding: 0.2rem 0.45rem; border-radius: 999px; }
        .dvc-badge i { height: 6px; width: 6px; border-radius: 50%; background: #f87171; animation: dvc-blink 1.4s steps(1) infinite; }
        .dvc-bar { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: rgba(255,255,255,0.15); }
        .dvc-bar span { display: block; height: 100%; width: 0; background: rgba(255,255,255,0.85);
          animation: dvc-fill 10s linear infinite; }
        @keyframes dvc-spin { to { transform: rotate(360deg); } }
        @keyframes dvc-draw { 0% { stroke-dashoffset: 360; } 50% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: -360; } }
        @keyframes dvc-pop { from { opacity: 0; transform: scale(.6); } to { opacity: 1; transform: scale(1); } }
        @keyframes dvc-in { to { opacity: 1; transform: translateY(0); } }
        @keyframes dvc-blink { 50% { opacity: 0.2; } }
        @keyframes dvc-fill { to { width: 100%; } }
        @media (prefers-reduced-motion: reduce) {
          .dvc-ring, .dvc-pulse, .dvc-bar span, .dvc-badge i { animation: none; }
          .dvc-avatar, .dvc-name, .dvc-branch, .dvc-tag { animation: none; opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}
