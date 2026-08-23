"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { NotificationBell } from "@/components/NotificationBell";
import { SystemMessagesMenuItem } from "@/components/SystemMessagesMenuItem";
import { AuraLogo, AuraMark } from "@/components/AuraLogo";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useT } from "@/components/useT";
import { langDir, LANG_BCP47, LANGUAGES, LANG_CHANGE_EVENT } from "@/lib/constants";
import { navItemsFor } from "@/lib/nav";
import { hidesGlobalChrome } from "@/lib/chrome-routes";
import { BadgeCheck, Bookmark, CalendarDays, LogOut, ShieldOff, Star, UserCog, Wallet } from "lucide-react";
import { ThemeToggle, type ThemeName } from "@/components/ThemeToggle";

const ROLE_LABELS: Record<string, string> = {
  PATIENT: "Hasta",
  DOCTOR: "Doktor",
  COORDINATOR: "Koordinatör",
  ETHICS: "Etik Kurul",
  ADMIN: "Yönetici",
  PARTNER: "Partner Doktor",
};

// AURA↔Doctorium ayrışması (kullanıcı kararı 2026-08-24): eski BrandToggle (tek kayan sembollü
// çift marka, v6.103) KALDIRILDI — Doctorium ayrı ürün olarak konumlandı, kromda iki marka yan
// yana yaşamaz. Doctorium kromunda (portal içi veya Aşama-1 hesabı) TEK marka: zümrüt küre +
// Doctorium lockup'ı (→ portal ana sayfası). AURA kromunda DOCTOR/COORDINATOR eski toggle'ın
// AURA hedefini korur: AuraLogo → /doktor (vitrin değil klinik panel). Aşama-2'ye geçiş daveti
// header'dan kalktı — o akış bütünüyle AURA tarafında yaşar (/doktor/baslangic).
// Geri-birleştirme el kitabı: vault [[aura-doctorium-baglanti-sistemi]].
function DoctoriumBrand({ doctoriumActive }: { doctoriumActive: boolean }) {
  return (
    <Link
      href="/doktor/doctorium"
      aria-current={doctoriumActive ? "page" : undefined}
      title="Doctorium"
      aria-label="Doctorium"
      className="flex shrink-0 items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-accent)] sm:gap-2"
    >
      <span aria-hidden className="brand-live block">
        <AuraMark size={23} tone="emerald" />
      </span>
      {/* Yazı MOBİLDE DE görünür (2026-08-19 bildirimi mirası): mobilde 13px, sm+ 15px. */}
      <span className="whitespace-nowrap text-[13px] font-medium text-[var(--c-ink)] sm:text-[15px]">
        Doctor<span className={`doctorium-ium${doctoriumActive ? " doctorium-ium-breathe" : ""}`}>ium</span>
      </span>
    </Link>
  );
}

