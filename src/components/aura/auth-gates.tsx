"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type RefObject } from "react";
import { useSearchParams } from "next/navigation";
import { WordHeadline } from "@/components/aura/word-headline";
import { AuraMark } from "@/components/PortamedLogo";
import { LangProvider, useLang, langDir, LINKS, VIDEOS } from "@/lib/aura-landing/i18n";

// Vitrin giriş kapıları (aura-health.higgsfield.app'ten taşındı, 2026-07-12 —
// v5.9 taşımasında atlanmıştı; kullanıcı kararı "birebir kapı + ayrı form"):
// SigninGate (/giris) = "AURA Sign Up" tasarımının birebir inşası — #0D0E10
// sayfa üzerinde 22px radius panel; SOL 467px form kolonu (sembol, letterform
// başlık, üç sağlayıcı butonu, OR ayracı, mikro yasal metin), SAĞ gece Boğaz
// videosu. CorporateGate (/kurumsal-giris) = aynı panelin personel uyarlaması:
// rol seçici (görsel bağlam — tüm roller aynı girişe gider) + tek birincil CTA,
// sağda uzman/radyoloji videosu. Çalışan e-posta/demo formları alt rotalarda
// (/giris/e-posta · /kurumsal-giris/e-posta); kapılar ?next/?verify/?oauth
// parametrelerini forma iletir (proxy kimliksizi ?next ile kapıya düşürür).

// Kapıya gelen sistem parametrelerini form linkine taşı (banner'lar formda).
function useForwardedParams() {
  const sp = useSearchParams();
  const keep = new URLSearchParams();
  for (const k of ["next", "verify", "oauth"]) {
    const v = sp.get(k);
    if (v) keep.set(k, v);
  }
  const q = keep.toString();
  return (base: string) => (q ? `${base}?${q}` : base);
}

// Sağ panel videosu yalnız md+ yerleşiminde var (hidden md:block); dar ekranda
// play() gizli videoyu boşuna indirtir (preload="none" ancak oynatma başlamazsa
// veri tasarrufu sağlar) — görünmeyecekse hiç başlatma. Arka plan sekmesinde
// mount-play ertelenir/reddedilir → görünür olunca yeniden dene (yoksa panel
// poster'da kalır).
function useGateVideo(videoRef: RefObject<HTMLVideoElement | null>) {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const panelVisible = window.matchMedia("(min-width: 768px)").matches;
    const video = videoRef.current;
    if (!video || reduced || !panelVisible) return;
    const tryPlay = () => void video.play().catch(() => {});
    tryPlay();
    const onVis = () => {
      if (document.visibilityState === "visible") tryPlay();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      video.pause();
    };
  }, [videoRef]);
}

// Panel kabuğu: iki kapının ortak grid'i + sağ video paneli (720p hafif kopya —
// panel yarı ekran çizilir; Range'siz sunucu dersinden kalan tercih zararsız,
// Vercel 206 verse de yarı-ekran panele 1080p gereksiz).
function GateShell({
  video,
  children,
}: {
  video: { src720: string; poster: string };
  children: React.ReactNode;
}) {
  const { lang } = useLang();
  const videoRef = useRef<HTMLVideoElement>(null);
  useGateVideo(videoRef);

  return (
    <div
      dir={langDir(lang)}
      lang={lang}
      className="aura-page flex min-h-dvh items-center justify-center px-4 py-8 md:px-10"
    >
      <div className="grid w-full max-w-6xl overflow-hidden rounded-[22px] border border-[var(--aura-hairline)] bg-[var(--aura-panel)] md:min-h-[640px] md:grid-cols-[minmax(380px,467px)_1fr]">
        {/* Sol: form kolonu — içerik yatay ortalı (logo/AURA başlık/metin ortada;
            w-full butonlar tam genişlikte kalır, flex item stretch sayesinde). */}
        <div className="flex flex-col justify-center px-8 py-12 text-center md:px-12">{children}</div>

        {/* Sağ: video paneli */}
        <div className="relative hidden md:block">
          <video
            ref={videoRef}
            muted
            loop
            playsInline
            preload="none"
            poster={video.poster}
            className="absolute inset-0 h-full w-full object-cover"
            aria-hidden
          >
            <source src={video.src720} type="video/mp4" />
          </video>
        </div>
      </div>
    </div>
  );
}

// ————— Hasta kapısı (/giris) —————

export function SigninGate() {
  return (
    <LangProvider>
      <SigninPanel />
    </LangProvider>
  );
}

