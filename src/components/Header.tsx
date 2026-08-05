"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { NotificationBell } from "@/components/NotificationBell";
import { SystemMessagesMenuItem } from "@/components/SystemMessagesMenuItem";
import { PortamedLogo } from "@/components/PortamedLogo";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useT } from "@/components/useT";
import { langDir, LANG_BCP47 } from "@/lib/constants";
import { navItemsFor } from "@/lib/nav";
import { isImmersiveCallPath } from "@/lib/immersive-routes";
import { LANG_CODES } from "@/lib/aura-landing/copy";
import { BadgeCheck, LogOut, ShieldOff, UserCog, Wallet } from "lucide-react";
import { ThemeToggle, type ThemeName } from "@/components/ThemeToggle";

const ROLE_LABELS: Record<string, string> = {
  PATIENT: "Hasta",
  DOCTOR: "Doktor",
  COORDINATOR: "Koordinatör",
  ETHICS: "Etik Kurul",
  ADMIN: "Yönetici",
  PARTNER: "Partner Doktor",
};

export function Header({ user, lang = "Türkçe", theme = "dark" }: { user: { name: string; role: string } | null; lang?: string; theme?: ThemeName }) {
  const pathname = usePathname();
  const router = useRouter();
  const [confirmLogoutAll, setConfirmLogoutAll] = useState(false);
  // Hesap menüsü (2026-08-01, kullanıcı kararı "A"): isim/rol + Hesabım + çıkış işlemleri
  // açılır menüye taşındı — header tek satır kalır, tema anahtarı EN SAĞA geçer.
  const [menuOpen, setMenuOpen] = useState(false);
  // Zil menüye taşındı (2026-08-01, 2. tur) — okunmamış sayı avatar rozetinde yaşar
  // (NotificationBell onUnreadChange ile yukarı bildirir; bell menüde HEP mount kalır).
  const [unreadCount, setUnreadCount] = useState(0);
  // Sistem mesajları (v6.79) — ayrı okunmamış sayaç; avatar rozeti İKİSİNİN TOPLAMINI gösterir.
  const [msgUnread, setMsgUnread] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // Dış tıklamada kapat (NotificationBell deseni).
  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  // Nav öğeleri rol bazlı (lib/nav.ts — tam birleşme 2026-07-12: journey daraltması kalktı,
  // hasta nav'ı herkes için aynı).
  const items = navItemsFor(user?.role);
  // Çevrilecek metinler: görünür nav etiketleri + rol + Çıkış/Giriş.
  // lang="Türkçe" → useT no-op (kimlik). Partner gibi dil-tercihli kullanıcıda /api/i18n cache'i.
  const texts = useMemo(
    () => ["Çıkış", "Giriş yap", "Vazgeç", "Hesabım", "Profilim", "Finans", "Tüm cihazlardan çıkış", "Tüm cihazlardaki oturumlarınız kapatılacak. Devam edilsin mi?", "İşlem başarısız — oturumlar kapatılamadı. Lütfen tekrar deneyin.", "Gündüz temasına geç", "Gece temasına geç", ...items.map((i) => i.label), ...(user ? [ROLE_LABELS[user.role] ?? user.role] : [])],
    [items, user]
  );
  const { t } = useT(lang, texts);
  const dir = langDir(lang);

  // AURA landing (/, /how-it-works, /guven-ve-gizlilik) kendi nav/footer'ını taşır — global krom gizlenir.
  // Giriş kapıları (/giris, /kurumsal-giris) tam-ekran vitrin panelleridir (kendi logo +
  // "← ana sayfa" bağlantısıyla); /e-posta form alt-rotalarında krom durur (exact match).
  // Video görüşme rotaları IMMERSIVE tam-ekran (100dvh video+panel) → krom gizlenir.
  // Locale rotaları (/en /tr … — v6.17) da landing'dir: kendi nav/footer'ını taşır.
  if (
    ["/", "/v2", "/how-it-works", "/guven-ve-gizlilik", "/for-clinicians", "/giris", "/kurumsal-giris"].includes(pathname) ||
    (LANG_CODES as readonly string[]).includes(pathname.slice(1)) ||
    isImmersiveCallPath(pathname)
  )
    return null;

  const activeHref = items
    .filter((n) => pathname === n.href || pathname.startsWith(n.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  // Avatar baş harfleri (hesap menüsü düğmesi) — ismin ilk iki kelimesinden.
  const initials = user ? user.name.trim().split(/\s+/).map((w) => w[0] ?? "").slice(0, 2).join("").toUpperCase() : "";

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/giris");
    router.refresh();
  }

  // JWT iptali: sessionVersion artar → bu hesabın TÜM cihazlardaki token'ları geçersizleşir.
  // Güvenlik eylemi sessizce başarısız olmasın: yanıt kontrol edilir, hatada yönlendirme YAPILMAZ.
  // Native confirm() yerine ConfirmDialog (2026-07-12).
  async function doLogoutAll() {
    const res = await fetch("/api/auth/logout-all", { method: "POST" }).catch(() => null);
    if (!res?.ok) {
      setConfirmLogoutAll(false);
      window.alert(t("İşlem başarısız — oturumlar kapatılamadı. Lütfen tekrar deneyin."));
      return;
    }
    setConfirmLogoutAll(false);
    router.push("/giris");
    router.refresh();
  }

  // Aura kiti (2026-07-17, kullanıcı kararı): iç krom V2Nav diline çekildi — cam zemin
  // (color-mix + blur), pill yerine metin sekmeleri (aktif = turkuaz), mono rol etiketi,
  // durak-noktalı giriş CTA'sı. Davranış (rol bazlı nav, logout, bildirim) DEĞİŞMEDİ.
  return (
    <header dir={dir} lang={LANG_BCP47[lang]} className="theme-dark sticky top-0 z-30 border-b border-[var(--c-hairline)] bg-[color-mix(in_srgb,var(--c-bg)_82%,transparent)] backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between gap-4">
        {/* Marka altyazısı ("Sağlık Turizmi & Teletıp") kullanıcı isteğiyle kaldırıldı (2026-07-12) — yalnız logo */}
        {/* shrink-0: dar ekranda flex logoyu ezip wordmark'ı nav'ın altına sokuyordu
            (mobil "menüler üst üste biniyor" bildirimi, 2026-08-01) — taşmayı nav scroll'u yönetir. */}
        <Link href="/" className="flex shrink-0 items-end">
          <PortamedLogo size={23} />
        </Link>

        <div className="flex min-w-0 items-center gap-1.5">
          {/* min-w-0 + overflow-x-auto: nav dar ekranda SIKIŞMAK yerine kendi içinde yatay
              kayar (scrollbar gizli); öğeler shrink-0 ile bütün kalır. Admin'in 8+ öğeli
              bandı ve mobilde tam metinli Doctorium bu sayede çakışmaz. */}
          <nav className="flex min-w-0 items-center gap-1 overflow-x-auto sm:gap-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {items.map(({ href, label, icon: Icon }) => {
              const active = href === activeHref;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex min-h-[44px] shrink-0 items-center gap-2 px-2 text-sm transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-accent)] ${
                    active ? "font-medium text-[var(--c-accent)]" : "text-[var(--c-ink-2)] hover:text-[var(--c-ink)]"
                  }`}
                >
                  {Icon && <Icon size={16} />}
                  {label === "Doctorium" ? (
                    /* Marka yazı-lockup'ı (ikonsuz; çevrilmez): "ium" zümrüt + aura ışıma nabzı.
                       İkon olmadığından mobilde de görünür (diğer öğeler sm+ etiket gizler). */
                    <span className="whitespace-nowrap">
                      Doctor<span className="doctorium-ium doctorium-ium-breathe">ium</span>
                    </span>
                  ) : (
                    <span className="hidden sm:inline">{t(label)}</span>
                  )}
                </Link>
              );
            })}
          </nav>

          {user ? (
            <div className="ml-1 flex shrink-0 items-center border-l border-[var(--c-hairline)] ps-2">
              {/* Hesap menüsü v2 (2026-08-01, 2. tur): zil + tema da menüye taşındı — header'da
                  YALNIZ avatar kalır; okunmamış bildirim avatar rozetinde. Menü paneli koşullu
                  render DEĞİL `hidden` ile gizlenir: içindeki NotificationBell hep mount kalmalı
                  (30 sn'lik okunmamış yoklaması + rozet beslemesi ölmesin). */}
              <div ref={menuRef} className="relative">
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  title={user.name}
                  className="relative grid h-9 w-9 place-items-center rounded-full bg-[var(--c-accent)]/15 text-[12px] font-bold text-[var(--c-accent)] transition-colors duration-200 hover:bg-[var(--c-accent)]/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-accent)]"
                >
                  {initials}
                  {unreadCount + msgUnread > 0 && (
                    <span className="absolute -end-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
                      {unreadCount + msgUnread > 9 ? "9+" : unreadCount + msgUnread}
                    </span>
                  )}
                </button>
                <div role="menu" className={`absolute end-0 top-11 z-40 w-64 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-1.5 shadow-xl ${menuOpen ? "" : "hidden"}`}>
                  <div className="border-b border-[var(--c-hairline)] px-3 pb-2.5 pt-2">
                    <div className="text-sm font-medium leading-tight text-[var(--c-ink)]">{user.name}</div>
                    {/* Mono rol etiketi — landing'in "mono durak" dili */}
                    <div className="aura-mono mt-0.5 text-[10px] uppercase tracking-[0.18em] leading-tight text-[var(--c-ink-3)]">{t(ROLE_LABELS[user.role] ?? user.role)}</div>
                  </div>
                  <div className="mt-1">
                    <NotificationBell lang={lang} patientLangFallback={user.role === "PATIENT"} variant="menu-item" onUnreadChange={setUnreadCount} />
                    {/* Sistem mesajları (v6.79) — bildirimlerin hemen altı (kullanıcı kararı); satır /mesajlar'a gider */}
                    <SystemMessagesMenuItem onUnreadChange={setMsgUnread} onNavigate={() => setMenuOpen(false)} />
                  </div>
                  {/* Profilim + Finans (2026-08-01, kullanıcı kararı, 2. tur): Profilim nav
                      bandından buraya taşındı; Finans artık profil çapası değil AYRI SAYFA. */}
                  {(user.role === "DOCTOR" || user.role === "ADMIN") && (
                    <Link role="menuitem" href="/doktor/profil" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-[var(--c-ink-2)] transition-colors duration-200 hover:bg-[var(--c-surface)] hover:text-[var(--c-ink)]">
                      <BadgeCheck size={15} /> {t("Profilim")}
                    </Link>
                  )}
                  {user.role === "DOCTOR" && (
                    <Link role="menuitem" href="/doktor/finans" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-[var(--c-ink-2)] transition-colors duration-200 hover:bg-[var(--c-surface)] hover:text-[var(--c-ink)]">
                      <Wallet size={15} /> {t("Finans")}
                    </Link>
                  )}
                  {/* Hesap ayarları — yalnız hastada (v6.11): hesap/veri silme oradan yapılır (KVKK m.7).
                      Personelde gizli; sayfa + API de PATIENT'a kapılı (savunma-derinliği). */}
                  {user.role === "PATIENT" && (
                    <Link role="menuitem" href="/hesap" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-[var(--c-ink-2)] transition-colors duration-200 hover:bg-[var(--c-surface)] hover:text-[var(--c-ink)]">
                      <UserCog size={15} /> {t("Hesabım")}
                    </Link>
                  )}
                  <ThemeToggle initial={theme} t={t} asMenuItem />
                  <div className="mt-1 border-t border-[var(--c-hairline)] pt-1">
                    <button role="menuitem" onClick={() => { setMenuOpen(false); setConfirmLogoutAll(true); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-start text-sm text-[var(--c-ink-2)] transition-colors duration-200 hover:bg-[var(--c-surface)] hover:text-[var(--c-ink)]">
                      <ShieldOff size={15} /> {t("Tüm cihazlardan çıkış")}
                    </button>
                    <button role="menuitem" onClick={() => { setMenuOpen(false); logout(); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-start text-sm text-[var(--c-ink-2)] transition-colors duration-200 hover:bg-[var(--c-surface)] hover:text-red-400">
                      <LogOut size={15} /> {t("Çıkış")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* V2Nav CTA dili: turkuaz durak noktası + mono etiket */}
              <Link href="/giris" className="group ms-1 flex min-h-[44px] items-center gap-2 px-2 text-sm font-medium text-[var(--c-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-accent)]">
                <span aria-hidden className="h-2 w-2 rounded-full border border-[var(--c-accent)] transition-colors duration-200 group-hover:bg-[var(--c-accent)]" />
                <span className="aura-mono text-[13px] transition-colors duration-200 group-hover:text-[var(--c-accent)]">{t("Giriş yap")}</span>
              </Link>
              {/* Misafirde menü yok — tema anahtarı ikon olarak en sağda kalır. */}
              <ThemeToggle initial={theme} t={t} />
            </>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={confirmLogoutAll}
        message={t("Tüm cihazlardaki oturumlarınız kapatılacak. Devam edilsin mi?")}
        confirmLabel={t("Tüm cihazlardan çıkış")}
        cancelLabel={t("Vazgeç")}
        danger
        onConfirm={doLogoutAll}
        onCancel={() => setConfirmLogoutAll(false)}
      />
    </header>
  );
}