// v6.95 — student (kullanıcı kararı 2026-08-14): öğrenci hunisi hesabında bant YALNIZ Doctorium,
// hesap menüsünde Profilim/Finans gizli, mono rol etiketi "Tıp Öğrencisi". Görsel sadeleştirme —
// güvenlik kapısı değil (klinik rotalar/finans sayfası kendi kapılarını zaten taşır).
// v6.105 — stage1 (kullanıcı kararı 2026-08-17): AŞAMA 1 doktoru = Doctorium üyeliği var,
// AURA üyeliği (klinik aktivasyon) YOK. Kromu Doctorium'a aittir: bant boş, hesap menüsünde
// Profilim/Finans yok, marka toggle'ının AURA yarısı soluk. `student` ile aynı sadeleştirme
// ailesi; ikisi de görsel, kapı DEĞİL. Tetikleyici durum bazlı (activatedAt) → Aşama 2 biter
// bitmez krom kendiliğinden AURA'ya döner.
export function Header({ user, lang = "Türkçe", theme = "dark", student = false, stage1 = false }: { user: { name: string; role: string } | null; lang?: string; theme?: ThemeName; student?: boolean; stage1?: boolean }) {
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
  // hasta nav'ı herkes için aynı). Öğrencide (v6.95) bant boş — Doctorium'a giriş toggle'dan.
  const items = navItemsFor(user?.role, { student, stage1 });
  // Doctorium odak modu (kullanıcı kararı 2026-08-16, 2. tur): portal içindeyken klinik
  // sekmeler (Doktor, Post-Op) ve hesap menüsündeki Profilim/Finans GİZLENİR — AURA tarafına
  // dönünce geri gelir. Görsel sadeleştirme; rota kapıları (hasClinicalAccess) aynen durur.
  const doctoriumActive = pathname.startsWith("/doktor/doctorium");
  // Doctorium kromu = portal içi VEYA Aşama-1 hesabı (kromu bütünüyle Doctorium'a ait, v6.105).
  // Ayrışma sonrası (2026-08-24) bu bayrak marka bloğunu ve bildirim scope'unu da seçer.
  const doctoriumSide = doctoriumActive || stage1;
  // Odak modunda klinik sekmeler + Doctorium sekmesi gizli (marka bloğu zaten portala gider).
  const shownItems = doctoriumActive ? items.filter((n) => n.href !== "/doktor" && n.href !== "/doktor/takip" && n.href !== "/doktor/doctorium") : items;
  // Çevrilecek metinler: görünür nav etiketleri + rol + Çıkış/Giriş.
  // lang="Türkçe" → useT no-op (kimlik). Partner gibi dil-tercihli kullanıcıda /api/i18n cache'i.
  const texts = useMemo(
    () => ["Çıkış", "Giriş yap", "Vazgeç", "Hesabım", "Profilim", "Finans", "Kaydettiklerim", "Puanlarım", "Tıp Öğrencisi", "Tüm cihazlardan çıkış", "Tüm cihazlardaki oturumlarınız kapatılacak. Devam edilsin mi?", "İşlem başarısız — oturumlar kapatılamadı. Lütfen tekrar deneyin.", "Gündüz temasına geç", "Gece temasına geç", "Sistem Mesajları", ...items.map((i) => i.label), ...(user ? [ROLE_LABELS[user.role] ?? user.role] : [])],
    [items, user]
  );
  // Krom dili: air_lang (kullanıcının AÇIK dil seçimi — vitrin dil anahtarının yazdığı yer)
  // sunucudan gelen `lang` prop'unu EZER (kullanıcı bildirimi 2026-08-18).
  //
  // Neden gerekti: layout.tsx `headerLang`i YALNIZ partner doktor için ayarlıyor, herkes için
  // varsayılan "Türkçe" → useT no-op. Sonuç: Almanca seçen hasta /giris'te gövdeyi Almanca
  // ("Willkommen bei…") ama üst bandı Türkçe ("Giriş yap") görüyordu. Gövde air_lang'ı zaten
  // izliyor; krom da izlemeli.
  //
  // Sunucuda okunamaz (localStorage) → effect'te. İlk boyama prop diliyle çizilir, ardından
  // seçili dile geçer; kısa bir parıltı bilinçli bedel (SSR'ı client depolamasına bağlamanın
  // alternatifi yok). air_lang YOKSA prop kazanır — partner doktorun profil dili korunur.
  //
  // Oturum İÇİNDE dil değişimi (kullanıcı bildirimi 2026-08-19): mount-tek-okuma yetmiyordu —
  // hasta gövdedeki seçiciyle dili değiştirince `storage` event'i AYNI sekmede ateşlenmediği
  // için üst bant bayat kalıyordu. LangSelect factory'si artık LANG_CHANGE_EVENT yayınlar;
  // burada onu (aynı sekme) + storage'ı (diğer sekmeler) dinleyip yeniden okuruz.
  const [uiLang, setUiLang] = useState(lang);
  useEffect(() => {
    const read = () => {
      try {
        const stored = window.localStorage.getItem("air_lang");
        if (stored && LANGUAGES.includes(stored)) setUiLang(stored);
        else setUiLang(lang);
      } catch {
        setUiLang(lang); // depolama engellenmiş — sunucu diline düş
      }
    };
    read();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "air_lang") read();
    };
    window.addEventListener(LANG_CHANGE_EVENT, read);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(LANG_CHANGE_EVENT, read);
      window.removeEventListener("storage", onStorage);
    };
  }, [lang]);

  const { t } = useT(uiLang, texts);
  const dir = langDir(uiLang);

  // Kendi kromunu taşıyan yüzeyler (landing'ler · giriş kapıları · locale rotaları · immersive
  // görüşme) lib/chrome-routes.ts'te listelenir — SiteFooter ile TEK KAYNAK (2026-08-17).
  if (hidesGlobalChrome(pathname)) return null;

  const activeHref = shownItems
    .filter((n) => pathname === n.href || pathname.startsWith(n.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  // Avatar baş harfleri (hesap menüsü düğmesi) — ismin ilk iki kelimesinden.
  const initials = user ? user.name.trim().split(/\s+/).map((w) => w[0] ?? "").slice(0, 2).join("").toUpperCase() : "";

  // Rozet: Doctorium kromunda yalnız scope'lu bildirim sayısı — msgUnread AURA yüzeyinin
  // sayacıdır ve Sistem Mesajları öğesi orada unmount olduğundan bayat kalabilir (2026-08-24).
  const badgeCount = doctoriumSide ? unreadCount : unreadCount + msgUnread;

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
    <header dir={dir} lang={LANG_BCP47[uiLang]} className="theme-dark sticky top-0 z-30 border-b border-[var(--c-hairline)] bg-[color-mix(in_srgb,var(--c-chrome)_88%,transparent)] backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between gap-4">
        {/* Marka altyazısı ("Sağlık Turizmi & Teletıp") kullanıcı isteğiyle kaldırıldı (2026-07-12) — yalnız logo */}
        {/* shrink-0: dar ekranda flex logoyu ezip wordmark'ı nav'ın altına sokuyordu
            (mobil "menüler üst üste biniyor" bildirimi, 2026-08-01) — taşmayı nav scroll'u yönetir. */}
        {user && ["DOCTOR", "COORDINATOR"].includes(user.role) ? (
          doctoriumSide ? (
            <DoctoriumBrand doctoriumActive={doctoriumActive} />
          ) : (
            // AURA kromunda logo klinik panele gider (eski toggle'ın AURA hedefi — vitrin değil).
            <Link href="/doktor" className="flex shrink-0 items-end" aria-label="AURA">
              <AuraLogo size={23} />
            </Link>
          )
        ) : (
          <Link href="/" className="flex shrink-0 items-end">
            <AuraLogo size={23} />
          </Link>
        )}

        <div className="flex min-w-0 items-center gap-1.5">
          {/* min-w-0 + overflow-x-auto: nav dar ekranda SIKIŞMAK yerine kendi içinde yatay
              kayar (scrollbar gizli); öğeler shrink-0 ile bütün kalır. Admin'in 8+ öğeli
              bandı ve mobilde tam metinli Doctorium bu sayede çakışmaz. */}
          <nav className="flex min-w-0 items-center gap-1 overflow-x-auto sm:gap-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {shownItems.map(({ href, label, icon: Icon }) => {
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
                  {/* İkonsuz öğe (Doctorium sekmesi) mobilde de etiket gösterir — yoksa bantta
                      hiç görünmezdi (ikon yok + etiket sm+ gizli). */}
                  <span className={Icon ? "hidden sm:inline" : ""}>{t(label)}</span>
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
                  {badgeCount > 0 && (
                    <span className="absolute -end-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
                      {badgeCount > 9 ? "9+" : badgeCount}
                    </span>
                  )}
                </button>
                <div role="menu" className={`absolute end-0 top-11 z-40 w-64 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-1.5 shadow-xl ${menuOpen ? "" : "hidden"}`}>
                  <div className="border-b border-[var(--c-hairline)] px-3 pb-2.5 pt-2">
                    <div className="text-sm font-medium leading-tight text-[var(--c-ink)]">{user.name}</div>
                    {/* Mono rol etiketi — landing'in "mono durak" dili. Öğrencide "Doktor" yazmaz:
                        kimlik beyanı dürüst kalır (v6.95). */}
                    <div className="aura-mono mt-0.5 text-[10px] uppercase tracking-[0.18em] leading-tight text-[var(--c-ink-3)]">{t(student ? "Tıp Öğrencisi" : ROLE_LABELS[user.role] ?? user.role)}</div>
                  </div>
                  <div className="mt-1">
                    {/* Ayrışma (2026-08-24): Doctorium kromunda zil yalnız Doctorium bildirimlerini
                        (CONGRESS_ALERT) gösterir — klinik (AURA) bildirimleri görünmez, "tümünü
                        okundu" da onlara dokunmaz. Bell HEP mount kalır (rozet beslemesi). */}
                    <NotificationBell lang={uiLang} patientLangFallback={user.role === "PATIENT"} variant="menu-item" scope={doctoriumSide ? "doctorium" : undefined} onUnreadChange={setUnreadCount} />
                    {/* Sistem mesajları (v6.79) — bildirimlerin hemen altı; satır /mesajlar'a gider.
                        Doctorium kromunda GİZLİ (klinik/hesap mesajları AURA yüzeyidir). */}
                    {!doctoriumSide && (
                      <SystemMessagesMenuItem label={t("Sistem Mesajları")} onUnreadChange={setMsgUnread} onNavigate={() => setMenuOpen(false)} />
                    )}
                  </div>
                  {/* Doctorium kişisel köşesi (2026-08-18, kullanıcı kararı): Üst Raf'taki
                      Kaydettiklerim/Puanlarım BURAYA taşındı — kişisel eşya profil menüsünde
                      yaşar (Profilim/Finans deseni). Yalnız Doctorium kromunda görünür
                      (doctoriumActive; stage1 doktorunun kromu bütünüyle Doctorium olduğundan
                      onda her yerde). Kaydettiklerim öğrenciye AÇIK (içerik işlevi, v6.95);
                      Puanlarım öğrencide GİZLİ (pazarlama süzgeci). */}
                  {/* Takvimim (kullanıcı isteği 2026-08-19): etkinlik takvimi — rafın 08
                      durağının menü eşleniği. Kaydettiklerim'le aynı koşul (içerik işlevi,
                      öğrenciye de açık; Aşama 2'de nöbet/icap planı da burada yaşayacak). */}
                  {user.role === "DOCTOR" && (doctoriumActive || stage1) && (
                    <Link role="menuitem" href="/doktor/doctorium/takvim" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-[var(--c-ink-2)] transition-colors duration-200 hover:bg-[var(--c-surface)] hover:text-[var(--c-ink)]">
                      <CalendarDays size={15} /> {t("Takvimim")}
                    </Link>
                  )}
                  {user.role === "DOCTOR" && (doctoriumActive || stage1) && (
                    <Link role="menuitem" href="/doktor/doctorium/kaydettiklerim" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-[var(--c-ink-2)] transition-colors duration-200 hover:bg-[var(--c-surface)] hover:text-[var(--c-ink)]">
                      <Bookmark size={15} /> {t("Kaydettiklerim")}
                    </Link>
                  )}
                  {user.role === "DOCTOR" && !student && (doctoriumActive || stage1) && (
                    <Link role="menuitem" href="/doktor/doctorium/oduller" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-[var(--c-ink-2)] transition-colors duration-200 hover:bg-[var(--c-surface)] hover:text-[var(--c-ink)]">
                      <Star size={15} /> {t("Puanlarım")}
                    </Link>
                  )}
                  {/* Profilim + Finans (2026-08-01, kullanıcı kararı, 2. tur): Profilim nav
                      bandından buraya taşındı; Finans artık profil çapası değil AYRI SAYFA.
                      v6.95: öğrencide İKİSİ DE GİZLİ (kullanıcı kararı 2026-08-14) — profil
                      doktor kimlik/işlem alanları, finans doktor hakedişleri taşır; öğrenciye
                      kapalı yüzeyin linki çizilmez (koşullu-href). Doctorium odak modunda
                      (2026-08-16) da gizli — klinik yüzey linkleri AURA tarafında yaşar.
                      v6.105 (2026-08-17): AŞAMA 1 doktorunda (stage1) da gizli — o hesabın
                      kromu bütünüyle Doctorium'a aittir, portal içinde/dışında fark etmez. */}
                  {(user.role === "DOCTOR" || user.role === "ADMIN") && !student && !stage1 && !doctoriumActive && (
                    <Link role="menuitem" href="/doktor/profil" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-[var(--c-ink-2)] transition-colors duration-200 hover:bg-[var(--c-surface)] hover:text-[var(--c-ink)]">
                      <BadgeCheck size={15} /> {t("Profilim")}
                    </Link>
                  )}
                  {user.role === "DOCTOR" && !student && !stage1 && !doctoriumActive && (
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
