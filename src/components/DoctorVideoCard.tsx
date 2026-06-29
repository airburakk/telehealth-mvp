// Doktor tanıtım videosu (kartvizit) — cinsiyete göre yüklenir (erkek/kadın isimli doktor).
// Kaynak: public/videos/doctor-male.mp4 · doctor-female.mp4. Sessiz otomatik döngü (kartvizit hissi)
// + tam kontroller (kullanıcı sesli izleyebilir/durdurabilir). Presentational (server component uyumlu).
export function DoctorVideoCard({ name, title, female }: { name: string; title: string; female: boolean }) {
  const src = female ? "/videos/doctor-female.mp4" : "/videos/doctor-male.mp4";
  return (
    <div className="dvc">
      <video
        className="dvc-video"
        src={src}
        autoPlay
        muted
        loop
        playsInline
        controls
        preload="metadata"
        aria-label={`${title} ${name} tanıtım videosu`}
      />
      <div className="dvc-top" aria-hidden>
        <span className="dvc-badge"><i /> TANITIM</span>
        <span className="dvc-id">{title} {name}</span>
      </div>

      <style>{`
        .dvc { position: relative; aspect-ratio: 16/9; width: 100%; overflow: hidden; border-radius: 0.75rem; background: #07221f; }
        .dvc-video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; background: #000; }
        .dvc-top { position: absolute; top: 0; left: 0; right: 0; z-index: 2; display: flex; align-items: center;
          justify-content: space-between; gap: 0.5rem; padding: 0.6rem 0.75rem; pointer-events: none;
          background: linear-gradient(to bottom, rgba(0,0,0,0.5), transparent); }
        .dvc-badge { display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.6rem; font-weight: 700;
          letter-spacing: 0.04em; color: rgba(255,255,255,0.95); background: rgba(0,0,0,0.35); padding: 0.2rem 0.45rem; border-radius: 999px; }
        .dvc-badge i { height: 6px; width: 6px; border-radius: 50%; background: #f87171; animation: dvc-blink 1.4s steps(1) infinite; }
        .dvc-id { font-size: 0.7rem; font-weight: 700; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,0.6); }
        @keyframes dvc-blink { 50% { opacity: 0.2; } }
        @media (prefers-reduced-motion: reduce) { .dvc-badge i { animation: none; } }
      `}</style>
    </div>
  );
}
