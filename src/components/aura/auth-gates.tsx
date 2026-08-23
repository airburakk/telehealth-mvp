"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type RefObject } from "react";
import { useSearchParams } from "next/navigation";
import { WordHeadline } from "@/components/aura/word-headline";
import { GateEmailForm } from "@/components/aura/gate-email-form";
import { LangProvider, useLang, langDir, LINKS, VIDEOS } from "@/lib/aura-landing/i18n";
import { AiVideoNoticeBadge } from "@/components/AiVideoNotice";

// Vitrin giriş kapıları (aura-health.higgsfield.app'ten taşındı, 2026-07-12).
// SigninGate (/giris) = "AURA Sign Up" tasarımının birebir inşası — #0D0E10
// sayfa üzerinde 22px radius panel; SOL 467px form kolonu (sembol, letterform
// başlık, üç sağlayıcı butonu, OR ayracı, mikro yasal metin), SAĞ gece Boğaz
// videosu. CorporateGate (/kurumsal-giris) = aynı panelin personel uyarlaması:
// rol seçici (görsel bağlam — tüm roller aynı girişe gider), sağda radyoloji videosu.
// DoctoriumGate (/doctorium/giris, 2026-08-16) = aynı panelin Doctorium alt-marka
// uyarlaması: zümrüt dönen sembol + lockup başlık + iki rol (kendi bölümüne bak).
//
// ── Kapı/form ayrımı KALDIRILDI (2026-08-06, kullanıcı kararı) ──
// Eski desende Apple/E-posta butonları /e-posta alt rotasındaki forma götürürdü — Apple OAuth
// canlanınca (v6.83) bu anlamsız bir ara katmana dönüştü ("Apple ile devam" deyince e-posta
// formuna düşülüyordu). Şimdi: Google/Apple DOĞRUDAN OAuth başlatır; "E-posta ile devam et"
// formu kapının İÇİNDE açar (GateEmailForm). /giris/e-posta ve /kurumsal-giris/e-posta
// kalıcı yönlendirmeye çevrildi; OAuth/verify dönüş banner'ları da artık kapıda çizilir —
// ?oauth/?verify parametresiyle gelindiğinde form OTOMATİK açılır (banner görünür kalsın).
//
// Üyelik daveti ("Hesabınız yok mu? Üye olun" / "Doktor musunuz? Kayıt olun") form İÇİNDEN
// kapının kalıcı alt bölgesine taşındı (2026-08-12, kullanıcı kararı): form kapalıyken davet
// görünmüyordu — artık sayfa açılır açılmaz "veya" ayracının altında durur (SignupPrompt).