function SigninPanel() {
  const { t } = useLang();
  const withParams = useForwardedParams();

  return (
    <GateShell video={VIDEOS.hero}>
      <Link href="/" aria-label="AURA" className="flex justify-center">
        <AuraMark size={40} />
      </Link>
      <WordHeadline
        word={t.signin.word}
        wordBefore={t.signin.wordBefore}
        wordAfter={t.signin.wordAfter}
        lineAfter={t.signin.lineAfter}
        braille
      />
      <p className="mt-3 text-[15px] text-[var(--aura-grey)]">{t.signin.sub}</p>

      <div className="mt-8 space-y-3">
        {/* Google: CANLI — ara sayfa atlanır, doğrudan OAuth başlangıcı (OAuth
            dönüşü rol ana sayfasına iner; ?next yalnız e-posta yolunda taşınır) */}
        <ProviderButton href={LINKS.googleStart} label={t.signin.google} icon={<GoogleIcon />} />
        <ProviderButton
          href={withParams(LINKS.emailLogin)}
          label={t.signin.apple}
          icon={<AppleIcon />}
        />
        <ProviderButton
          href={withParams(LINKS.emailLogin)}
          label={t.signin.email}
          icon={<MailIcon />}
        />
      </div>

      <div className="mt-6 flex items-center gap-3">
        <span aria-hidden className="h-px flex-1 bg-[var(--aura-hairline)]" />
        <span className="aura-mono text-[11px] text-[var(--aura-micro)]">{t.signin.or}</span>
        <span aria-hidden className="h-px flex-1 bg-[var(--aura-hairline)]" />
      </div>

      <Link
        href="/"
        className="aura-mono mt-6 text-[13px] text-[var(--aura-grey)] transition-colors duration-200 hover:text-[var(--aura-accent)]"
      >
        {"← "}
        {t.signin.back}
      </Link>

      {/* DÜRÜSTLÜK (2026-07-15): eski metin "Gizlilik Politikası + Kullanım
          Koşulları"na atıf yapıyordu — ikisi de YOK, link bile değildi (kullanıcı
          okuyamadığı belgeyi kabul etmiş sayılıyordu). Artık YAYINDA OLAN
          /guven-ve-gizlilik'e atıf + gerçek link. ⚠️ İki belge yazılınca metin
          yeniden düzenlenir (copy.ts signin.legal + legalLink, 8 dil). */}
      <p className="mt-8 text-[12px] leading-relaxed text-[var(--aura-micro)]">
        {t.signin.legal}
        <Link
          href="/guven-ve-gizlilik"
          className="text-[var(--aura-grey)] underline underline-offset-2 transition-colors duration-200 hover:text-[var(--aura-accent)]"
        >
          {t.signin.legalLink}
        </Link>
        {t.signin.legalAfter}
      </p>
    </GateShell>
  );
}

// ————— Kurumsal kapı (/kurumsal-giris) —————

export function CorporateGate() {
  return (
    <LangProvider>
      <CorporatePanel />
    </LangProvider>
  );
}

function CorporatePanel() {
  const { t } = useLang();
  const c = t.corporate;
  const withParams = useForwardedParams();
  const [role, setRole] = useState(0); // roles dizisinde indeks; 0 = Doktor

  return (
    <GateShell video={VIDEOS.so}>
      <Link href="/" aria-label="AURA" className="flex justify-center">
        <AuraMark size={40} />
      </Link>
      <WordHeadline
        word={c.word}
        wordBefore={c.wordBefore}
        wordAfter={c.wordAfter}
        lineAfter={c.lineAfter}
        braille
      />
      <p className="mt-3 text-[15px] text-[var(--aura-grey)]">{c.sub}</p>

      <div className="mt-8 space-y-4">
        <RoleSelect label={c.roleLabel} roles={c.roles} value={role} onChange={setRole} />
        <a
          href={withParams(LINKS.corporateEmailLogin)}
          className="group flex w-full items-center justify-center gap-2.5 rounded-[13px] bg-[var(--aura-accent)] px-4 py-3 text-[15px] font-semibold text-[var(--aura-bg)] transition-transform duration-200 hover:translate-y-[-1px] active:scale-[0.99]"
        >
          {c.continue}
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M2 8h10M8 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </div>

      <Link
        href="/"
        className="aura-mono mt-8 text-[13px] text-[var(--aura-grey)] transition-colors duration-200 hover:text-[var(--aura-accent)]"
      >
        {"← "}
        {c.back}
      </Link>

      <p className="mt-8 text-[12px] leading-relaxed text-[var(--aura-micro)]">{c.legal}</p>
    </GateShell>
  );
}

