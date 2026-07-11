"use client";

// Sosyal giriş/kayıt bloğu — hasta ve doktor ekranlarının ortak parçası.
// Google: env yapılandırılmışsa aktif (intent'e göre hasta/doktor hesabı açılır), yoksa "Yakında".
// Apple: park ("Yakında" — Apple Developer hesabı gerekir). Marka ikonları lucide'de yok → inline SVG.

export function GoogleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 7.9-21l5.7-5.7A20 20 0 1 0 24 44a20 20 0 0 0 19.6-23.5Z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8A12 12 0 0 1 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7Z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44Z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C39.9 41 44 36 44 24c0-1.2-.1-2.4-.4-3.5Z" />
    </svg>
  );
}

export function AppleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.4 12.7c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.8-3.5.8s-1.8-.8-3-.8c-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.2.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7 2-1 2.8-2.1c.9-1.3 1.2-2.5 1.3-2.6-.1 0-2.5-1-2.5-3.8ZM14.1 5.5c.6-.8 1.1-1.9.9-3-1 0-2.1.6-2.8 1.4-.6.7-1.1 1.8-1 2.8 1.1.1 2.2-.5 2.9-1.2Z" />
    </svg>
  );
}

export function SocialAuthButtons({ googleEnabled, intent }: { googleEnabled: boolean; intent: "patient" | "doctor" }) {
  return (
    <div className="grid grid-cols-1 gap-2">
      {googleEnabled ? (
        <a href={`/api/auth/google/start?intent=${intent}`} className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#1E1F22] px-4 py-2.5 text-sm font-semibold text-white/85 hover:border-white/20 hover:text-[#F4F5F3]">
          <GoogleIcon /> Google ile devam et
        </a>
      ) : (
        <button type="button" disabled title="Yakında — yapılandırma gerektirir" className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-white/5 bg-[#1E1F22]/60 px-4 py-2.5 text-sm font-semibold text-white/35">
          <span className="opacity-40"><GoogleIcon /></span> Google ile devam et <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase">Yakında</span>
        </button>
      )}
      <button type="button" disabled title="Yakında — Apple Developer hesabı gerektirir" className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-white/5 bg-[#1E1F22]/60 px-4 py-2.5 text-sm font-semibold text-white/35">
        <AppleIcon /> Apple ile devam et <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase">Yakında</span>
      </button>
    </div>
  );
}