// Sistem parametresiyle dönüş var mı? (form açık başlasın; banner GateEmailForm içinde)
function useReturnedWithBanner(): boolean {
  const sp = useSearchParams();
  return !!(sp.get("oauth") || sp.get("verify"));
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
          {/* Seffaflik beyani (kullanici karari 2026-08-18): kapi paneli videosu
              yapay zeka ile uretildi. Panel `relative` — rozet kadrajin icinde kalir. */}
          <AiVideoNoticeBadge lang={lang} />
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
  const returned = useReturnedWithBanner();
  const [emailOpen, setEmailOpen] = useState(false);
  const showForm = emailOpen || returned;

  return (
    <GateShell video={VIDEOS.hero}>
      {/* Kapı LOGOSUZ ve AURA bir kez (kullanıcı kararı 2026-08-23, v6.138): üstteki sembol/lockup
          kaldırıldı; "GLOBAL CARE" başlıktaki AURA'nın altında (WordHeadline globalCare). */}
      <WordHeadline
        word={t.signin.word}
        wordBefore={t.signin.wordBefore}
        wordAfter={t.signin.wordAfter}
        lineAfter={t.signin.lineAfter}
        globalCare
      />
      <p className="mt-3 text-[15px] text-[var(--aura-grey)]">{t.signin.sub}</p>

      <div className="mt-8 space-y-3">
        {/* Google + Apple: doğrudan OAuth başlangıcı (dönüş rol ana sayfasına iner;
            hata dönüşü ?oauth ile bu kapıya düşer ve form banner'la açılır) */}
        <ProviderButton href={LINKS.googleStart} label={t.signin.google} icon={<GoogleIcon />} />
        <ProviderButton href={LINKS.appleStart} label={t.signin.apple} icon={<AppleIcon />} />
        <ProviderToggle
          open={showForm}
          onClick={() => setEmailOpen((o) => !o)}
          label={t.signin.email}
          icon={<MailIcon />}
        />
        {showForm && <GateEmailForm texts={t.signin} />}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <span aria-hidden className="h-px flex-1 bg-[var(--aura-hairline)]" />
        <span className="aura-mono text-[11px] text-[var(--aura-micro)]">{t.signin.or}</span>
        <span aria-hidden className="h-px flex-1 bg-[var(--aura-hairline)]" />
      </div>

      <SignupPrompt
        prompt={t.signin.noAccount}
        label={t.signin.signup}
        href={LINKS.platformSignup}
      />

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

// Rol-duyarlı üyelik daveti hedefleri (2026-08-12) — RoleSelect indeksleriyle paralel:
// [Doktor, Partner Doktor, Sağlık Uzmanı, Acente Yetkilisi, Koordinatör, Etik Kurul].
// null = başvuru YOK (Koordinatör + Etik Kurul yalnız davetle; kapıda inviteNote görünür).
const ROLE_SIGNUP_HREFS: readonly (string | null)[] = [
  LINKS.doctorSignup, // /kayit — mevcut doktor self-signup
  "/kayit/partner",
  "/kayit/saglik-uzmani",
  "/kayit/acente",
  null,
  null,
];

// Kurumsal demo hızlı-giriş hesapları (görünürlük GateEmailForm'daki DEMO_UNLOCK kilidine bağlı;
// eski CorporateLoginForm'dan taşındı — ikonlar kapı dilinde yok, yalnız etiket).
const STAFF_QUICK = [
  { email: "doktor@air.test", label: "Doktor" },
  { email: "koordinator@air.test", label: "Koordinatör" },
  { email: "kurul@air.test", label: "Etik Kurul" },
  { email: "partner@air.test", label: "Partner Doktor" },
  { email: "acente@air.test", label: "Sağlık Turizmi Acentesi" },
];

function CorporatePanel() {
  const { t } = useLang();
  const c = t.corporate;
  const returned = useReturnedWithBanner();
  const [role, setRole] = useState(0); // roles dizisinde indeks; 0 = Doktor
  const [emailOpen, setEmailOpen] = useState(false);
  const showForm = emailOpen || returned;

  return (
    <GateShell video={VIDEOS.so}>
      {/* Hasta kapısıyla aynı: logosuz, GLOBAL CARE başlıktaki AURA'nın altında. */}
      <WordHeadline
        word={c.word}
        wordBefore={c.wordBefore}
        wordAfter={c.wordAfter}
        lineAfter={c.lineAfter}
        globalCare
      />
      <p className="mt-3 text-[15px] text-[var(--aura-grey)]">{c.sub}</p>

      <div className="mt-8 space-y-4">
        <RoleSelect label={c.roleLabel} roles={c.roles} value={role} onChange={setRole} />
        {/* Hasta kapısıyla AYNI sağlayıcı kompozisyonu: Google/Apple doğrudan OAuth
            (intent=doctor — mevcut e-posta kendi rolüyle girer), e-posta formu kapıda
            açılır. Metinler t.signin'den (9 dilde; corporate sözlüğüne kopyalanmaz).
            Rol seçimi görsel bağlam olmaya devam eder — tüm roller aynı girişe gider. */}
        <div className="space-y-3">
          <ProviderButton href={LINKS.corporateGoogleStart} label={t.signin.google} icon={<GoogleIcon />} />
          <ProviderButton href={LINKS.corporateAppleStart} label={t.signin.apple} icon={<AppleIcon />} />
          <ProviderToggle
            open={showForm}
            onClick={() => setEmailOpen((o) => !o)}
            label={t.signin.email}
            icon={<MailIcon />}
          />
          {showForm && <GateEmailForm texts={t.signin} quick={STAFF_QUICK} />}
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <span aria-hidden className="h-px flex-1 bg-[var(--aura-hairline)]" />
        <span className="aura-mono text-[11px] text-[var(--aura-micro)]">{t.signin.or}</span>
        <span aria-hidden className="h-px flex-1 bg-[var(--aura-hairline)]" />
      </div>

      {/* Rol-duyarlı davet (2026-08-12): seçili role göre kayıt linki ya da davet notu.
          role 0 = Doktor (mevcut /kayit) · 1-3 = Partner/Uzman/Acente (rolePrompts[role-1]) ·
          4-5 = Koordinatör/Etik Kurul (başvuru yok — inviteNote). */}
      {role === 0 ? (
        <SignupPrompt prompt={c.docPrompt} label={c.docSignup} href={LINKS.doctorSignup} />
      ) : ROLE_SIGNUP_HREFS[role] ? (
        <SignupPrompt
          prompt={c.rolePrompts[role - 1] ?? c.docPrompt}
          label={c.roleSignup}
          href={ROLE_SIGNUP_HREFS[role] as string}
        />
      ) : (
        <p className="mt-6 text-[13px] text-[var(--aura-grey)]">{c.inviteNote}</p>
      )}

      <Link
        href="/"
        className="aura-mono mt-6 text-[13px] text-[var(--aura-grey)] transition-colors duration-200 hover:text-[var(--aura-accent)]"
      >
        {"← "}
        {c.back}
      </Link>

      <p className="mt-8 text-[12px] leading-relaxed text-[var(--aura-micro)]">{c.legal}</p>
    </GateShell>
  );
}

// ————— Doctorium kapısı (/doctorium/giris) —————

// Doctorium giriş kapısı (2026-08-16, kullanıcı onaylı tasarım): CorporatePanel'in
// alt-marka uyarlaması. Farklar: zümrüt DÖNEN AuraMark (tone="emerald" + brand-live
// 4.5s — header toggle diliyle aynı) · WordHeadline yerine Doctorium lockup'ı
// (Doctor ink + ium zümrüt; marka kuralı [[doctorium-tanitim-marka]]) · Braille
// KALDIRILDI (2026-08-21, kullanıcı kararı) · iki rol (Doktor / Tıp Öğrencisi) ·
// üyelik daveti rol-duyarlı (/kayit · /ogrenci).
//
// TEK DİL TR (landing kararıyla tutarlı — /doctorium lang="tr"): GateShell yerine
// DoctoriumShell (aynı grid, lang sabit). Metinler sabit obje; copy.ts'in 9 dilli
// signin sözlüğüne BAĞLANMAZ (Doctorium yüzeyi çok-dilli değil). ⚠️ uppercase rol
// etiketi ("GİRİŞ ROLÜ") noktalı İ'yi lang="tr" sayesinde doğru çizer — kabuğun
// lang'i görseldir de, kaldırma.
//
// Zümrüt SABİT #34d399 (= AuraMark TONES.emerald.main = landing koyu bölüm değeri):
// kapılar gece-sabit vitrin yüzeyi (.aura-light bu ağaca girmez) → tema token'ı
// gerekmez. OAuth kurumsal kapıyla AYNI intent=doctor başlangıçları: mevcut e-posta
// kendi rolüyle girer; öğrenci ÜYELİĞİ yalnız /ogrenci hunisinden açılır.
const DOCTORIUM_EMERALD = "#34d399";

const DOCTORIUM = {
  welcome: "Hoş Geldiniz",
  sub: "Rolünüzü seçin ve size özel çalışma alanınıza giriş yapın.",
  roleLabel: "Giriş rolü",
  roles: ["Doktor", "Tıp Öğrencisi"],
  or: "VEYA",
  noAccount: "Hesabınız yok mu?",
  signup: "Üye olun",
  back: "Doctorium'a dön",
  legal: "Doctorium, doğrulanmış doktor ve tıp öğrencilerine özel çalışma alanıdır.",
  // GateEmailForm sözleşmesi + sağlayıcı etiketleri (TR signin değerleriyle birebir).
  google: "Google ile devam et",
  apple: "Apple ile devam et",
  email: "E-posta ile devam et",
  form: { emailLabel: "E-posta", passwordLabel: "Parola", submit: "Giriş yap" },
} as const;

// Rol-duyarlı üyelik hedefi — DOCTORIUM.roles indeksleriyle paralel:
// 0 Doktor → /kayit (self-signup) · 1 Tıp Öğrencisi → /ogrenci (öğrenci hunisi).
const DOCTORIUM_SIGNUP_HREFS: readonly string[] = [LINKS.doctorSignup, "/ogrenci"];

// Doctorium'a özel kapı videosu (kullanıcı üretimi, 2026-08-16 — geçici VIDEOS.so
// süpersede). Ad-versiyonlu "-gate2" çifti; poster kendi ilk karesinden (MAD 1.17 < 1.5
// ölçüldü — [[video-poster-mismatch]] kuralı). Kapıya özel varlık: copy.ts VIDEOS
// sözlüğüne taşınmadı (o sözlük hasta-vitrin videoları; tek kullanım yeri burası).
const DOCTORIUM_VIDEO = {
  src720: "/assets/video/v-doctorium-gate2-720.mp4",
  poster: "/assets/video/p-doctorium-gate2.jpg",
};

export function DoctoriumGate() {
  const returned = useReturnedWithBanner();
  const [role, setRole] = useState(0); // DOCTORIUM.roles indeksi; 0 = Doktor
  const [emailOpen, setEmailOpen] = useState(false);
  const showForm = emailOpen || returned;

  return (
    <DoctoriumShell>
      {/* v6.138 (kullanıcı kararı 2026-08-23): tüm giriş ekranları LOGOSUZ — üstteki zümrüt
          küre kaldırıldı; yalnız başlık (Doctorium lockup) + form. */}

      {/* Lockup + karşılama tek h1'de (tek sayfa başlığı): görsel iki satır,
          erişilebilir ad düzyazı. Lockup font-medium — landing DoctoriumWord dili
          (WordHeadline'ın font-bold'u AURA letterform'una özgü, buraya taşınmaz). */}
      <h1
        aria-label="Doctorium — Hoş geldiniz"
        className="aura-display mt-8 leading-tight tracking-tight text-[var(--aura-ink)]"
      >
        <span aria-hidden className="block">
          <span className="block text-3xl font-medium md:text-4xl">
            Doctor<span style={{ color: DOCTORIUM_EMERALD }}>ium</span>
          </span>
          <span className="mt-2 block text-2xl font-medium md:text-3xl">
            {DOCTORIUM.welcome}
          </span>
        </span>
      </h1>
      <p className="mt-3 text-[15px] text-[var(--aura-grey)]">{DOCTORIUM.sub}</p>

      <div className="mt-8 space-y-4">
        <RoleSelect
          label={DOCTORIUM.roleLabel}
          roles={[...DOCTORIUM.roles]}
          value={role}
          onChange={setRole}
        />
        {/* Kurumsal kapıyla AYNI sağlayıcı kompozisyonu ve intent=doctor OAuth
            başlangıçları; e-posta formu kapı içinde açılır. Rol seçimi görsel
            bağlam — iki rol de aynı girişe gider. */}
        <div className="space-y-3">
          <ProviderButton href={LINKS.corporateGoogleStart} label={DOCTORIUM.google} icon={<GoogleIcon />} />
          <ProviderButton href={LINKS.corporateAppleStart} label={DOCTORIUM.apple} icon={<AppleIcon />} />
          <ProviderToggle
            open={showForm}
            onClick={() => setEmailOpen((o) => !o)}
            label={DOCTORIUM.email}
            icon={<MailIcon />}
          />
          {showForm && <GateEmailForm texts={DOCTORIUM.form} />}
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <span aria-hidden className="h-px flex-1 bg-[var(--aura-hairline)]" />
        <span className="aura-mono text-[11px] text-[var(--aura-micro)]">{DOCTORIUM.or}</span>
        <span aria-hidden className="h-px flex-1 bg-[var(--aura-hairline)]" />
      </div>

      {/* Üyelik daveti ZÜMRÜT (kullanıcı kararı 2026-08-16, 2. tur — ilk turdaki
          turkuaz süpersede): Doctorium kapısında vurgu rengi alt-markayla hizalı. */}
      <SignupPrompt
        prompt={DOCTORIUM.noAccount}
        label={DOCTORIUM.signup}
        href={DOCTORIUM_SIGNUP_HREFS[role]}
        linkColor={DOCTORIUM_EMERALD}
      />

      <Link
        href="/doctorium"
        className="aura-mono mt-6 text-[13px] text-[var(--aura-grey)] transition-colors duration-200 hover:text-[var(--aura-accent)]"
      >
        {"← "}
        {DOCTORIUM.back}
      </Link>

      <p className="mt-8 text-[12px] leading-relaxed text-[var(--aura-micro)]">{DOCTORIUM.legal}</p>
    </DoctoriumShell>
  );
}

// GateShell'in tek-dil kopyası: useLang'a bağlanmaz (provider'sız default EN
// basardı), lang="tr" sabit — TR ltr olduğundan dir yazılmaz. Grid/video
// sözleşmesi GateShell ile birebir; ayrıştıysa ikisini birlikte güncelle.
function DoctoriumShell({ children }: { children: React.ReactNode }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useGateVideo(videoRef);

  return (
    <div lang="tr" className="aura-page flex min-h-dvh items-center justify-center px-4 py-8 md:px-10">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-[22px] border border-[var(--aura-hairline)] bg-[var(--aura-panel)] md:min-h-[640px] md:grid-cols-[minmax(380px,467px)_1fr]">
        <div className="flex flex-col justify-center px-8 py-12 text-center md:px-12">{children}</div>
        <div className="relative hidden md:block">
          <video
            ref={videoRef}
            muted
            loop
            playsInline
            preload="none"
            poster={DOCTORIUM_VIDEO.poster}
            className="absolute inset-0 h-full w-full object-cover"
            aria-hidden
          >
            <source src={DOCTORIUM_VIDEO.src720} type="video/mp4" />
          </video>
          {/* Seffaflik beyani (2026-08-18). Doctorium yuzeyi tek dil TR. */}
          <AiVideoNoticeBadge lang="tr" />
        </div>
      </div>
    </div>
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

// Sağlayıcı butonu: Sign Up tasarımındaki #1E1F22 + ince beyaz kenar + 13px radius dili.
// Anchor (fetch değil): OAuth akışı tam sayfa 302 zinciriyle yürür.
const PROVIDER_CLS =
  "flex w-full items-center justify-center gap-2.5 rounded-[13px] border border-[var(--aura-hairline)] bg-[var(--aura-surface)] px-4 py-3 text-[15px] font-semibold text-[var(--aura-ink)] transition-colors duration-200 hover:border-[var(--aura-accent)]/50 active:scale-[0.99]";

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
    <a href={href} className={PROVIDER_CLS}>
      {icon}
      {label}
    </a>
  );
}

// E-posta yöntemi: sayfadan ayrılmaz, formu kapının içinde açar/kapar (2026-08-06).
function ProviderToggle({
  open,
  onClick,
  label,
  icon,
}: {
  open: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onClick}
      className={PROVIDER_CLS + (open ? " border-[var(--aura-accent)]/50" : "")}
    >
      {icon}
      {label}
    </button>
  );
}

// Üyelik daveti: kapının kalıcı öğesi — form açık/kapalı fark etmez, sayfa yüklenir
// yüklenmez "veya" ayracının altında görünür (2026-08-12; eskiden GateEmailForm içindeydi).
// linkColor: varsayılan marka turkuazı (--aura-accent); Doctorium kapısı zümrüt geçer
// (kullanıcı kararı 2026-08-16, 2. tur). Inline style bilinçli — Tailwind arbitrary
// class'ı (`text-[${sabit}]`) statik taramada ÜRETİLMEZ, renk sessizce kaybolurdu.
function SignupPrompt({
  prompt,
  label,
  href,
  linkColor,
}: {
  prompt: string;
  label: string;
  href: string;
  linkColor?: string;
}) {
  return (
    <p className="mt-6 text-[13px] text-[var(--aura-grey)]">
      {prompt}{" "}
      <Link
        href={href}
        style={linkColor ? { color: linkColor } : undefined}
        className="font-semibold text-[var(--aura-accent)] underline-offset-2 hover:underline"
      >
        {label}
      </Link>
    </p>
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
