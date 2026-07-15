"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { NotificationBell } from "@/components/NotificationBell";
import { PortamedLogo } from "@/components/PortamedLogo";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useT } from "@/components/useT";
import { langDir } from "@/lib/constants";
import { navItemsFor } from "@/lib/nav";
import { isImmersiveCallPath } from "@/lib/immersive-routes";
import { LogOut, LogIn, ShieldOff, UserCog } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  PATIENT: "Hasta",
  DOCTOR: "Doktor",
  COORDINATOR: "Koordinatör",
  ETHICS: "Etik Kurul",
  ADMIN: "Yönetici",
  PARTNER: "Partner Doktor",
};

export function Header({ user, lang = "Türkçe" }: { user: { name: string; role: string } | null; lang?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [confirmLogoutAll, setConfirmLogoutAll] = useState(false);

  // Nav öğeleri rol bazlı (lib/nav.ts — tam birleşme 2026-07-12: journey daraltması kalktı,
  // hasta nav'ı herkes için aynı).
  const items = navItemsFor(user?.role);
  // Çevrilecek metinler: görünür nav etiketleri + rol + Çıkış/Giriş.
  // lang="Türkçe" → useT no-op (kimlik). Partner gibi dil-tercihli kullanıcıda /api/i18n cache'i.
  const texts = useMemo(
    () => ["Çıkış", "Giriş yap", "Vazgeç", "Hesabım", "Tüm cihazlardan çıkış", "Tüm cihazlardaki oturumlarınız kapatılacak. Devam edilsin mi?", "İşlem başarısız — oturumlar kapatılamadı. Lütfen tekrar deneyin.", ...items.map((i) => i.label), ...(user ? [ROLE_LABELS[user.role] ?? user.role] : [])],
    [items, user]
  );
  const { t } = useT(lang, texts);
  const dir = langDir(lang);

  // AURA landing (/, /how-it-works, /guven-ve-gizlilik) kendi nav/footer'ını taşır — global krom gizlenir.
  // Giriş kapıları (/giris, /kurumsal-giris) tam-ekran vitrin panelleridir (kendi logo +
  // "← ana sayfa" bağlantısıyla); /e-posta form alt-rotalarında krom durur (exact match).
  // Video görüşme rotaları IMMERSIVE tam-ekran (100dvh video+panel) → krom gizlenir.
  if (["/", "/how-it-works", "/guven-ve-gizlilik", "/giris", "/kurumsal-giris"].includes(pathname) || isImmersiveCallPath(pathname)) return null;

  const activeHref = items
    .filter((n) => pathname === n.href || pathname.startsWith(n.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

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

  return (
    <header dir={dir} className="theme-dark sticky top-0 z-30 border-b border-[var(--c-hairline)] bg-[var(--c-bg)]/95 backdrop-blur">
      <div className="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between gap-4">
        {/* Marka altyazısı ("Sağlık Turizmi & Teletıp") kullanıcı isteğiyle kaldırıldı (2026-07-12) — yalnız logo */}
        <Link href="/" className="flex items-end">
          <PortamedLogo size={23} />
        </Link>

        <div className="flex items-center gap-1.5">
          <nav className="flex items-center gap-1">
            {items.map(({ href, label, icon: Icon }) => {
              const active = href === activeHref;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active ? "bg-[var(--c-accent)] text-[var(--c-bg)]" : "text-[var(--c-ink-2)] hover:bg-[var(--c-surface)] hover:text-[var(--c-accent)]"
                  }`}
                >
                  <Icon size={16} />
                  <span className="hidden sm:inline">{t(label)}</span>
                </Link>
              );
            })}
          </nav>

          {user ? (
            <div className="ml-1 flex items-center gap-2 border-l border-[var(--c-hairline)] ps-2">
              <NotificationBell lang={lang} patientLangFallback={user.role === "PATIENT"} />
              <div className="hidden text-end sm:block">
                <div className="text-sm font-medium leading-tight text-[var(--c-ink)]">{user.name}</div>
                <div className="text-[11px] leading-tight text-[var(--c-ink-3)]">{t(ROLE_LABELS[user.role] ?? user.role)}</div>
              </div>
              {/* Hesap ayarları — yalnız hastada (v6.11): hesap/veri silme oradan yapılır (KVKK m.7).
                  Personelde gizli; sayfa + API de PATIENT'a kapılı (savunma-derinliği). */}
              {user.role === "PATIENT" && (
                <Link href="/hesap" title={t("Hesabım")} className="grid h-9 w-9 place-items-center rounded-lg text-[var(--c-ink-3)] hover:bg-[var(--c-surface)] hover:text-[var(--c-accent)]">
                  <UserCog size={17} />
                </Link>
              )}
              <button onClick={() => setConfirmLogoutAll(true)} title={t("Tüm cihazlardan çıkış")} className="grid h-9 w-9 place-items-center rounded-lg text-[var(--c-ink-3)] hover:bg-[var(--c-surface)] hover:text-red-400">
                <ShieldOff size={16} />
              </button>
              <button onClick={logout} title={t("Çıkış")} className="grid h-9 w-9 place-items-center rounded-lg text-[var(--c-ink-2)] hover:bg-[var(--c-surface)] hover:text-red-400">
                <LogOut size={17} />
              </button>
            </div>
          ) : (
            <Link href="/giris" className="ms-1 inline-flex items-center gap-1.5 rounded-lg bg-[var(--c-accent)] px-3.5 py-2 text-sm font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)]">
              <LogIn size={16} /> {t("Giriş yap")}
            </Link>
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