// Rol seçici: /giris buton diliyle (13px radius, #1E1F22 yüzey) açılır liste;
// seçim yalnız görsel bağlam sağlar — tüm roller aynı kurumsal girişe gider.
function RoleSelect({
  label,
  roles,
  value,
  onChange,
}: {
  label: string;
  roles: string[];
  value: number;
  onChange: (i: number) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <p className="aura-mono text-[11px] uppercase tracking-widest text-[var(--aura-micro)]">
        {label}
      </p>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="mt-2 flex w-full items-center justify-between gap-3 rounded-[13px] border border-[var(--aura-hairline)] bg-[var(--aura-surface)] px-4 py-3 text-left text-[15px] font-semibold text-[var(--aura-ink)] transition-colors duration-200 hover:border-[var(--aura-accent)]/50"
      >
        <span className="truncate">{roles[value]}</span>
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className={
            "h-4 w-4 shrink-0 text-[var(--aura-grey)] transition-transform duration-200 " +
            (open ? "rotate-180" : "")
          }
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <>
          {/* Dışarı tıklama: görünmez kapatma katmanı */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <ul
            role="listbox"
            aria-label={label}
            className="absolute z-20 mt-2 w-full overflow-hidden rounded-[13px] border border-[var(--aura-hairline)] bg-[var(--aura-surface)] py-1 shadow-[0_18px_50px_rgba(0,0,0,0.55)]"
          >
            {roles.map((r, i) => (
              <li key={r} role="option" aria-selected={i === value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(i);
                    setOpen(false);
                  }}
                  className={
                    "flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[14px] transition-colors duration-150 hover:bg-[var(--aura-panel)] " +
                    (i === value
                      ? "font-semibold text-[var(--aura-accent)]"
                      : "text-[var(--aura-ink)]")
                  }
                >
                  <span
                    aria-hidden
                    className={
                      "h-1.5 w-1.5 shrink-0 rounded-full " +
                      (i === value ? "bg-[var(--aura-accent)]" : "bg-transparent")
                    }
                  />
                  {r}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// Sağlayıcı butonu: Sign Up tasarımındaki #1E1F22 + ince beyaz kenar + 13px
// radius dili. Hedef: platformun gerçek giriş formu (yöntem orada seçilir).
function ProviderButton({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="flex w-full items-center justify-center gap-2.5 rounded-[13px] border border-[var(--aura-hairline)] bg-[var(--aura-surface)] px-4 py-3 text-[15px] font-semibold text-[var(--aura-ink)] transition-colors duration-200 hover:border-[var(--aura-accent)]/50 active:scale-[0.99]"
    >
      {icon}
      {label}
    </a>
  );
}

// lucide'de marka ikonu yok — inline SVG kuralı (v4.0 dersi).
function GoogleIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width="18" height="18">
      <path
        fill="#EA4335"
        d="M12 5.04c1.62 0 3.06.56 4.2 1.64l3.12-3.12C17.45 1.8 14.97.75 12 .75 7.4.75 3.43 3.39 1.5 7.24l3.66 2.84C6.05 7.02 8.78 5.04 12 5.04Z"
      />
      <path
        fill="#4285F4"
        d="M23.25 12.27c0-.93-.08-1.6-.26-2.3H12v4.36h6.44c-.13 1.08-.83 2.7-2.39 3.79l3.57 2.77c2.09-1.93 3.63-4.9 3.63-8.62Z"
      />
      <path
        fill="#FBBC05"
        d="M5.17 14.17a6.97 6.97 0 0 1-.38-2.17c0-.76.14-1.49.36-2.17L1.5 7.24A11.25 11.25 0 0 0 .75 12c0 1.81.43 3.52 1.2 5.04l3.22-2.87Z"
      />
      <path
        fill="#34A853"
        d="M12 23.25c3.04 0 5.59-1 7.45-2.72l-3.57-2.77c-.95.66-2.23 1.12-3.88 1.12-3.22 0-5.95-2.12-6.87-5.06l-3.22 2.87c1.91 3.9 5.9 6.56 10.09 6.56Z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M16.98 12.9c.03 3.02 2.65 4.03 2.68 4.04-.02.07-.42 1.43-1.38 2.83-.83 1.22-1.7 2.43-3.06 2.45-1.34.03-1.77-.79-3.3-.79-1.53 0-2 .77-3.27.82-1.31.05-2.31-1.31-3.15-2.52C3.79 17.25 2.47 12.75 4.23 9.7c.87-1.51 2.43-2.47 4.12-2.5 1.29-.02 2.5.87 3.29.87.79 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.27-2.11 3.76ZM14.44 5.6c.7-.84 1.16-2.01 1.03-3.18-1 .04-2.21.67-2.93 1.51-.64.74-1.2 1.93-1.05 3.07 1.12.09 2.26-.57 2.95-1.4Z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4 7 8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
